"""GLASSWORK — Push notifications via Expo Push Service.

Sends remote push notifications to mobile devices using Expo's push API.
Tokens are stored in the `push_tokens` collection.

Notification preference keys (per user):
- new_alert            → triggered when a new alert is created
- new_project          → triggered when a new project is created
- log_approved         → triggered when the user's daily log is approved
- log_rejected         → triggered when the user's daily log is rejected
- incident_reported    → triggered when an incident is reported on a project
- budget_exceeded      → triggered when a project budget is exceeded
"""
from __future__ import annotations

import os
import logging
from datetime import datetime, timezone
from typing import Optional

from exponent_server_sdk import (
    DeviceNotRegisteredError,
    PushClient,
    PushMessage,
    PushServerError,
    PushTicketError,
)

logger = logging.getLogger("glasswork.notifications")

DEFAULT_NOTIF_PREFS: dict = {
    "new_alert": True,
    "new_project": True,
    "log_approved": True,
    "log_rejected": True,
    "incident_reported": True,
    "budget_exceeded": True,
}

PREF_KEYS = list(DEFAULT_NOTIF_PREFS.keys())


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


async def ensure_notification_indices(db) -> None:
    try:
        await db.push_tokens.create_index("user_id")
        await db.push_tokens.create_index("token", unique=True)
    except Exception as e:
        logger.warning(f"Could not create push_tokens indices: {e}")


async def register_push_token(db, user_id: str, company_id: str, token: str, platform: str) -> dict:
    """Register or update a push token for a user. Tokens are unique."""
    token = (token or "").strip()
    if not token:
        return {"ok": False, "reason": "empty_token"}
    # If an existing entry has this token for a different user, move ownership
    existing = await db.push_tokens.find_one({"token": token})
    if existing:
        await db.push_tokens.update_one(
            {"token": token},
            {"$set": {
                "user_id": user_id,
                "company_id": company_id,
                "platform": platform or existing.get("platform", "unknown"),
                "updated_at": _now_utc(),
            }},
        )
    else:
        await db.push_tokens.insert_one({
            "user_id": user_id,
            "company_id": company_id,
            "token": token,
            "platform": platform or "unknown",
            "created_at": _now_utc(),
            "updated_at": _now_utc(),
        })
    return {"ok": True}


async def unregister_push_token(db, token: str) -> dict:
    await db.push_tokens.delete_one({"token": token})
    return {"ok": True}


async def unregister_user_tokens(db, user_id: str) -> None:
    await db.push_tokens.delete_many({"user_id": user_id})


async def _resolve_recipients(
    db,
    *,
    company_id: str,
    preference_key: str,
    user_ids: Optional[list] = None,
    exclude_user_id: Optional[str] = None,
) -> list:
    """Return list of (user_id, token) tuples for users with the given preference enabled."""
    q: dict = {"company_id": company_id, "is_active": True}
    if user_ids is not None:
        q["id"] = {"$in": user_ids}
    if exclude_user_id:
        q["id"] = q.get("id", {})
        if isinstance(q["id"], dict):
            q["id"]["$ne"] = exclude_user_id
        else:
            q["id"] = {"$in": q["id"], "$ne": exclude_user_id}

    users = await db.users.find(q, {"_id": 0, "id": 1, "notification_preferences": 1}).to_list(2000)
    allowed_ids = []
    for u in users:
        prefs = u.get("notification_preferences") or {}
        # Default to True if pref missing
        if prefs.get(preference_key, DEFAULT_NOTIF_PREFS.get(preference_key, True)):
            allowed_ids.append(u["id"])
    if not allowed_ids:
        return []
    tokens_docs = await db.push_tokens.find(
        {"user_id": {"$in": allowed_ids}}, {"_id": 0, "user_id": 1, "token": 1}
    ).to_list(5000)
    return [(d["user_id"], d["token"]) for d in tokens_docs]


def _build_push_message(token: str, title: str, body: str, data: Optional[dict] = None) -> PushMessage:
    return PushMessage(
        to=token,
        title=title,
        body=body,
        data=data or {},
        sound="default",
        priority="high",
        channel_id="default",
    )


async def _send_messages(db, messages: list[PushMessage]) -> dict:
    """Send via Expo Push Service synchronously. Cleans up DeviceNotRegistered tokens."""
    if not messages:
        return {"sent": 0, "errors": 0}
    access_token = os.environ.get("EXPO_ACCESS_TOKEN")
    session = None
    if access_token:
        try:
            import requests as _requests
            session = _requests.Session()
            session.headers.update({"Authorization": f"Bearer {access_token}"})
        except Exception:
            session = None
    client = PushClient(session=session)
    sent = 0
    errors = 0
    # Expo allows batches of up to 100 messages per request
    BATCH = 100
    for i in range(0, len(messages), BATCH):
        chunk = messages[i:i + BATCH]
        try:
            tickets = client.publish_multiple(chunk)
        except PushServerError as e:
            logger.warning(f"PushServerError: {e}")
            errors += len(chunk)
            continue
        except Exception as e:
            logger.warning(f"Push send failed: {e}")
            errors += len(chunk)
            continue
        for msg, ticket in zip(chunk, tickets):
            try:
                ticket.validate_response()
                sent += 1
            except DeviceNotRegisteredError:
                # Cleanup invalid token
                try:
                    await db.push_tokens.delete_one({"token": msg.to})
                except Exception:
                    pass
                errors += 1
            except PushTicketError as e:
                logger.warning(f"PushTicketError for {msg.to[:20]}…: {e}")
                errors += 1
            except Exception as e:
                logger.warning(f"Unexpected push error: {e}")
                errors += 1
    return {"sent": sent, "errors": errors}


async def send_push(
    db,
    *,
    company_id: str,
    preference_key: str,
    title: str,
    body: str,
    data: Optional[dict] = None,
    user_ids: Optional[list] = None,
    exclude_user_id: Optional[str] = None,
) -> dict:
    """High-level helper: resolve recipients matching preference and send."""
    try:
        recipients = await _resolve_recipients(
            db,
            company_id=company_id,
            preference_key=preference_key,
            user_ids=user_ids,
            exclude_user_id=exclude_user_id,
        )
        if not recipients:
            return {"sent": 0, "errors": 0, "recipients": 0}
        messages = [_build_push_message(tok, title, body, data) for _uid, tok in recipients]
        result = await _send_messages(db, messages)
        result["recipients"] = len(recipients)
        return result
    except Exception as e:
        logger.exception(f"send_push failed: {e}")
        return {"sent": 0, "errors": 1, "recipients": 0, "error": str(e)}
