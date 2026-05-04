"""Backend tests — POST /api/warehouse/assign-and-print (ONLY)."""
import re
import sys
import requests

BASE = "https://site-glass-preview.preview.emergentagent.com/api"
ADMIN = {"email": "jefe@elegantglass.es", "password": "Admin1234!"}

results = []


def log(name, ok, detail=""):
    mark = "PASS" if ok else "FAIL"
    print(f"[{mark}] {name}  {detail}")
    results.append((name, ok, detail))


def login(creds):
    r = requests.post(f"{BASE}/auth/login", json=creds, timeout=20)
    r.raise_for_status()
    return r.json()["access_token"]


def pick_lot_code(token):
    h = {"Authorization": f"Bearer {token}"}
    try:
        r = requests.get(f"{BASE}/warehouse/stock", headers=h, timeout=20)
        if r.status_code == 200:
            data = r.json()
            items = data if isinstance(data, list) else (data.get("items") or data.get("lots") or [])
            for it in items:
                code = it.get("lot_code") or it.get("code")
                if code and code.startswith("EG-"):
                    return code
    except Exception:
        pass
    try:
        r = requests.get(f"{BASE}/warehouse/dashboard", headers=h, timeout=20)
        if r.status_code == 200:
            data = r.json()
            lots = data.get("lots") or data.get("recent_lots") or []
            for it in lots:
                code = it.get("lot_code") or it.get("code")
                if code and code.startswith("EG-"):
                    return code
    except Exception:
        pass
    return "EG-2026-0001"


def main():
    print(f"Base URL: {BASE}")
    token = login(ADMIN)
    h = {"Authorization": f"Bearer {token}"}
    print(f"Admin login OK: token len={len(token)}")

    lot_code = pick_lot_code(token)
    print(f"Using lot_code: {lot_code}")

    # Case 2 — happy path
    r = requests.post(f"{BASE}/warehouse/assign-and-print",
                      json={"lot_code": lot_code}, headers=h, timeout=20)
    ok2 = r.status_code == 200
    log("Case 2a: POST returns 200", ok2, f"status={r.status_code} body={r.text[:300]}")
    if not ok2:
        dump_and_exit()
        return
    data = r.json()
    log("Case 2b: ok=true", data.get("ok") is True, f"ok={data.get('ok')}")
    log("Case 2c: lot.lot_code present", bool(data.get("lot", {}).get("lot_code")), f"lot={data.get('lot')}")
    mat_cat = data.get("material", {}).get("category")
    log("Case 2d: material.category present", bool(mat_cat), f"material.category={mat_cat}")
    zone_name = data.get("zone", {}).get("name")
    zone_cat = data.get("zone", {}).get("category")
    log("Case 2e: zone.name present", bool(zone_name), f"zone.name={zone_name}")
    log("Case 2f: zone.category present", bool(zone_cat), f"zone.category={zone_cat}")
    row_label = data.get("row_label")
    log("Case 2g: row_label matches 'Fila X'",
        bool(row_label) and bool(re.match(r"^Fila \d+$", row_label)), f"row_label={row_label}")
    pr = data.get("print") or {}
    log("Case 2h: print.printed is bool", isinstance(pr.get("printed"), bool), f"printed={pr.get('printed')}")
    log("Case 2i: print.printer_configured is bool", isinstance(pr.get("printer_configured"), bool), f"printer_configured={pr.get('printer_configured')}")
    log("Case 2j: print.bytes > 0", isinstance(pr.get("bytes"), int) and pr.get("bytes") > 0, f"bytes={pr.get('bytes')}")
    log("Case 2k: print.message is string", isinstance(pr.get("message"), str), f"message={pr.get('message')}")
    log("Case 2l: PRINTER_IP empty → printed=false", pr.get("printed") is False, f"printed={pr.get('printed')}")
    log("Case 2m: PRINTER_IP empty → printer_configured=false", pr.get("printer_configured") is False, f"printer_configured={pr.get('printer_configured')}")

    # Case 6 — strict category equality
    log("Case 6: zone.category == material.category (strict)",
        zone_cat == mat_cat, f"zone.category={zone_cat} material.category={mat_cat}")

    # Case 3 — idempotency
    r3 = requests.post(f"{BASE}/warehouse/assign-and-print",
                       json={"lot_code": lot_code}, headers=h, timeout=20)
    ok3 = r3.status_code == 200
    log("Case 3a: second POST returns 200", ok3, f"status={r3.status_code}")
    if ok3:
        d3 = r3.json()
        log("Case 3b: same zone.name", d3.get("zone", {}).get("name") == zone_name,
            f"first={zone_name} second={d3.get('zone',{}).get('name')}")
        log("Case 3c: same row_label", d3.get("row_label") == row_label,
            f"first={row_label} second={d3.get('row_label')}")
        log("Case 3d: relocated=false (same zone)", d3.get("relocated") is False,
            f"relocated={d3.get('relocated')}")

    # Case 4 — unknown lot
    r4 = requests.post(f"{BASE}/warehouse/assign-and-print",
                       json={"lot_code": "EG-DOES-NOT-EXIST"}, headers=h, timeout=20)
    log("Case 4: unknown lot → 404", r4.status_code == 404,
        f"status={r4.status_code} body={r4.text[:200]}")

    # Case 5 — auth
    r5 = requests.post(f"{BASE}/warehouse/assign-and-print",
                       json={"lot_code": lot_code}, timeout=20)
    log("Case 5: no token → 401", r5.status_code == 401,
        f"status={r5.status_code} body={r5.text[:200]}")

    # Case 7 — persistence
    r7 = requests.get(f"{BASE}/warehouse/lots/{lot_code}", headers=h, timeout=20)
    ok7 = r7.status_code == 200
    log("Case 7a: GET lot detail 200", ok7, f"status={r7.status_code}")
    detail = r7.json() if ok7 else {}
    detail_zone_name = (detail.get("zone") or {}).get("name")
    log("Case 7b: lot.zone.name == response zone.name",
        detail_zone_name == zone_name, f"detail.zone.name={detail_zone_name} expected={zone_name}")
    log("Case 7c: lot.row_label == response row_label",
        detail.get("row_label") == row_label,
        f"detail.row_label={detail.get('row_label')} expected={row_label}")

    # Case 8 — LOCATE movement
    movs = detail.get("movements") or []
    locates = [m for m in movs if m.get("type") == "LOCATE"]
    log("Case 8a: at least 1 LOCATE movement", len(locates) >= 1,
        f"count LOCATE={len(locates)} total={len(movs)}")
    has_auto = any("Clasificación automática" in (m.get("note") or "") for m in locates)
    log("Case 8b: LOCATE note mentions 'Clasificación automática'", has_auto,
        f"notes={[m.get('note') for m in locates[:3]]}")

    dump_and_exit()


def dump_and_exit():
    failed = [r for r in results if not r[1]]
    print("\n==== SUMMARY ====")
    print(f"Total: {len(results)}  Passed: {len(results)-len(failed)}  Failed: {len(failed)}")
    for n, ok, d in results:
        if not ok:
            print(f"  FAIL: {n} — {d}")
    sys.exit(0 if not failed else 1)


if __name__ == "__main__":
    main()
