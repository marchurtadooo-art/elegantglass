"""GLASSWORK push-notifications backend test suite.

Tests the new push-notification system endpoints against the live preview backend.
"""
import os
import sys
import time
import json
import requests
from typing import Optional

BASE = "https://site-glass-preview.preview.emergentagent.com/api"

TS = int(time.time())
ADMIN_EMAIL = f"admin-pushtest+{TS}@example.com"
ADMIN_PWD = "Admin1234!"
WORKER_EMAIL = f"worker-pushtest+{TS}@example.com"
WORKER_PWD = "Worker1234!"

passed = 0
failed = 0
failures: list = []
errors_500: list = []


def check(cond: bool, label: str, info: str = ""):
    global passed, failed
    if cond:
        passed += 1
        print(f"  ok  {label}")
    else:
        failed += 1
        failures.append(f"{label} :: {info}")
        print(f"  FAIL {label} :: {info}")


def req(method: str, path: str, token: Optional[str] = None, **kw):
    url = f"{BASE}{path}"
    headers = kw.pop("headers", {}) or {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        r = requests.request(method, url, headers=headers, timeout=30, **kw)
        if r.status_code >= 500:
            errors_500.append(f"{method} {path} -> {r.status_code}: {r.text[:300]}")
        return r
    except Exception as e:
        errors_500.append(f"{method} {path} -> EXC: {e}")
        raise


def headline(label: str):
    print(f"\n=== {label} ===")


# ----------------------------------------------------------
# Setup
# ----------------------------------------------------------
headline("Setup — register admin and create worker")

r = req("POST", "/auth/register", json={
    "name": "Admin Test",
    "email": ADMIN_EMAIL,
    "password": ADMIN_PWD,
    "company_name": "PushTest Co",
})
check(r.status_code == 200, "POST /auth/register admin -> 200", f"got {r.status_code}: {r.text[:200]}")
if r.status_code != 200:
    print("Cannot continue without admin token. Aborting.")
    sys.exit(1)
data = r.json()
admin_token = data["access_token"]
admin_user = data["user"]
admin_id = admin_user["id"]
check("notification_preferences" in admin_user,
      "register response includes notification_preferences", str(list(admin_user.keys())))
prefs = admin_user.get("notification_preferences") or {}
expected_defaults = {
    "new_alert": True, "new_project": True, "log_approved": True,
    "log_rejected": True, "incident_reported": True, "budget_exceeded": True,
}
check(prefs == expected_defaults,
      "admin default notification_preferences match exactly 6 keys all true",
      f"got {prefs}")

# Create worker (admin only)
r = req("POST", "/users", token=admin_token, json={
    "name": "Worker Test",
    "email": WORKER_EMAIL,
    "password": WORKER_PWD,
    "role": "WORKER",
})
check(r.status_code == 200, "POST /users worker (admin) -> 200", f"got {r.status_code}: {r.text[:200]}")
worker_user = r.json() if r.status_code == 200 else {}
worker_id = worker_user.get("id")
check(worker_user.get("notification_preferences") == expected_defaults,
      "worker default notification_preferences match defaults",
      f"got {worker_user.get('notification_preferences')}")

# Login as worker
r = req("POST", "/auth/login", json={"email": WORKER_EMAIL, "password": WORKER_PWD})
check(r.status_code == 200, "POST /auth/login worker -> 200", f"{r.status_code}: {r.text[:200]}")
worker_token = r.json()["access_token"] if r.status_code == 200 else None


# ----------------------------------------------------------
# 1) /auth/me default prefs
# ----------------------------------------------------------
headline("1) GET /auth/me default prefs")
r = req("GET", "/auth/me", token=admin_token)
check(r.status_code == 200, "GET /auth/me admin -> 200", str(r.status_code))
me = r.json() if r.status_code == 200 else {}
check(me.get("notification_preferences") == expected_defaults,
      "/auth/me admin prefs match defaults",
      f"got {me.get('notification_preferences')}")


# ----------------------------------------------------------
# 2) PATCH /api/profile/notifications
# ----------------------------------------------------------
headline("2) PATCH /profile/notifications")
r = req("PATCH", "/profile/notifications", token=admin_token,
        json={"new_alert": False, "log_rejected": False})
check(r.status_code == 200, "PATCH prefs -> 200", str(r.status_code))
patched_prefs = r.json().get("notification_preferences") if r.status_code == 200 else {}
expected_after = {
    "new_alert": False, "new_project": True, "log_approved": True,
    "log_rejected": False, "incident_reported": True, "budget_exceeded": True,
}
check(patched_prefs == expected_after,
      "patched prefs reflect change",
      f"got {patched_prefs}")

r = req("GET", "/auth/me", token=admin_token)
check(r.status_code == 200 and r.json().get("notification_preferences") == expected_after,
      "/auth/me reflects patched prefs", f"got {r.json().get('notification_preferences')}")

# PATCH {} -> leaves unchanged
r = req("PATCH", "/profile/notifications", token=admin_token, json={})
check(r.status_code == 200, "PATCH {} -> 200", str(r.status_code))
check(r.json().get("notification_preferences") == expected_after,
      "PATCH {} leaves prefs unchanged",
      f"got {r.json().get('notification_preferences')}")

# PATCH {budget_exceeded: true}
r = req("PATCH", "/profile/notifications", token=admin_token, json={"budget_exceeded": True})
check(r.status_code == 200 and r.json().get("notification_preferences", {}).get("budget_exceeded") is True,
      "PATCH {budget_exceeded:true} updates only that key",
      f"got {r.json().get('notification_preferences')}")
ret = r.json().get("notification_preferences", {})
check(ret == expected_after, "other prefs unchanged", f"got {ret}")


# ----------------------------------------------------------
# 3) POST /api/push-token
# ----------------------------------------------------------
headline("3) POST /push-token")
admin_pt = "ExponentPushToken[FAKE_ADMIN_TEST_123]"
worker_pt = "ExponentPushToken[FAKE_WORKER_TEST_456]"

r = req("POST", "/push-token", token=admin_token, json={"token": admin_pt, "platform": "ios"})
check(r.status_code == 200 and r.json().get("ok") is True,
      "admin POST /push-token ios -> 200 ok:true",
      f"{r.status_code}: {r.text[:200]}")

r = req("POST", "/push-token", token=worker_token, json={"token": worker_pt, "platform": "android"})
check(r.status_code == 200 and r.json().get("ok") is True,
      "worker POST /push-token android -> 200 ok:true",
      f"{r.status_code}: {r.text[:200]}")

# Re-POST same admin token (idempotent)
r = req("POST", "/push-token", token=admin_token, json={"token": admin_pt, "platform": "android"})
check(r.status_code == 200 and r.json().get("ok") is True,
      "re-POST same admin token -> 200 idempotent",
      f"{r.status_code}: {r.text[:200]}")

# Empty token
r = req("POST", "/push-token", token=admin_token, json={"token": "", "platform": "ios"})
ok_empty = (r.status_code == 200 and r.json().get("ok") is False and r.json().get("reason") == "empty_token") \
    or r.status_code in (400, 422)
check(ok_empty,
      "empty token -> {ok:false,reason:empty_token} or 4xx (not 500)",
      f"{r.status_code}: {r.text[:200]}")

# Missing token field -> 422
r = req("POST", "/push-token", token=admin_token, json={"platform": "ios"})
check(r.status_code in (200, 400, 422),
      "missing token field -> 4xx or 200 ok:false (not 500)",
      f"{r.status_code}: {r.text[:200]}")

# Without auth
r = req("POST", "/push-token", json={"token": "ExponentPushToken[NOAUTH]", "platform": "ios"})
check(r.status_code in (401, 403),
      "POST /push-token without auth -> 401",
      f"{r.status_code}: {r.text[:200]}")


# ----------------------------------------------------------
# 4) DELETE /api/push-token
# ----------------------------------------------------------
headline("4) DELETE /push-token")
r = req("DELETE", "/push-token", token=admin_token, json={"token": admin_pt})
check(r.status_code == 200 and r.json().get("ok") is True,
      "DELETE existing admin token -> 200",
      f"{r.status_code}: {r.text[:200]}")

r = req("DELETE", "/push-token", token=admin_token,
        json={"token": "ExponentPushToken[DOES_NOT_EXIST_XYZ]"})
check(r.status_code == 200 and r.json().get("ok") is True,
      "DELETE non-existent token -> 200 idempotent",
      f"{r.status_code}: {r.text[:200]}")

r = requests.delete(f"{BASE}/push-token", json={"token": "x"}, timeout=30)
check(r.status_code in (401, 403),
      "DELETE without auth -> 401",
      f"{r.status_code}: {r.text[:200]}")

# Re-register admin token
r = req("POST", "/push-token", token=admin_token, json={"token": admin_pt, "platform": "ios"})
check(r.status_code == 200, "re-register admin push token", str(r.status_code))


# ----------------------------------------------------------
# 5) POST /api/alerts
# ----------------------------------------------------------
headline("5) POST /alerts")

r = req("POST", "/projects", token=admin_token, json={
    "name": "Obra Push Test", "address": "Calle Test 1",
})
check(r.status_code == 200, "POST /projects -> 200", f"{r.status_code}: {r.text[:200]}")
project_id = r.json()["id"] if r.status_code == 200 else None

r = req("POST", "/alerts", token=admin_token, json={
    "type": "INCIDENT_REPORTED",
    "severity": "CRITICAL",
    "message": "Fuga importante en obra",
    "project_id": project_id,
})
check(r.status_code == 200, "admin POST /alerts -> 200", f"{r.status_code}: {r.text[:300]}")
alert = r.json() if r.status_code == 200 else {}
for f in ("id", "type", "severity", "message", "project_id", "is_read", "created_by", "created_at"):
    check(f in alert, f"alert response includes '{f}'", f"got keys {list(alert.keys())}")
check(alert.get("is_read") is False, "alert is_read=false", str(alert.get("is_read")))
check(alert.get("created_by") == admin_id, "alert created_by == admin.id",
      f"{alert.get('created_by')} vs {admin_id}")
alert_id = alert.get("id")

# Worker forbidden
r = req("POST", "/alerts", token=worker_token, json={
    "type": "INCIDENT_REPORTED", "severity": "CRITICAL",
    "message": "Fuga importante en obra", "project_id": project_id,
})
check(r.status_code == 403, "worker POST /alerts -> 403", f"{r.status_code}: {r.text[:200]}")

# Missing project_id -> 422
r = req("POST", "/alerts", token=admin_token, json={
    "type": "INCIDENT_REPORTED", "severity": "CRITICAL", "message": "Sin obra",
})
check(r.status_code == 422, "missing project_id -> 422", f"{r.status_code}: {r.text[:200]}")

# project_id invalid -> 404
r = req("POST", "/alerts", token=admin_token, json={
    "type": "INCIDENT_REPORTED", "severity": "CRITICAL",
    "message": "Mensaje suficientemente largo", "project_id": "nope",
})
check(r.status_code == 404, "invalid project_id -> 404", f"{r.status_code}: {r.text[:200]}")
check("Obra no encontrada" in r.text, "404 detail 'Obra no encontrada'", r.text[:200])

# Short message -> 400
r = req("POST", "/alerts", token=admin_token, json={
    "type": "INCIDENT_REPORTED", "severity": "WARNING",
    "message": "ab", "project_id": project_id,
})
check(r.status_code == 400, "message='ab' -> 400", f"{r.status_code}: {r.text[:200]}")
check("obligator" in r.text.lower() or "mensaje" in r.text.lower(),
      "400 detail mentions mensaje obligatorio", r.text[:200])

# GET /alerts contains it
r = req("GET", "/alerts", token=admin_token)
check(r.status_code == 200, "GET /alerts admin -> 200", str(r.status_code))
alerts_list = r.json() if r.status_code == 200 else []
found = next((a for a in alerts_list if a.get("id") == alert_id), None)
check(found is not None, "created alert appears in /alerts", f"{len(alerts_list)} alerts")


# ----------------------------------------------------------
# 6) Worker access
# ----------------------------------------------------------
headline("6) Worker /alerts access")
r = req("GET", "/alerts", token=worker_token)
check(r.status_code == 200, "worker GET /alerts -> 200", f"{r.status_code}: {r.text[:200]}")
worker_alerts = r.json() if r.status_code == 200 else []
check(len(worker_alerts) >= 1, "worker sees at least 1 alert", f"got {len(worker_alerts)}")

r = req("PATCH", f"/alerts/{alert_id}/read", token=worker_token)
check(r.status_code == 200 and r.json().get("ok") is True,
      "worker PATCH /alerts/{id}/read -> 200",
      f"{r.status_code}: {r.text[:200]}")

r = req("GET", "/alerts", token=worker_token)
found = next((a for a in r.json() if a.get("id") == alert_id), None) if r.status_code == 200 else None
check(found is not None and found.get("is_read") is True,
      "alert now is_read=true", str(found))


# ----------------------------------------------------------
# 7) Push trigger endpoints don't crash
# ----------------------------------------------------------
headline("7) Push trigger endpoints")
r = req("POST", "/projects", token=admin_token, json={
    "name": "Obra Trigger 2", "address": "Calle Trigger 2",
})
check(r.status_code == 200, "POST /projects again -> 200 (push swallowed)",
      f"{r.status_code}: {r.text[:200]}")
proj2 = r.json().get("id") if r.status_code == 200 else None

log_id_1 = None
log_id_2 = None
r = req("POST", "/daily-logs", token=admin_token, json={
    "project_id": project_id,
    "hours_worked": 8,
    "work_description": "Trabajo realizado con incidente grave, instalación de marcos y montaje.",
    "weather_condition": "SUNNY",
    "progress_percentage": 25,
    "incidents": "Algo grave pasó",
})
check(r.status_code == 200, "POST /daily-logs with incidents -> 200",
      f"{r.status_code}: {r.text[:300]}")
if r.status_code == 200:
    log_id_1 = r.json().get("id")

r = req("POST", "/daily-logs", token=admin_token, json={
    "project_id": project_id,
    "hours_worked": 4,
    "work_description": "Trabajo realizado sin incidentes, simple instalación rutinaria de juntas.",
    "weather_condition": "CLOUDY",
    "progress_percentage": 30,
})
check(r.status_code == 200, "POST /daily-logs no incidents -> 200",
      f"{r.status_code}: {r.text[:300]}")
if r.status_code == 200:
    log_id_2 = r.json().get("id")

if log_id_1:
    r = req("PATCH", f"/daily-logs/{log_id_1}/review", token=admin_token,
            json={"status": "APPROVED"})
    check(r.status_code == 200, "PATCH review APPROVED -> 200",
          f"{r.status_code}: {r.text[:200]}")

if log_id_2:
    r = req("PATCH", f"/daily-logs/{log_id_2}/review", token=admin_token,
            json={"status": "REJECTED", "review_comment": "corregir"})
    check(r.status_code == 200, "PATCH review REJECTED -> 200",
          f"{r.status_code}: {r.text[:200]}")

r = req("POST", "/alerts", token=admin_token, json={
    "type": "BUDGET_EXCEEDED", "severity": "WARNING",
    "message": "Presupuesto excedido en revisión", "project_id": project_id,
})
check(r.status_code == 200, "POST /alerts again -> 200", f"{r.status_code}: {r.text[:200]}")


# ----------------------------------------------------------
# 8) Audit logs
# ----------------------------------------------------------
headline("8) Audit logs")
r = req("GET", "/security/audit-logs", token=admin_token)
check(r.status_code == 200, "GET /security/audit-logs admin -> 200",
      f"{r.status_code}: {r.text[:200]}")
audit = r.json() if r.status_code == 200 else []
actions = {a.get("action") for a in audit if isinstance(a, dict)}
check("ALERT_CREATE" in actions, "audit contains ALERT_CREATE", f"actions={actions}")
check("PROJECT_CREATE" in actions, "audit contains PROJECT_CREATE", f"actions={actions}")


# ----------------------------------------------------------
# Report
# ----------------------------------------------------------
total = passed + failed
print("\n" + "=" * 60)
print(f"RESULT: {passed}/{total} passed ({failed} failed)")
print("=" * 60)

if failures:
    print("\nFAILURES:")
    for f in failures:
        print(f"  - {f}")

if errors_500:
    print("\n500-LEVEL ERRORS:")
    for e in errors_500:
        print(f"  - {e}")
else:
    print("\nNo 500 errors observed.")

print(f"\nAdmin: {ADMIN_EMAIL} / {ADMIN_PWD}")
print(f"Worker: {WORKER_EMAIL} / {WORKER_PWD}")

sys.exit(0 if failed == 0 else 1)
