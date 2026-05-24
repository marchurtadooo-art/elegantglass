"""Apply the updated warehouse layout (multi-material per row).

Reads a JSON layout from stdin or LAYOUT env var, normalizes codes to
COR-{code} where applicable, auto-creates missing materials, and replaces
all storage_locations for the elegantglass company.
"""
import json
import os
import sys
import uuid
from datetime import datetime, timezone

import pymongo

ATLAS_URI = os.environ.get(
    "ATLAS_URI",
    "mongodb+srv://marchurtadooo_db_user:euakBAvgKWARVl0M@cluster0.gz1net2.mongodb.net/glasswork?retryWrites=true&w=majority",
)

LAYOUT_JSON = r'''
[
  {"zone": 1, "row": 1, "codes": ["5330"]},
  {"zone": 1, "row": 2, "codes": ["5330"]},
  {"zone": 1, "row": 3, "codes": ["5319", "5318"]},
  {"zone": 1, "row": 4, "codes": ["5327"]},
  {"zone": 1, "row": 5, "codes": ["5305", "5310", "5360", "8182"]},
  {"zone": 1, "row": 6, "codes": ["5330"]},
  {"zone": 1, "row": 7, "codes": ["5330"]},
  {"zone": 2, "row": 1, "codes": ["8060", "8055"]},
  {"zone": 2, "row": 2, "codes": ["7905"]},
  {"zone": 2, "row": 3, "codes": ["7905"]},
  {"zone": 2, "row": 4, "codes": ["7910"]},
  {"zone": 2, "row": 5, "codes": ["7910"]},
  {"zone": 2, "row": 6, "codes": ["7088", "7011"]},
  {"zone": 2, "row": 7, "codes": ["7962", "8991"]},
  {"zone": 2, "row": 8, "codes": ["7909"]},
  {"zone": 3, "row": 1, "codes": ["4308", "4309"]},
  {"zone": 3, "row": 2, "codes": ["4311", "4310", "4326", "4331"]},
  {"zone": 3, "row": 3, "codes": ["4326", "4327", "4328", "4339"]},
  {"zone": 3, "row": 4, "codes": ["4389"]},
  {"zone": 3, "row": 5, "codes": ["4389"]},
  {"zone": 3, "row": 6, "codes": ["4389"]},
  {"zone": 3, "row": 7, "codes": ["4320"]},
  {"zone": 3, "row": 8, "codes": ["4344", "4325", "4336", "4335"]},
  {"zone": 3, "row": 9, "codes": ["4323"]},
  {"zone": 4, "row": 1, "codes": ["7940", "7972"]},
  {"zone": 4, "row": 2, "codes": ["7931"]},
  {"zone": 4, "row": 3, "codes": ["7931"]},
  {"zone": 4, "row": 4, "codes": ["7920", "7923"]},
  {"zone": 4, "row": 5, "codes": ["7920", "7923"]},
  {"zone": 4, "row": 6, "codes": ["7927"]},
  {"zone": 4, "row": 7, "codes": ["7929"]},
  {"zone": 4, "row": 8, "codes": ["8144"]},
  {"zone": 5, "row": 1, "codes": ["8019"]},
  {"zone": 5, "row": 2, "codes": ["7016"]},
  {"zone": 5, "row": 3, "codes": ["7022"]},
  {"zone": 5, "row": 4, "codes": ["7044", "7664"]},
  {"zone": 5, "row": 5, "codes": ["5020"]},
  {"zone": 5, "row": 6, "codes": ["7043"]},
  {"zone": 6, "row": 1, "codes": ["7076"]},
  {"zone": 6, "row": 2, "codes": ["7076"]},
  {"zone": 6, "row": 3, "codes": ["7000"]},
  {"zone": 6, "row": 4, "codes": ["7000"]},
  {"zone": 6, "row": 5, "codes": ["7081"]},
  {"zone": 6, "row": 6, "codes": ["7089", "7069"]}
]
'''


def now_utc():
    return datetime.now(timezone.utc)


def normalize_code(raw: str) -> str:
    """Add COR- prefix to plain digit codes (5330 → COR-5330).
    Leave already-prefixed and special codes (like 773569) untouched.
    """
    raw = raw.strip()
    if raw.startswith("COR-"):
        return raw
    if raw.isdigit() and len(raw) <= 5:
        return f"COR-{raw}"
    return raw


def main():
    cli = pymongo.MongoClient(ATLAS_URI)
    db = cli["glasswork"]
    db.command("ping")
    print("✓ Connected to Atlas")

    co = db.companies.find_one({"name": {"$regex": "elegant", "$options": "i"}})
    if not co:
        raise SystemExit("Compañía 'elegant' no encontrada en Atlas")
    company_id = co["id"]
    print(f"✓ Company: {co['name']}  (id={company_id})")

    layout = json.loads(LAYOUT_JSON)
    print(f"→ Layout entries: {len(layout)}")

    # Build the set of needed codes (normalized)
    needed_codes: set[str] = set()
    for entry in layout:
        for c in entry["codes"]:
            needed_codes.add(normalize_code(c))
    print(f"→ Unique codes needed: {len(needed_codes)}")

    # Map existing materials by code
    existing = list(db.materials.find(
        {"company_id": company_id}, {"_id": 0, "id": 1, "code": 1, "unit": 1}
    ))
    code_to_id = {m["code"]: m["id"] for m in existing}

    # Determine which are missing → auto-create with placeholder
    # Family guess by zone (informational only)
    ZONE_FAMILY = {
        1: "COR VISION EVOLUTION",
        2: "COR 70 HO",
        3: "CORVISION",
        4: "COR 70 INDUSTRIAL",
        5: "COR 60",
        6: "COR 60 HO",
    }
    # Build code → family suggestion from layout
    code_family: dict[str, str] = {}
    for entry in layout:
        fam = ZONE_FAMILY.get(entry["zone"], "")
        for c in entry["codes"]:
            nc = normalize_code(c)
            code_family.setdefault(nc, fam)

    created = []
    for code in sorted(needed_codes):
        if code in code_to_id:
            continue
        mid = str(uuid.uuid4())
        # Heuristic: ud for accessories (2xxx, 4xxx without context), m for the rest
        # Default to "m" — user can edit afterwards.
        unit = "m"
        if code.startswith("COR-2") or code.startswith("COR-4"):
            # Accessory-like codes are usually 'ud'
            unit = "ud"
        doc = {
            "id": mid,
            "company_id": company_id,
            "code": code,
            "name": f"Cortizo {code.replace('COR-', '')}",  # placeholder — edit later
            "category": "PERFILERIA",
            "unit": unit,
            "supplier": "Cortizo",
            "family": code_family.get(code, ""),
            "unit_price": 0,
            "stock": 0,
            "min_stock": 0,
            "is_active": True,
            "created_at": now_utc(),
            "updated_at": now_utc(),
            "auto_created": True,
        }
        db.materials.insert_one(doc)
        code_to_id[code] = mid
        created.append(code)
    print(f"✓ Auto-created {len(created)} new materials: {', '.join(created) if created else '(none)'}")

    # Map zones by zone_number
    zones = list(db.storage_zones.find({"company_id": company_id}, {"_id": 0}))
    zone_by_num = {z["zone_number"]: z for z in zones}
    if len(zone_by_num) < 6:
        raise SystemExit(f"Faltan zonas en Atlas (encontradas {len(zone_by_num)}, esperadas 6)")

    # Wipe and re-insert locations
    deleted = db.storage_locations.delete_many({"company_id": company_id}).deleted_count
    print(f"✓ Wiped {deleted} previous locations")

    loc_docs = []
    for entry in layout:
        z = zone_by_num.get(entry["zone"])
        if not z:
            continue
        for code in entry["codes"]:
            nc = normalize_code(code)
            mid = code_to_id.get(nc)
            if not mid:
                print(f"  ⚠ {nc} no se pudo crear/encontrar — saltado")
                continue
            qr = f"Z{entry['zone']}-F{entry['row']}-{nc}"
            loc_docs.append({
                "id": str(uuid.uuid4()),
                "company_id": company_id,
                "zone_id": z["id"],
                "zone_number": entry["zone"],
                "zone_name": z["name"],
                "row_number": entry["row"],
                "material_id": mid,
                "material_code": nc,
                "quantity": 0.0,
                "min_quantity": 5.0,
                "qr_code": qr,
                "status": "OUT",
                "created_at": now_utc(),
                "updated_at": now_utc(),
            })
    db.storage_locations.insert_many(loc_docs)
    print(f"✓ Inserted {len(loc_docs)} new locations with QR codes")

    # Distribution by zone
    print("\n=== Distribución por zona ===")
    for zn in sorted(zone_by_num):
        z = zone_by_num[zn]
        n = db.storage_locations.count_documents({"company_id": company_id, "zone_number": zn})
        rows = db.storage_locations.distinct("row_number", {"company_id": company_id, "zone_number": zn})
        print(f"  Z{zn} {z['name']:<25}  →  {n} ubicaciones · {len(rows)} filas usadas")

    # Sample of generated QRs
    print("\n=== Muestra QR generados (15) ===")
    for loc in db.storage_locations.find({"company_id": company_id}).sort([("zone_number", 1), ("row_number", 1)]).limit(15):
        print(f"  {loc['qr_code']:<28} (row {loc['row_number']})")

    # Audit
    db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "company_id": company_id,
        "user_id": None,
        "user_name": "seed-script",
        "user_role": "SYSTEM",
        "action": "WAREHOUSE_LAYOUT_UPDATE",
        "resource": "warehouse",
        "resource_id": None,
        "ip": "local",
        "user_agent": "apply_layout_v2.py",
        "success": True,
        "extra": {"locations": len(loc_docs), "auto_created_materials": created},
        "ts": now_utc(),
    })
    print("\n✓ Done.")


if __name__ == "__main__":
    main()
