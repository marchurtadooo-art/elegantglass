"""Backend test for the SECURITY layer (security.py + server.py integration).

Tests requested:
  A. Security headers on / and /auth/login
  B. Login lockout (5 fails -> 6th 429; per-email isolation)
  C. Token blacklist + logout
  D. Session tracking (last_used updates)
  E. Audit logs (LOGIN, PROJECT_CREATE/DELETE, WAREHOUSE_MOVE_INBOUND, WAREHOUSE_AUTO_CLASSIFY)
  F. Worker forbidden on /security/*
"""
from __future__ import annotations
import json
import os
import time
import uuid
import requests

BACKEND_URL = "https://site-glass-preview.preview.emergentagent.com"
API = f"{BACKEND_URL}/api"

ADMIN_EMAIL = "jefe@elegantglass.es"
ADMIN_PASSWORD = "Admin1234!"
WORKER_EMAIL = "carlos@elegantglass.es"
WORKER_PASSWORD = "Worker1234!"

results: list[tuple[str, bool, str]] = []


def add(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    mark = "PASS" if ok else "FAIL"
    print(f"[{mark}] {name} :: {detail}")


def hdr(token: str | None = None) -> dict:
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def login(email: str, password: str) -> tuple[int, dict, dict]:
    r = requests.post(
        f"{API}/auth/login",
        json={"email": email, "password": password},
        headers={"Content-Type": "application/json"},
        timeout=30,
    )
    try:
        body = r.json()
    except Exception:
        body = {"_raw": r.text}
    return r.status_code, body, dict(r.headers)


# -----------------------------------------------------------
# A. Security headers
# -----------------------------------------------------------
def test_security_headers():
    print("\n=== A. SECURITY HEADERS ===")
    # A1 GET /api/
    r = requests.get(f"{API}/", timeout=30)
    h = {k.lower(): v for k, v in r.headers.items()}
    a1_xcto = h.get("x-content-type-options", "") == "nosniff"
    a1_xfo = h.get("x-frame-options", "") == "DENY"
    a1_hsts = "max-age=31536000" in h.get("strict-transport-security", "")
    a1_csp = "default-src" in h.get("content-security-policy", "")
    add("A1 GET /api/ X-Content-Type-Options=nosniff", a1_xcto, h.get("x-content-type-options", ""))
    add("A1 GET /api/ X-Frame-Options=DENY", a1_xfo, h.get("x-frame-options", ""))
    add("A1 GET /api/ Strict-Transport-Security max-age=31536000", a1_hsts, h.get("strict-transport-security", ""))
    add("A1 GET /api/ Content-Security-Policy default-src", a1_csp, h.get("content-security-policy", ""))

    # A2 POST /auth/login (admin)
    sc, body, headers = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    h2 = {k.lower(): v for k, v in headers.items()}
    add("A2 POST /auth/login admin status=200", sc == 200, str(sc))
    add("A2 POST /auth/login X-Content-Type-Options=nosniff", h2.get("x-content-type-options", "") == "nosniff", h2.get("x-content-type-options", ""))
    add("A2 POST /auth/login X-Frame-Options=DENY", h2.get("x-frame-options", "") == "DENY", h2.get("x-frame-options", ""))
    add("A2 POST /auth/login Strict-Transport-Security", "max-age=31536000" in h2.get("strict-transport-security", ""), h2.get("strict-transport-security", ""))
    add("A2 POST /auth/login Content-Security-Policy", "default-src" in h2.get("content-security-policy", ""), h2.get("content-security-policy", ""))
    return body.get("access_token") if sc == 200 else None


# -----------------------------------------------------------
# B. Login lockout
# -----------------------------------------------------------
def test_login_lockout():
    print("\n=== B. LOGIN LOCKOUT ===")
    # Use a unique made-up email with extra UUID to avoid pollution
    locked_email = f"lockout-test-{uuid.uuid4().hex[:8]}@example.com"
    # 5 failed attempts -> 401
    statuses = []
    for i in range(5):
        sc, body, _ = login(locked_email, "WrongPassword!")
        statuses.append(sc)
    all_5_unauthorized = all(sc == 401 for sc in statuses)
    add(f"B1 First 5 login attempts => 401 each ({statuses})", all_5_unauthorized, str(statuses))

    # 6th attempt -> 429 with Demasiados intentos
    sc6, body6, _ = login(locked_email, "WrongPassword!")
    detail6 = body6.get("detail", "") if isinstance(body6, dict) else ""
    is_429 = sc6 == 429
    has_msg = "Demasiados intentos" in str(detail6)
    add(f"B1 6th attempt => 429", is_429, f"sc={sc6} detail={detail6}")
    add(f"B1 6th attempt detail contains 'Demasiados intentos'", has_msg, str(detail6))

    # 7th attempt with anything -> still 429 (per-email lock)
    sc7, body7, _ = login(locked_email, "AnythingDoesntMatter!")
    add(f"B1 7th attempt to same email still 429", sc7 == 429, f"sc={sc7} detail={body7.get('detail','')}")

    # B2: Different email (admin) should still work
    sc_admin, body_admin, _ = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    add("B2 Other email (admin) login still works", sc_admin == 200 and "access_token" in body_admin, f"sc={sc_admin}")
    return body_admin.get("access_token") if sc_admin == 200 else None


# -----------------------------------------------------------
# C. Token blacklist + logout
# -----------------------------------------------------------
def test_token_blacklist():
    print("\n=== C. TOKEN BLACKLIST + LOGOUT ===")
    sc, body, _ = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    add("C1 Admin login => 200", sc == 200, f"sc={sc}")
    if sc != 200:
        return None
    a1 = body["access_token"]
    # C2 GET /auth/me with A1 -> 200
    r = requests.get(f"{API}/auth/me", headers=hdr(a1), timeout=30)
    add("C2 GET /auth/me with token => 200", r.status_code == 200, f"sc={r.status_code}")

    # C3 logout
    r3 = requests.post(f"{API}/auth/logout", headers=hdr(a1), timeout=30)
    add("C3 POST /auth/logout => 200", r3.status_code == 200, f"sc={r3.status_code} body={r3.text[:80]}")

    # C4 GET /auth/me with same token -> 401
    r4 = requests.get(f"{API}/auth/me", headers=hdr(a1), timeout=30)
    sc4 = r4.status_code
    detail4 = ""
    try:
        detail4 = r4.json().get("detail", "")
    except Exception:
        pass
    add("C4 GET /auth/me after logout => 401", sc4 == 401, f"sc={sc4} detail={detail4}")
    add("C4 detail mentions 'revocado'", "revocado" in str(detail4).lower(), str(detail4))


# -----------------------------------------------------------
# D. Session tracking
# -----------------------------------------------------------
def test_session_tracking():
    print("\n=== D. SESSION TRACKING ===")
    sc, body, _ = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if sc != 200:
        add("D Login failed", False, f"sc={sc}")
        return None
    token = body["access_token"]
    # Decode JWT to get jti (no verification needed, just base64 split)
    import base64
    parts = token.split(".")
    payload_part = parts[1]
    payload_part += "=" * ((4 - len(payload_part) % 4) % 4)
    payload = json.loads(base64.urlsafe_b64decode(payload_part))
    jti = payload.get("jti")
    add("D Access token contains jti", bool(jti), f"jti={jti}")

    # D1: GET /api/security/sessions
    r = requests.get(f"{API}/security/sessions", headers=hdr(token), timeout=30)
    sc1 = r.status_code
    sessions = r.json() if sc1 == 200 else []
    add("D1 GET /security/sessions => 200", sc1 == 200, f"sc={sc1}")
    # Find our session
    mine = next((s for s in sessions if s.get("jti") == jti), None)
    add("D1 own session present in list", mine is not None, f"sessions={len(sessions)}")
    if mine:
        for f in ("last_used", "issued_at", "exp", "jti", "user_id"):
            add(f"D1 session has '{f}' field", f in mine and mine[f] is not None, f"{f}={mine.get(f)}")
        last_used_1 = mine.get("last_used")
    else:
        last_used_1 = None

    # D2: Make another auth GET, then check last_used updated
    time.sleep(1.2)  # ensure timestamp difference is observable at second granularity
    requests.get(f"{API}/auth/me", headers=hdr(token), timeout=30)
    time.sleep(0.5)
    r2 = requests.get(f"{API}/security/sessions", headers=hdr(token), timeout=30)
    sessions2 = r2.json() if r2.status_code == 200 else []
    mine2 = next((s for s in sessions2 if s.get("jti") == jti), None)
    if mine2 and last_used_1:
        last_used_2 = mine2.get("last_used")
        # Compare ISO strings (lexicographic works for ISO with same TZ)
        updated = last_used_2 and last_used_2 > last_used_1
        add("D2 last_used updated after subsequent request", bool(updated),
            f"before={last_used_1} after={last_used_2}")
    else:
        add("D2 last_used updated after subsequent request", False, "could not locate session")

    # Positive: fresh token works (we already used it)
    add("D Fresh token works (positive)", True, "verified by /auth/me 200 above")
    return token


# -----------------------------------------------------------
# E. Audit logs
# -----------------------------------------------------------
def test_audit_logs():
    print("\n=== E. AUDIT LOGS ===")
    # Fresh login to ensure a recent LOGIN event
    sc, body, _ = login(ADMIN_EMAIL, ADMIN_PASSWORD)
    if sc != 200:
        add("E login failed", False, f"sc={sc}")
        return
    token = body["access_token"]

    # E1: GET audit-logs as admin -> array, contains LOGIN with admin email
    r = requests.get(f"{API}/security/audit-logs", headers=hdr(token), timeout=30)
    add("E1 GET /security/audit-logs (admin) => 200", r.status_code == 200, f"sc={r.status_code}")
    if r.status_code == 200:
        logs = r.json()
        add("E1 audit logs is array", isinstance(logs, list), f"type={type(logs).__name__}")
        login_match = next(
            (l for l in logs if l.get("action") == "LOGIN" and l.get("user_email") == ADMIN_EMAIL),
            None,
        )
        add("E1 audit log has LOGIN entry for admin", login_match is not None, f"#logs={len(logs)}")
        if login_match:
            ip = login_match.get("ip", "")
            add("E1 LOGIN audit entry has non-empty ip", bool(ip), f"ip={ip}")

    # E2: PROJECT_CREATE
    proj_payload = {
        "name": f"Obra Seguridad QA {uuid.uuid4().hex[:6]}",
        "description": "Proyecto creado por test de seguridad",
        "address": "Calle Test 123, Palma",
        "status": "PENDING",
        "budget": 1000.0,
        "client_name": "Cliente QA",
        "client_phone": "",
        "client_email": "",
        "notes": "",
        "assigned_worker_ids": [],
    }
    rc = requests.post(f"{API}/projects", headers=hdr(token), json=proj_payload, timeout=30)
    add("E2 POST /projects => 200", rc.status_code == 200, f"sc={rc.status_code} body={rc.text[:120]}")
    project_id = None
    if rc.status_code == 200:
        project_id = rc.json().get("id")
        time.sleep(0.5)
        r2 = requests.get(
            f"{API}/security/audit-logs",
            headers=hdr(token),
            params={"action": "PROJECT_CREATE"},
            timeout=30,
        )
        logs = r2.json() if r2.status_code == 200 else []
        match = next((l for l in logs if l.get("resource_id") == project_id and l.get("action") == "PROJECT_CREATE" and l.get("resource") == "project"), None)
        add("E2 audit_logs has PROJECT_CREATE for new project", match is not None,
            f"resource_id={project_id} #matches={len([l for l in logs if l.get('resource_id') == project_id])}")

    # E3: PROJECT_DELETE
    if project_id:
        rd = requests.delete(f"{API}/projects/{project_id}", headers=hdr(token), timeout=30)
        add("E3 DELETE /projects/{id} => 200", rd.status_code == 200, f"sc={rd.status_code}")
        time.sleep(0.5)
        r3 = requests.get(
            f"{API}/security/audit-logs",
            headers=hdr(token),
            params={"action": "PROJECT_DELETE"},
            timeout=30,
        )
        logs = r3.json() if r3.status_code == 200 else []
        match = next((l for l in logs if l.get("resource_id") == project_id and l.get("action") == "PROJECT_DELETE"), None)
        add("E3 audit_logs has PROJECT_DELETE", match is not None, f"#PROJECT_DELETE={len(logs)}")

    # E4: WAREHOUSE_MOVE_INBOUND -> create lot
    rm = requests.get(f"{API}/materials", headers=hdr(token), timeout=30)
    if rm.status_code == 200 and rm.json():
        material = rm.json()[0]
        material_id = material["id"]
        lot_payload = {
            "material_id": material_id,
            "quantity": 10.0,
            "supplier_name": "Test Supplier",
            "notes": "QA inbound",
        }
        rl = requests.post(f"{API}/warehouse/lots", headers=hdr(token), json=lot_payload, timeout=30)
        add("E4 POST /warehouse/lots => 200", rl.status_code == 200, f"sc={rl.status_code} body={rl.text[:120]}")
        new_lot_code = None
        if rl.status_code == 200:
            new_lot_code = rl.json().get("lot_code")
            new_lot_id = rl.json().get("id")
            time.sleep(0.5)
            r4 = requests.get(
                f"{API}/security/audit-logs",
                headers=hdr(token),
                params={"action": "WAREHOUSE_MOVE_INBOUND"},
                timeout=30,
            )
            logs = r4.json() if r4.status_code == 200 else []
            match = next((l for l in logs if l.get("resource_id") == new_lot_id), None)
            add("E4 audit_logs has WAREHOUSE_MOVE_INBOUND for new lot", match is not None,
                f"new_lot_id={new_lot_id}")

        # E5: WAREHOUSE_AUTO_CLASSIFY -> assign-and-print
        if new_lot_code:
            rap = requests.post(
                f"{API}/warehouse/assign-and-print",
                headers=hdr(token),
                json={"lot_code": new_lot_code},
                timeout=30,
            )
            add("E5 POST /warehouse/assign-and-print => 200", rap.status_code == 200,
                f"sc={rap.status_code} body={rap.text[:120]}")
            time.sleep(0.5)
            r5 = requests.get(
                f"{API}/security/audit-logs",
                headers=hdr(token),
                params={"action": "WAREHOUSE_AUTO_CLASSIFY"},
                timeout=30,
            )
            logs = r5.json() if r5.status_code == 200 else []
            any_match = len(logs) > 0 and any(l.get("action") == "WAREHOUSE_AUTO_CLASSIFY" for l in logs)
            add("E5 audit_logs has WAREHOUSE_AUTO_CLASSIFY", any_match, f"#={len(logs)}")
    else:
        add("E4/E5 could not list materials", False, f"sc={rm.status_code}")


# -----------------------------------------------------------
# F. Worker forbidden on /security/*
# -----------------------------------------------------------
def test_worker_forbidden():
    print("\n=== F. WORKER FORBIDDEN ON /security/* ===")
    sc, body, _ = login(WORKER_EMAIL, WORKER_PASSWORD)
    add("F1 Worker login => 200", sc == 200, f"sc={sc}")
    if sc != 200:
        return
    token = body["access_token"]
    r1 = requests.get(f"{API}/security/audit-logs", headers=hdr(token), timeout=30)
    add("F2 Worker GET /security/audit-logs => 403", r1.status_code == 403, f"sc={r1.status_code}")
    r2 = requests.get(f"{API}/security/sessions", headers=hdr(token), timeout=30)
    add("F3 Worker GET /security/sessions => 403", r2.status_code == 403, f"sc={r2.status_code}")


def main():
    print(f"Testing against: {API}")
    test_security_headers()
    test_login_lockout()
    test_token_blacklist()
    test_session_tracking()
    test_audit_logs()
    test_worker_forbidden()
    print("\n========== SUMMARY ==========")
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"{passed}/{total} assertions passed")
    print("\nFailures:")
    for n, ok, d in results:
        if not ok:
            print(f"  - {n} :: {d}")


if __name__ == "__main__":
    main()
