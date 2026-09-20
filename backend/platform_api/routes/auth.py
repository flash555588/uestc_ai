from __future__ import annotations

from datetime import datetime, timedelta, timezone
import re
import secrets

from flask import Blueprint, current_app, jsonify, make_response, request
from werkzeug.security import check_password_hash, generate_password_hash

from ..extensions import db
from ..mailer import MailDeliveryError, send_verification_email
from ..models import EmailVerificationCode, RegistrationInvite, Session, User
from ..security import current_user, hash_token, require_user
from ..utils import audit, payload


auth_bp = Blueprint("auth", __name__)
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def normalized_email(value) -> str:
    return str(value or "").strip().lower()


def is_campus_email(email: str) -> bool:
    return email.rpartition("@")[2] == "std.uestc.edu.cn"


def normalized_invite_code(value) -> str:
    return str(value or "").strip().upper().replace("-", "")


def active_invite(raw_code) -> RegistrationInvite | None:
    code = normalized_invite_code(raw_code)
    if not code:
        return None
    invite = RegistrationInvite.query.filter_by(code_hash=hash_token(code)).first()
    return invite if invite and invite.status() == "active" else None


def verification_hash(email: str, code: str) -> str:
    return hash_token(f"{current_app.config['SECRET_KEY']}:{email}:{code}")


def aware(value):
    return value.replace(tzinfo=timezone.utc) if value and value.tzinfo is None else value


def issue_session(user: User):
    raw = secrets.token_urlsafe(36)
    session = Session(token_hash=hash_token(raw), user=user, expires_at=datetime.now(timezone.utc) + timedelta(days=14))
    db.session.add(session)
    audit("auth.login", "user", user.id, actor_id=user.id)
    db.session.commit()
    response = make_response(jsonify({"user": user.to_dict(), "token": raw}))
    response.set_cookie(
        "session_token",
        raw,
        httponly=True,
        secure=current_app.config["SESSION_COOKIE_SECURE"],
        samesite=current_app.config["SESSION_COOKIE_SAMESITE"],
        max_age=14 * 86400,
    )
    return response


@auth_bp.post("/register")
def register():
    data, error = payload(("email", "name", "password", "verification_code"))
    if error:
        return error
    email = normalized_email(data["email"])
    if not EMAIL_PATTERN.fullmatch(email):
        return jsonify({"error": "invalid email address"}), 400
    if len(data["password"]) < 8:
        return jsonify({"error": "password must contain at least 8 characters"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "email already registered"}), 409
    invite = None
    if not is_campus_email(email):
        invite = active_invite(data.get("invite_code"))
        if not invite:
            return jsonify({"error": "valid registration invite required"}), 403

    verification = (
        EmailVerificationCode.query
        .filter_by(email=email, purpose="register", consumed_at=None)
        .order_by(EmailVerificationCode.created_at.desc())
        .first()
    )
    now = datetime.now(timezone.utc)
    if not verification or aware(verification.expires_at) <= now:
        return jsonify({"error": "verification code expired"}), 400
    code = str(data["verification_code"]).strip()
    if not secrets.compare_digest(verification.code_hash, verification_hash(email, code)):
        verification.attempts += 1
        if verification.attempts >= current_app.config["VERIFICATION_CODE_MAX_ATTEMPTS"]:
            verification.consumed_at = now
        db.session.commit()
        return jsonify({"error": "invalid verification code"}), 400

    user = User(email=email, name=data["name"].strip(), password_hash=generate_password_hash(data["password"]), role="member", email_verified_at=now)
    db.session.add(user)
    db.session.flush()
    verification.consumed_at = now
    if invite:
        invite.used_at = now
        invite.used_by = user.id
    audit("user.registered", "user", user.id, actor_id=user.id)
    db.session.commit()
    return issue_session(user), 201


@auth_bp.post("/verification-codes")
def request_verification_code():
    data, error = payload(("email",))
    if error:
        return error
    email = normalized_email(data["email"])
    if not EMAIL_PATTERN.fullmatch(email):
        return jsonify({"error": "invalid email address"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "email already registered"}), 409
    if not is_campus_email(email) and not active_invite(data.get("invite_code")):
        return jsonify({"error": "valid registration invite required"}), 403

    now = datetime.now(timezone.utc)
    resend_seconds = current_app.config["VERIFICATION_CODE_RESEND_SECONDS"]
    latest = EmailVerificationCode.query.filter_by(email=email, purpose="register").order_by(EmailVerificationCode.created_at.desc()).first()
    if latest and aware(latest.created_at) > now - timedelta(seconds=resend_seconds):
        retry_after = max(1, int(resend_seconds - (now - aware(latest.created_at)).total_seconds()))
        return jsonify({"error": "verification code requested too frequently", "retry_after": retry_after}), 429

    hour_ago = now - timedelta(hours=1)
    email_count = EmailVerificationCode.query.filter(
        EmailVerificationCode.email == email,
        EmailVerificationCode.created_at >= hour_ago,
    ).count()
    if email_count >= current_app.config["VERIFICATION_CODE_HOURLY_LIMIT"]:
        return jsonify({"error": "verification code hourly limit reached"}), 429
    ip_hash = hash_token(f"{current_app.config['SECRET_KEY']}:{request.remote_addr or 'unknown'}")
    ip_count = EmailVerificationCode.query.filter(
        EmailVerificationCode.request_ip_hash == ip_hash,
        EmailVerificationCode.created_at >= hour_ago,
    ).count()
    if ip_count >= current_app.config["VERIFICATION_CODE_IP_HOURLY_LIMIT"]:
        return jsonify({"error": "verification code hourly limit reached"}), 429

    EmailVerificationCode.query.filter_by(email=email, purpose="register", consumed_at=None).update(
        {EmailVerificationCode.consumed_at: now},
        synchronize_session=False,
    )
    code = f"{secrets.randbelow(1_000_000):06d}"
    record = EmailVerificationCode(
        email=email,
        code_hash=verification_hash(email, code),
        purpose="register",
        request_ip_hash=ip_hash,
        expires_at=now + timedelta(seconds=current_app.config["VERIFICATION_CODE_TTL_SECONDS"]),
    )
    db.session.add(record)
    db.session.flush()
    try:
        send_verification_email(email, code)
    except MailDeliveryError as delivery_error:
        db.session.rollback()
        return jsonify({"error": str(delivery_error)}), 503
    audit("auth.verification_code_requested", "email_verification", record.id, {"email_domain": email.rpartition("@")[2]})
    db.session.commit()
    response = {
        "status": "sent",
        "expires_in": current_app.config["VERIFICATION_CODE_TTL_SECONDS"],
        "retry_after": resend_seconds,
    }
    if current_app.testing or current_app.config["EXPOSE_VERIFICATION_CODE"]:
        response["debug_code"] = code
    return jsonify(response), 202


@auth_bp.post("/login")
def login():
    data, error = payload(("email", "password"))
    if error:
        return error
    user = User.query.filter_by(email=data["email"].strip().lower()).first()
    if not user or not check_password_hash(user.password_hash, data["password"]):
        return jsonify({"error": "invalid email or password"}), 401
    return issue_session(user)


@auth_bp.get("/me")
@require_user()
def me():
    return jsonify({"user": current_user().to_dict()})


@auth_bp.post("/logout")
@require_user()
def logout():
    raw = request.cookies.get("session_token")
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        raw = header[7:]
    if raw:
        session = db.session.get(Session, hash_token(raw))
        if session:
            db.session.delete(session)
            db.session.commit()
    response = make_response(jsonify({"status": "signed_out"}))
    response.delete_cookie("session_token")
    return response
