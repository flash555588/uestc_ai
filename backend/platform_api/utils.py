from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from flask import g, jsonify, request

from .extensions import db
from .models import AuditLog


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def uid() -> str:
    return str(uuid.uuid4())


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def new_token() -> tuple[str, str]:
    token = secrets.token_urlsafe(32)
    return token, token_hash(token)


def expires_in(days: int = 14) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


def audit(action: str, entity_type: str, entity_id: str, details=None, actor_id=None) -> None:
    db.session.add(AuditLog(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        actor_id=actor_id or getattr(g, "user_id", None),
        details=details or {},
    ))


def payload(required=()):
    data = request.get_json(silent=True) or {}
    missing = [key for key in required if not str(data.get(key, "")).strip()]
    if missing:
        return None, (jsonify({"error": "missing required fields", "fields": missing}), 400)
    return data, None
