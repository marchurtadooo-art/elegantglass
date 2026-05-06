"""
Security layer for GLASSWORK API.

Adds:
1. Login lockout — 5 failed attempts ⇒ 15-minute block per email.
2. Token blacklist — logout invalidates tokens, checked on each authenticated request.
3. Audit logs — login/logout, project create/delete, warehouse moves, role changes.
4. Session inactivity — access token is rejected if not used in last 30 minutes.
5. HTTP security headers middleware.

This module is intentionally **independent** from the business logic. It only
exposes helper functions that are called from `server.py` at the right places.
"""
from __future__ import annotations
import os
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response


# ============================================================
# Tunables (overridable via env)
# ============================================================
LOGIN_MAX_ATTEMPTS = int(os.environ.get("LOGIN_MAX_ATTEMPTS", "5") or 5)
LOGIN_BLOCK_MINUTES = int(os.environ.get("LOGIN_BLOCK_MINUTES", "15") or 15)
SESSION_IDLE_MINUTES = int(os.environ.get("SESSION_IDLE_MINUTES", "30") or 30)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def get_client_ip(request: Optional[Request]) -> str:
    """Extract real client IP, honouring X-Forwarded-For when behind a proxy."""
    if request is None:
        return "unknown"
    xff = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
    if xff:
        # First entry in the comma-separated list is the original client
        return xff.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def hash_token(token: str) -> str:
    """SHA-256 hash, used for blacklist storage so we never persist raw tokens."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# ============================================================
# 1. LOGIN LOCKOUT
# ============================================================
async def is_login_blocked(db, email: str) -> tuple[bool, int]:
    """Check if `email` is currently blocked.

    Returns (blocked, remaining_minutes).
    A user is blocked when they have ≥ LOGIN_MAX_ATTEMPTS failed attempts
    in the last LOGIN_BLOCK_MINUTES minutes.
    """
    cutoff = now_utc() - timedelta(minutes=LOGIN_BLOCK_MINUTES)
    fails = await db.login_attempts.find(
        {"email": email, "success": False, "timestamp": {"$gte": cutoff}}
    ).sort("timestamp", -1).to_list(LOGIN_MAX_ATTEMPTS + 5)
    if len(fails) < LOGIN_MAX_ATTEMPTS:
        return (False, 0)
    # Take the LOGIN_MAX_ATTEMPTS-th most recent failure → block window starts there
    nth_failure = fails[LOGIN_MAX_ATTEMPTS - 1]["timestamp"]
    if isinstance(nth_failure, str):
        nth_failure = datetime.fromisoformat(nth_failure.replace("Z", "+00:00"))
    if nth_failure.tzinfo is None:
        nth_failure = nth_failure.replace(tzinfo=timezone.utc)
    elapsed = (now_utc() - nth_failure).total_seconds() / 60.0
    if elapsed >= LOGIN_BLOCK_MINUTES:
        return (False, 0)
    remaining = max(int(LOGIN_BLOCK_MINUTES - elapsed) + 1, 1)
    return (True, remaining)


async def record_login_attempt(db, email: str, ip: str, success: bool) -> None:
    await db.login_attempts.insert_one({
        "email": email,
        "ip": ip,
        "success": success,
        "timestamp": now_utc(),
    })


async def reset_login_attempts(db, email: str) -> None:
    """Clear failed attempts for this email after a successful login."""
    await db.login_attempts.delete_many({"email": email, "success": False})


# ============================================================
# 2. TOKEN BLACKLIST + 4. SESSION INACTIVITY
# ============================================================
async def register_session(db, jti: str, user_id: str, exp_dt: datetime, ip: str) -> None:
    """Register a freshly issued access token so we can track its inactivity."""
    await db.token_sessions.insert_one({
        "jti": jti,
        "user_id": user_id,
        "ip": ip,
        "issued_at": now_utc(),
        "last_used": now_utc(),
        "exp": exp_dt,
    })


async def touch_session(db, jti: str) -> Optional[dict]:
    """Update last_used to now. Returns the (pre-update) session document.
    If the session doesn't exist (stale token from before this layer was deployed),
    we transparently create one — we never want to break existing sessions when
    upgrading.
    """
    doc = await db.token_sessions.find_one({"jti": jti})
    if doc is None:
        return None
    await db.token_sessions.update_one({"jti": jti}, {"$set": {"last_used": now_utc()}})
    return doc


async def is_session_idle(session: dict) -> tuple[bool, int]:
    """Returns (idle, idle_minutes) — True if session inactive > SESSION_IDLE_MINUTES."""
    last = session.get("last_used") or session.get("issued_at")
    if last is None:
        return (False, 0)
    if isinstance(last, str):
        last = datetime.fromisoformat(last.replace("Z", "+00:00"))
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    idle_minutes = (now_utc() - last).total_seconds() / 60.0
    return (idle_minutes > SESSION_IDLE_MINUTES, int(idle_minutes))


async def blacklist_token(db, token: str, jti: Optional[str], exp: Optional[datetime]) -> None:
    """Add a token to the blacklist. Stores SHA-256 hash + jti + expiry."""
    await db.token_blacklist.update_one(
        {"token_hash": hash_token(token)},
        {"$set": {
            "token_hash": hash_token(token),
            "jti": jti,
            "exp": exp,
            "revoked_at": now_utc(),
        }},
        upsert=True,
    )
    # Also remove the active session so it can't be reused
    if jti:
        await db.token_sessions.delete_one({"jti": jti})


async def is_token_blacklisted(db, token: str) -> bool:
    doc = await db.token_blacklist.find_one({"token_hash": hash_token(token)})
    return doc is not None


async def cleanup_expired_security_records(db) -> dict:
    """Cleanup expired blacklist entries, idle/expired sessions, old login_attempts.
    Designed to run on startup — fire-and-forget if it fails."""
    now = now_utc()
    blk = await db.token_blacklist.delete_many({"exp": {"$lt": now}})
    # Remove sessions that already expired or are idle beyond threshold
    idle_cutoff = now - timedelta(minutes=SESSION_IDLE_MINUTES)
    sess = await db.token_sessions.delete_many({"$or": [
        {"exp": {"$lt": now}},
        {"last_used": {"$lt": idle_cutoff}},
    ]})
    # Keep audit logs forever (compliance), but trim login_attempts older than 30 days
    cutoff_logs = now - timedelta(days=30)
    att = await db.login_attempts.delete_many({"timestamp": {"$lt": cutoff_logs}})
    return {
        "blacklist_purged": blk.deleted_count,
        "sessions_purged": sess.deleted_count,
        "login_attempts_purged": att.deleted_count,
    }


# ============================================================
# 3. AUDIT LOG
# ============================================================
async def audit_log(
    db,
    *,
    action: str,
    resource: Optional[str] = None,
    resource_id: Optional[str] = None,
    request: Optional[Request] = None,
    user: Optional[dict] = None,
    user_id: Optional[str] = None,
    user_email: Optional[str] = None,
    user_role: Optional[str] = None,
    company_id: Optional[str] = None,
    extra: Optional[dict] = None,
    success: bool = True,
) -> None:
    """Insert a single audit log entry. Never raises — auditing must never block business flow."""
    try:
        ip = get_client_ip(request)
        ua = request.headers.get("user-agent", "")[:300] if request else ""
        path = str(request.url.path) if request else None
        method = request.method if request else None
        if user is not None:
            user_id = user.get("id") or user_id
            user_email = user.get("email") or user_email
            user_role = user.get("role") or user_role
            company_id = user.get("company_id") or company_id
        entry = {
            "action": action,
            "resource": resource,
            "resource_id": resource_id,
            "user_id": user_id,
            "user_email": user_email,
            "user_role": user_role,
            "company_id": company_id,
            "ip": ip,
            "user_agent": ua,
            "path": path,
            "method": method,
            "success": success,
            "extra": extra or {},
            "timestamp": now_utc(),
        }
        await db.audit_logs.insert_one(entry)
    except Exception:
        # Never let audit failures break the endpoint
        pass


# ============================================================
# 5. SECURITY HEADERS MIDDLEWARE
# ============================================================
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds standard security headers to every response."""
    async def dispatch(self, request: Request, call_next) -> Response:
        # Stash IP early so endpoints / dependencies can read request.state.client_ip
        try:
            request.state.client_ip = get_client_ip(request)
        except Exception:
            request.state.client_ip = "unknown"
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
        return response


# ============================================================
# Indices (call once at startup)
# ============================================================
async def ensure_security_indices(db) -> None:
    try:
        await db.login_attempts.create_index("email")
        await db.login_attempts.create_index("timestamp")
        await db.token_blacklist.create_index("token_hash", unique=True)
        await db.token_blacklist.create_index("exp")
        await db.token_sessions.create_index("jti", unique=True)
        await db.token_sessions.create_index("last_used")
        await db.audit_logs.create_index("timestamp")
        await db.audit_logs.create_index([("user_id", 1), ("timestamp", -1)])
        await db.audit_logs.create_index([("action", 1), ("timestamp", -1)])
    except Exception:
        pass
