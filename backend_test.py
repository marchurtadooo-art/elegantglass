"""Backend tests — Warehouse stock rewrite + new zones/by-qr endpoint.

Targets:
  1. GET /api/warehouse/stock — now aggregates from storage_locations primarily
  2. GET /api/warehouse/zones/by-qr/{qr_code} — new endpoint for GW-ZONE-XXXXXXXX
"""

from __future__ import annotations
import sys
import time
import uuid
import requests


def _resolve_base() -> str:
    env_path = "/app/frontend/.env"
    backend_url = None
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                    backend_url = line.strip().split("=", 1)[1].strip().strip('"')
                    break
    except Exception:
        pass
    if not backend_url:
        backend_url = "http://localhost:8001"
    return backend_url.rstrip("/") + "/api"


BASE = _resolve_base()
print(f"[setup] BASE = {BASE}")

results = []  # list[ (label, ok, detail) ]


def record(label, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    print(f"  [{status}] {label} — {detail}" if detail else f"  [{status}] {label}")
    results.append((label, ok, detail))


def _post(path, **kw):
    return requests.post(BASE + path, timeout=30, **kw)


def _get(path, **kw):
    return requests.get(BASE + path, timeout=30, **kw)


def _h(token):
    return {"Authorization": f"Bearer {token}"}


print("\n=== SETUP: register fresh tenant ===")
unique = f"{int(time.time())}-{uuid.uuid4().hex[:6]}"
admin_email = f"admin-wh-test+{unique}@example.com"
admin_pwd = "AdminTest1234!"
worker_email = f"worker-wh-test+{unique}@example.com"
worker_pwd = "WorkerTest1234!"

r = _post(
    "/auth/register",
    json={
        "email": admin_email,
        "password": admin_pwd,
        "name": "Pablo Admin Warehouse",
        "company_name": f"Vidrios Pablo {unique[:6]}",
    },
)
if r.status_code != 200:
    print(f"[FATAL] register failed: {r.status_code} {r.text[:500]}")
    sys.exit(1)
admin_token = r.json()["access_token"]
print(f"[setup] admin registered → {admin_email}")

r = _post(
    "/users",
    headers=_h(admin_token),
    json={
        "email": worker_email,
        "password": worker_pwd,
        "name": "Carlos Worker Warehouse",
        "role": "WORKER",
        "phone": "+34 600 111 222",
    },
)
if r.status_code != 200:
    print(f"[FATAL] create worker failed: {r.status_code} {r.text[:500]}")
    sys.exit(1)

r = _post("/auth/login", json={"email": worker_email, "password": worker_pwd})
if r.status_code != 200:
    print(f"[FATAL] worker login failed: {r.status_code} {r.text[:500]}")
    sys.exit(1)
worker_token = r.json()["access_token"]
print(f"[setup] worker created and logged in → {worker_email}")


print("\n=== TEST 1 — GET /api/warehouse/stock (rewritten) ===")

# 1.0 With empty data, must not 500
r = _get("/warehouse/stock", headers=_h(admin_token))
record(
    "1.0 GET /warehouse/stock with empty data returns 200 (not 500) and a list",
    r.status_code == 200 and isinstance(r.json(), list),
    f"status={r.status_code} body_type={type(r.json()).__name__ if r.ok else r.text[:200]}",
)

# 1.1 Import minimal warehouse
import_payload = {
    "materials": [
        {
            "code": "COR70-IND-3MT-RAL9005",
            "name": "Perfil COR 70 Industrial RAL 9005 — 3m",
            "category": "PERFILERIA",
            "unit": "m",
            "supplier": "Cortizo",
            "family": "COR 70 INDUSTRIAL",
        },
        {
            "code": "VID-CLIMA-4-16-4",
            "name": "Vidrio Climalit 4/16/4",
            "category": "VIDRIO",
            "unit": "m2",
            "supplier": "Saint-Gobain",
            "family": "CLIMALIT",
        },
    ],
    "zones": [
        {"zone_number": 1, "name": "Zona A — Perfilería", "category": "PERFILERIA", "row_count": 4},
        {"zone_number": 2, "name": "Zona B — Vidrio", "category": "VIDRIO", "row_count": 3},
    ],
    "locations": [
        {"zone_number": 1, "row_number": 1, "material_code": "COR70-IND-3MT-RAL9005", "quantity": 0, "min_quantity": 5},
        {"zone_number": 1, "row_number": 2, "material_code": "COR70-IND-3MT-RAL9005", "quantity": 8, "min_quantity": 5},
        {"zone_number": 2, "row_number": 1, "material_code": "VID-CLIMA-4-16-4", "quantity": 12, "min_quantity": 2},
    ],
    "wipe_existing_materials": False,
}
r = _post("/warehouse/import-locations", headers=_h(admin_token), json=import_payload)
import_ok = r.status_code == 200 and r.json().get("locations", 0) == 3
record(
    "1.1 POST /warehouse/import-locations imports 2 materials, 2 zones, 3 locations",
    import_ok,
    f"status={r.status_code} body={r.text[:200]}",
)
if not import_ok:
    print("[FATAL] cannot continue without import")
    sys.exit(1)

# 1.2 Locate target
r = _get("/warehouse/locations", headers=_h(admin_token))
locs = r.json() if r.ok else []
loc_perf_empty = next(
    (l for l in locs if l.get("zone_number") == 1 and l.get("row_number") == 1),
    None,
)
loc_perf_filled = next(
    (l for l in locs if l.get("zone_number") == 1 and l.get("row_number") == 2),
    None,
)
record(
    "1.2 GET /warehouse/locations returns 3 locations including the target row",
    r.status_code == 200 and len(locs) == 3 and loc_perf_empty is not None,
    f"status={r.status_code} count={len(locs)}",
)
target_loc_id = loc_perf_empty["id"]
target_material_id = loc_perf_empty["material_id"]

# 1.3 +25 delta
r = _post(
    f"/warehouse/locations/{target_loc_id}/stock",
    headers=_h(admin_token),
    json={"delta": 25, "note": "Test initial load"},
)
record(
    "1.3 POST /warehouse/locations/{id}/stock delta=+25 returns 200 with quantity=25",
    r.status_code == 200 and abs(r.json().get("quantity", 0) - 25) < 1e-6,
    f"status={r.status_code} body={r.text[:200]}",
)

# 1.4-1.8 admin stock
r = _get("/warehouse/stock", headers=_h(admin_token))
stock_admin = r.json() if r.ok else []
perfileria_item = next((i for i in stock_admin if i.get("material_id") == target_material_id), None)
expected_total = 25 + (loc_perf_filled.get("quantity", 0) if loc_perf_filled else 0)
shape_keys = {"material_id", "name", "category", "unit", "total", "lot_count", "low_stock"}
shape_ok = perfileria_item is not None and shape_keys.issubset(set(perfileria_item.keys()))
total_ok = perfileria_item is not None and perfileria_item.get("total", 0) >= 25
lot_count_ok = perfileria_item is not None and perfileria_item.get("lot_count", 0) >= 1
record(
    "1.4 GET /warehouse/stock (admin) returns non-empty array",
    r.status_code == 200 and isinstance(stock_admin, list) and len(stock_admin) > 0,
    f"status={r.status_code} items={len(stock_admin)}",
)
record(
    "1.5 Stock item has required shape {material_id,name,category,unit,total,lot_count,low_stock}",
    shape_ok,
    f"keys_present={sorted(perfileria_item.keys()) if perfileria_item else 'MISSING'}",
)
record(
    "1.6 Stock item total >= 25 for the material that received +25 delta",
    total_ok,
    f"total={perfileria_item.get('total') if perfileria_item else 'N/A'} (expected_aggregate={expected_total})",
)
record(
    "1.7 Stock item lot_count >= 1 for that material",
    lot_count_ok,
    f"lot_count={perfileria_item.get('lot_count') if perfileria_item else 'N/A'}",
)
admin_value_ok = all("value" in i for i in stock_admin)
record(
    "1.8 ADMIN stock items include `value` field",
    admin_value_ok,
    f"sample_keys={sorted(stock_admin[0].keys()) if stock_admin else 'empty'}",
)

# 1.9 no token
r = _get("/warehouse/stock")
record(
    "1.9 GET /warehouse/stock without token → 401",
    r.status_code in (401, 403),
    f"status={r.status_code}",
)

# 1.10 worker
r = _get("/warehouse/stock", headers=_h(worker_token))
stock_worker = r.json() if r.ok else []
worker_no_value = all("value" not in i for i in stock_worker) if stock_worker else False
record(
    "1.10 GET /warehouse/stock (worker) returns 200 and items DO NOT include `value`",
    r.status_code == 200 and isinstance(stock_worker, list) and len(stock_worker) > 0 and worker_no_value,
    f"status={r.status_code} items={len(stock_worker)} no_value={worker_no_value} sample_keys={sorted(stock_worker[0].keys()) if stock_worker else 'empty'}",
)

# 1.11 realtime
prev_total = perfileria_item.get("total") if perfileria_item else 0
r = _post(
    f"/warehouse/locations/{target_loc_id}/stock",
    headers=_h(admin_token),
    json={"delta": 10, "note": "Test top-up"},
)
r2 = _get("/warehouse/stock", headers=_h(admin_token))
stock_after = r2.json() if r2.ok else []
new_item = next((i for i in stock_after if i.get("material_id") == target_material_id), None)
new_total = new_item.get("total") if new_item else 0
record(
    "1.11 After POST stock delta=+10, GET /warehouse/stock total increased by ~10",
    new_item is not None and abs(new_total - (prev_total + 10)) < 1e-6,
    f"prev={prev_total} new={new_total} (expected={prev_total + 10})",
)


print("\n=== TEST 2 — GET /api/warehouse/zones/by-qr/{qr_code} ===")

r = _get("/warehouse/zones", headers=_h(admin_token))
zones = r.json() if r.ok else []
gw_zone = next((z for z in zones if str(z.get("qr_code", "")).startswith("GW-ZONE-")), None)
record(
    "2.1 GET /warehouse/zones returns zones with qr_code starting with GW-ZONE-",
    r.status_code == 200 and gw_zone is not None,
    f"status={r.status_code} zones={len(zones)} qr_codes={[z.get('qr_code') for z in zones]}",
)
if not gw_zone:
    print("[FATAL] no GW-ZONE-* zone available — abort test 2")
    sys.exit(1)
zone_qr = gw_zone["qr_code"]
print(f"[test2] using zone qr_code={zone_qr} name={gw_zone.get('name')}")

# 2.2 valid GET
r = _get(f"/warehouse/zones/by-qr/{zone_qr}", headers=_h(admin_token))
record(
    "2.2 GET /warehouse/zones/by-qr/{valid} → 200",
    r.status_code == 200,
    f"status={r.status_code} body={r.text[:300]}",
)
body = r.json() if r.ok else {}
zone_payload = body.get("zone")
locations_payload = body.get("locations")
record(
    "2.3 Response has top-level `zone` and `locations`",
    isinstance(zone_payload, dict) and isinstance(locations_payload, list),
    f"zone_type={type(zone_payload).__name__} locations_type={type(locations_payload).__name__}",
)
record(
    "2.4 zone.qr_code matches scanned QR",
    bool(zone_payload) and zone_payload.get("qr_code") == zone_qr,
    f"returned={zone_payload.get('qr_code') if zone_payload else None} expected={zone_qr}",
)
zone_keys_ok = bool(zone_payload) and all(k in zone_payload for k in ("id", "qr_code", "zone_number", "name", "category"))
record(
    "2.5 zone has {id, qr_code, zone_number, name, category}",
    zone_keys_ok,
    f"keys={sorted(zone_payload.keys()) if zone_payload else 'N/A'}",
)
locs_present = isinstance(locations_payload, list) and len(locations_payload) >= 1
record(
    "2.6 locations list has at least 1 element (zone has locations)",
    locs_present,
    f"count={len(locations_payload) if isinstance(locations_payload, list) else 'N/A'}",
)
if locs_present:
    first_loc = locations_payload[0]
    loc_keys_ok = all(k in first_loc for k in ("id", "zone_id", "row_number", "material_id", "qr_code", "quantity", "status"))
    record(
        "2.7 location has {id, zone_id, row_number, material_id, qr_code, quantity, status}",
        loc_keys_ok,
        f"keys={sorted(first_loc.keys())}",
    )
    status_ok = all(l.get("status") in ("OK", "LOW", "OUT") for l in locations_payload)
    record(
        "2.8 each location.status is one of OK|LOW|OUT",
        status_ok,
        f"statuses={[l.get('status') for l in locations_payload]}",
    )
    mat = first_loc.get("material") or {}
    mat_ok = isinstance(mat, dict) and "name" in mat and "unit" in mat
    record(
        "2.9 location.material has at least `name` and `unit`",
        mat_ok,
        f"material_keys={sorted(mat.keys())}",
    )

# 2.10 404
r = _get("/warehouse/zones/by-qr/GW-ZONE-NOEXISTE99", headers=_h(admin_token))
detail_404 = None
try:
    if r.headers.get("content-type", "").startswith("application/json"):
        detail_404 = r.json().get("detail")
except Exception:
    pass
record(
    "2.10 GET /warehouse/zones/by-qr/GW-ZONE-NOEXISTE99 → 404 with detail",
    r.status_code == 404 and isinstance(detail_404, str) and len(detail_404) > 0,
    f"status={r.status_code} detail={detail_404}",
)

# 2.11 no auth
r = _get(f"/warehouse/zones/by-qr/{zone_qr}")
record(
    "2.11 GET /warehouse/zones/by-qr/{valid} without Bearer → 401",
    r.status_code in (401, 403),
    f"status={r.status_code}",
)


print("\n=== SUMMARY ===")
passed = sum(1 for _, ok, _ in results if ok)
failed = sum(1 for _, ok, _ in results if not ok)
total = len(results)
for label, ok, detail in results:
    if not ok:
        print(f"  FAIL — {label} — {detail}")
print(f"\n{passed}/{total} passed, {failed} failed")
sys.exit(0 if failed == 0 else 1)
