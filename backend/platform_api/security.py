from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from functools import wraps

from flask import g, jsonify, request

from .extensions import db
from .models import Session, User


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def current_user() -> User | None:
    if hasattr(g, "current_user"):
        return g.current_user
    token = request.cookies.get("session_token")
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        token = header[7:]
    if not token:
        g.current_user = None
        return None
    session = db.session.get(Session, hash_token(token))
    if not session:
        g.current_user = None
        return None
    expires = session.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires <= datetime.now(timezone.utc):
        db.session.delete(session)
        db.session.commit()
        g.current_user = None
        return None
    g.user_id = session.user_id
    g.current_user = session.user
    return session.user


def require_user(*roles: str):
    def decorator(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            user = current_user()
            if not user:
                return jsonify({"error": "authentication required"}), 401
            if roles and user.role not in roles:
                return jsonify({"error": "insufficient permissions"}), 403
            return view(*args, **kwargs)
        return wrapped
    return decorator


def team_member(team_id: str, user_id: str) -> bool:
    from .models import TeamMember
    return db.session.get(TeamMember, (team_id, user_id)) is not None

