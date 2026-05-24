"""GLASSWORK — Direct Atlas seed of the Cortizo warehouse planning.

Connects DIRECTLY to MongoDB Atlas (bypassing the API) to:
  - Replace all materials of the elegantglass company with the Cortizo catalog
  - Create 6 zones × 12 rows
  - Generate locations (zone × row × material) with QR codes
  - Logs an audit entry

Usage:
    python seed_cortizo_direct.py
"""
import sys
import os
import uuid
from datetime import datetime, timezone

# Add backend dir to path so we can reuse the catalog
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from seed_cortizo import (
    PERFIL_M, PERFIL_UD, COR70_INDUSTRIAL, COR_VISION_EVOLUTION, ZONES, ZONE_MAP,
)

import pymongo  # noqa: E402

ATLAS_URI = os.environ.get(
    "ATLAS_URI",
    "mongodb+srv://marchurtadooo_db_user:euakBAvgKWARVl0M@cluster0.gz1net2.mongodb.net/glasswork?retryWrites=true&w=majority",
)
DB_NAME = "glasswork"
TARGET_COMPANY_NAME = os.environ.get("TARGET_COMPANY", "elegantglass")  # substring match


def now_utc():
    return datetime.now(timezone.utc)


def main():
    print(f"→ Connecting to Atlas…")
    cli = pymongo.MongoClient(ATLAS_URI)
    db = cli[DB_NAME]
    db.command("ping")
    print("✓ Connected")

    # Find the elegantglass company by name (case-insensitive substring)
    co = db.companies.find_one({"name": {"$regex": TARGET_COMPANY_NAME, "$options": "i"}})
    if not co:
        co_list = list(db.companies.find({}, {"_id": 0, "id": 1, "name": 1}))
        print("✗ Compañía no encontrada por nombre. Lista de compañías disponibles:")
        for c in co_list:
            print(f"   - {c.get('name')}  (id={c.get('id')})")
        raise SystemExit(1)
    company_id = co["id"]
    print(f"✓ Company: {co['name']}  (id={company_id})")

    # 1) Wipe demo/seed materials
    del_mats = db.materials.delete_many({"company_id": company_id}).deleted_count
    del_lots = db.material_lots.delete_many({"company_id": company_id}).deleted_count
    del_locs = db.storage_locations.delete_many({"company_id": company_id}).deleted_count
    print(f"✓ Wiped: {del_mats} materials, {del_lots} lots, {del_locs} locations")

    # 2) Insert Cortizo materials
    code_to_id = {}
    mat_docs = []
    def _push(code, name, unit, family=None):
        if code in code_to_id:
            return
        mid = str(uuid.uuid4())
        code_to_id[code] = mid
        mat_docs.append({
            "id": mid,
            "company_id": company_id,
            "code": code,
            "name": name,
            "category": "PERFILERIA",
            "unit": unit,
            "supplier": "Cortizo",
            "family": family or "",
            "unit_price": 0,
            "stock": 0,
            "min_stock": 0,
            "is_active": True,
            "created_at": now_utc(),
            "updated_at": now_utc(),
        })

    for code, name in PERFIL_M:
        _push(code, name, "m")
    for code, name in PERFIL_UD:
        _push(code, name, "ud")
    for code, name in COR70_INDUSTRIAL:
        _push(code, name, "m", family="COR 70 INDUSTRIAL")
    for code, name in COR_VISION_EVOLUTION:
        _push(code, name, "m", family="COR VISION EVOLUTION")

    db.materials.insert_many(mat_docs)
    print(f"✓ Inserted {len(mat_docs)} materials")

    # 3) Upsert zones
    zone_num_to_id = {}
    for z in ZONES:
        existing = db.storage_zones.find_one({"company_id": company_id, "zone_number": z["zone_number"]}, {"_id": 0, "id": 1})
        if existing:
            zid = existing["id"]
            db.storage_zones.update_one(
                {"id": zid},
                {"$set": {
                    "name": z["name"], "category": z["category"], "row_count": z["row_count"],
                    "updated_at": now_utc(),
                }},
            )
        else:
            zid = str(uuid.uuid4())
            db.storage_zones.insert_one({
                "id": zid,
                "company_id": company_id,
                "zone_number": z["zone_number"],
                "name": z["name"],
                "category": z["category"],
                "row_count": z["row_count"],
                "qr_code": f"GW-ZONE-{zid[:8].upper()}",
                "created_at": now_utc(),
                "updated_at": now_utc(),
            })
        zone_num_to_id[z["zone_number"]] = {"id": zid, "name": z["name"]}
    print(f"✓ Upserted {len(zone_num_to_id)} zones")

    # 4) Locations (delete old, insert new)
    loc_docs = []
    for zone_number, codes in ZONE_MAP.items():
        zone = zone_num_to_id[zone_number]
        for idx, code in enumerate(codes, start=1):
            mat_id = code_to_id.get(code)
            if not mat_id:
                print(f"  ⚠ Material no encontrado en catálogo: {code} (zona {zone_number})")
                continue
            qr = f"Z{zone_number}-F{idx}-{code}"
            loc_docs.append({
                "id": str(uuid.uuid4()),
                "company_id": company_id,
                "zone_id": zone["id"],
                "zone_number": zone_number,
                "zone_name": zone["name"],
                "row_number": idx,
                "material_id": mat_id,
                "material_code": code,
                "quantity": 0.0,
                "min_quantity": 5.0,
                "qr_code": qr,
                "status": "OUT",
                "created_at": now_utc(),
                "updated_at": now_utc(),
            })
    if loc_docs:
        db.storage_locations.insert_many(loc_docs)
    print(f"✓ Inserted {len(loc_docs)} locations with QR codes")

    # 5) Audit log
    db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "company_id": company_id,
        "user_id": None,
        "user_name": "seed-script",
        "user_role": "SYSTEM",
        "action": "WAREHOUSE_SEED",
        "resource": "warehouse",
        "resource_id": None,
        "ip": "local",
        "user_agent": "seed_cortizo_direct.py",
        "success": True,
        "extra": {
            "materials": len(mat_docs),
            "zones": len(zone_num_to_id),
            "locations": len(loc_docs),
        },
        "ts": now_utc(),
    })

    print("")
    print("=" * 60)
    print("SUMMARY")
    print(f"  Materials inserted:  {len(mat_docs)}")
    print(f"  Zones upserted:      {len(zone_num_to_id)}")
    print(f"  Locations + QR:      {len(loc_docs)}")
    print("=" * 60)


if __name__ == "__main__":
    main()
