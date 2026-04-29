"""Backend tests for the new endpoint:
GET /api/warehouse/zones/{zid}/qr-base64

Per review request, only this endpoint is validated.
"""
import base64
import os
import sys
import requests

BASE_URL = "https://site-glass-preview.preview.emergentagent.com"
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "jefe@elegantglass.es"
ADMIN_PASSWORD = "Admin1234!"

PNG_MAGIC = b"\x89PNG"


def _print(label, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {label}{(' — ' + detail) if detail else ''}")


def login_admin():
    r = requests.post(
        f"{API}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=20,
    )
    assert r.status_code == 200, f"login status {r.status_code}: {r.text}"
    data = r.json()
    assert "access_token" in data, f"no access_token in response: {data}"
    return data["access_token"]


def list_zones(token):
    r = requests.get(
        f"{API}/warehouse/zones",
        headers={"Authorization": f"Bearer {token}"},
        timeout=20,
    )
    assert r.status_code == 200, f"list zones status {r.status_code}: {r.text}"
    zones = r.json()
    assert isinstance(zones, list), f"expected list, got {type(zones)}"
    return zones


def test_qr_base64_success(token, zid):
    r = requests.get(
        f"{API}/warehouse/zones/{zid}/qr-base64",
        headers={"Authorization": f"Bearer {token}"},
        timeout=20,
    )
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    # Required keys
    for k in ("filename", "mime", "base64", "qr_code"):
        assert k in body, f"missing key {k} in response: {body}"
    assert body["mime"] == "image/png", f"mime expected image/png, got {body['mime']}"
    assert isinstance(body["filename"], str) and body["filename"].endswith(".png"), (
        f"filename invalid: {body['filename']}"
    )
    assert isinstance(body["qr_code"], str) and body["qr_code"], (
        f"qr_code invalid: {body['qr_code']}"
    )
    assert isinstance(body["base64"], str) and len(body["base64"]) > 0, (
        "base64 must be non-empty string"
    )
    # Verify decodes to valid PNG
    raw = base64.b64decode(body["base64"], validate=True)
    assert raw[:4] == PNG_MAGIC, (
        f"decoded bytes do not start with PNG magic; got {raw[:8]!r}"
    )
    return body


def test_qr_base64_no_auth(zid):
    r = requests.get(f"{API}/warehouse/zones/{zid}/qr-base64", timeout=20)
    assert r.status_code in (401, 403), (
        f"expected 401/403 without auth, got {r.status_code}: {r.text}"
    )
    return r.status_code


def test_qr_base64_not_found(token):
    r = requests.get(
        f"{API}/warehouse/zones/non-existent-id/qr-base64",
        headers={"Authorization": f"Bearer {token}"},
        timeout=20,
    )
    assert r.status_code == 404, (
        f"expected 404 for non-existent id, got {r.status_code}: {r.text}"
    )
    return r.status_code


def main():
    failures = []

    # 1. Login
    try:
        token = login_admin()
        _print("admin login", True, "got access_token")
    except Exception as e:
        _print("admin login", False, str(e))
        return 1

    # 2. List zones
    try:
        zones = list_zones(token)
        _print("list zones", True, f"{len(zones)} zone(s) returned")
    except Exception as e:
        _print("list zones", False, str(e))
        return 1

    if not zones:
        _print("pick first zone", False, "no zones available — cannot test qr-base64 success path")
        # We can still test no-auth / 404
        zid = "non-existent-id"
    else:
        zid = zones[0]["id"]
        _print("pick first zone", True, f"zid={zid} name={zones[0].get('name')}")

    # 3. Success path (requires real zone)
    if zones:
        try:
            body = test_qr_base64_success(token, zid)
            preview = body["base64"][:24] + "..."
            _print(
                "GET qr-base64 (200, valid PNG)",
                True,
                f"filename={body['filename']} qr_code={body['qr_code']} base64={preview}",
            )
        except Exception as e:
            failures.append(("qr-base64 success", str(e)))
            _print("GET qr-base64 (200, valid PNG)", False, str(e))
    else:
        failures.append(("qr-base64 success", "no zones to test against"))

    # 4. No auth
    try:
        code = test_qr_base64_no_auth(zid if zones else "any-id")
        _print("GET qr-base64 without token (401/403)", True, f"status={code}")
    except Exception as e:
        failures.append(("qr-base64 no-auth", str(e)))
        _print("GET qr-base64 without token (401/403)", False, str(e))

    # 5. Not found
    try:
        code = test_qr_base64_not_found(token)
        _print("GET qr-base64 with bad id (404)", True, f"status={code}")
    except Exception as e:
        failures.append(("qr-base64 not-found", str(e)))
        _print("GET qr-base64 with bad id (404)", False, str(e))

    print("\n=== SUMMARY ===")
    if failures:
        print(f"{len(failures)} failure(s):")
        for name, msg in failures:
            print(f" - {name}: {msg}")
        return 1
    print("All qr-base64 endpoint checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
