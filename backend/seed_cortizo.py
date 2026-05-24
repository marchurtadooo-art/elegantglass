"""GLASSWORK — Seed Cortizo catalog + warehouse zones + locations.

Calls the production backend at https://elegantglass.onrender.com to
import the whole warehouse planning in one transaction.

Usage:
    ATLAS_ADMIN_EMAIL=… ATLAS_ADMIN_PASS=… python seed_cortizo.py
    or
    BACKEND_URL=… ADMIN_EMAIL=… ADMIN_PASS=… python seed_cortizo.py
"""
import os
import sys
import json
import getpass
import urllib.request
import urllib.parse


BACKEND = os.environ.get("BACKEND_URL", "https://elegantglass.onrender.com").rstrip("/")

# ------------------------------------------------------------------
# Catalog (Cortizo). Mapping: (code, name, unit, family_or_None)
# ------------------------------------------------------------------
# Family is informational (e.g. "COR 70 INDUSTRIAL"); category is always PERFILERIA
# and supplier is always Cortizo.

PERFIL_M = [
    ("COR-7905", "Hoja ventana 38mm"),
    ("COR-7910", "Marco HO HI"),
    ("COR-7911", "Junquillo recto clip fijos HO"),
    ("COR-7972", "Umbral balconera OB"),
    ("COR-8036", "Suplemento marco 25mm"),
    ("COR-8055", "Tapeta divisor hoja HO"),
    ("COR-8060", "Divisor hoja HO"),
    ("COR-8180", "Umbral PMR 25mm"),
    ("COR-8182", "Travesaño simétrico HO HI"),
    ("COR-8186", "Travesaño balconera HO HI"),
    ("COR-8191", "Acople cerradura hoja"),
    ("COR-7088", "Junquillo exterior HO Negro"),
    ("COR-7090", "Junquillo para fijos HO"),
    ("COR-7517", "Junquillo 33mm fijos HO"),
    ("COR-7518", "Junquillo 29.5mm fijos HO"),
    ("COR-7909", "Inversor apertura interior"),
    ("COR-7915", "Marco con enganche HO HI"),
    ("COR-8026", "Hoja inversora"),
    ("COR-7098", "Junquillo 18mm fijos HO"),
]

PERFIL_UD = [
    ("COR-2130", "Pletina falleba poliamida"),
    ("COR-4307", "Acople doble suelo integrado"),
    ("COR-4308", "Acople lateral suelo integrado"),
    ("COR-4309", "Acople central suelo integrado"),
    ("COR-4311", "Carril rodadura"),
    ("COR-4314", "Hoja ruedas"),
    ("COR-4319", "Hoja lateral balconera sin tirador"),
    ("COR-4320", "Hoja lateral con tirador"),
    ("COR-4323", "Hoja lateral balconera"),
    ("COR-4325", "Patín ruedas"),
    ("COR-4327", "Hoja central balconera"),
    ("COR-4328", "Hoja central balconera reforzada"),
    ("COR-4335", "Tapa drenaje aislante marco"),
    ("COR-4336", "Tapa lateral marco"),
    ("COR-4344", "Hoja ruedas"),
    ("COR-4371", "Hoja lateral embutida"),
    ("COR-4375", "Hoja central invertida fijo"),
    ("COR-4376", "Hoja central invertida fijo luz"),
    ("COR-4377", "Hoja central invertida cierre"),
    ("COR-4378", "Hoja central para cierre"),
    ("COR-4389", "Marco HI carril inox"),
    ("COR-1761", "Divisor mosquitera"),
    ("COR-2843", "Grapa enganche postizo"),
    ("COR-2890", "Complemento tapa registro"),
    ("COR-2891", "Asiento tapa registro"),
]

COR70_INDUSTRIAL = [
    ("COR-6733", "Marco alto ventana apertura interior HI"),
    ("COR-7923", "Hoja ventana apertura interior HI"),
    ("COR-7924", "Hoja balconera apertura interior HI"),
    ("COR-7927", "Hoja puerta apertura interior HI"),
    ("COR-7929", "Hoja puerta apertura exterior HI"),
    ("COR-7931", "Marco ventana apertura interior HI"),
    ("COR-7940", "Inversor apertura interior"),
    ("COR-7942", "Inversor apertura exterior"),
    ("COR-8144", "Travesaño balconera HI"),
    ("COR-8237", "Marco HI con solape 80mm"),
    ("773569", "Marco balconera embutir recogedor HI"),
]

COR_VISION_EVOLUTION = [
    ("COR-5305", "Carril rodadura"),
    ("COR-5310", "Perfil portarrodamientos mecanizado"),
    ("COR-5311", "Tapeta central marco"),
    ("COR-5312", "Tapeta lateral marco"),
    ("COR-5318", "Hoja rodadura"),
    ("COR-5319", "Hoja lateral embutida"),
    ("COR-5327", "Hoja central reforzada"),
    ("COR-5330", "Marco 2 carriles"),
    ("COR-5331", "Marco 3 carriles"),
    ("COR-5360", "Perfil unión central hojas con refuerzo"),
]


def _materials():
    out = []
    for code, name in PERFIL_M:
        out.append({"code": code, "name": name, "category": "PERFILERIA", "unit": "m", "supplier": "Cortizo"})
    for code, name in PERFIL_UD:
        out.append({"code": code, "name": name, "category": "PERFILERIA", "unit": "ud", "supplier": "Cortizo"})
    for code, name in COR70_INDUSTRIAL:
        out.append({"code": code, "name": name, "category": "PERFILERIA", "unit": "m", "supplier": "Cortizo", "family": "COR 70 INDUSTRIAL"})
    for code, name in COR_VISION_EVOLUTION:
        out.append({"code": code, "name": name, "category": "PERFILERIA", "unit": "m", "supplier": "Cortizo", "family": "COR VISION EVOLUTION"})
    # De-dup by code (keep first occurrence)
    seen = {}
    for m in out:
        seen.setdefault(m["code"], m)
    return list(seen.values())


ZONES = [
    {"zone_number": 1, "name": "Cor Evolution",      "category": "PERFILERIA", "row_count": 12},
    {"zone_number": 2, "name": "Cor 70 HO",          "category": "PERFILERIA", "row_count": 12},
    {"zone_number": 3, "name": "Corvision",          "category": "PERFILERIA", "row_count": 12},
    {"zone_number": 4, "name": "Cor 70 Industrial",  "category": "PERFILERIA", "row_count": 12},
    {"zone_number": 5, "name": "Cor 60",             "category": "PERFILERIA", "row_count": 12},
    {"zone_number": 6, "name": "Cor 60 HO",          "category": "PERFILERIA", "row_count": 12},
]


# Zone → ordered list of material codes (1 row each, starting at row 1)
ZONE_MAP = {
    1: ["COR-5305", "COR-5310", "COR-5311", "COR-5312", "COR-5318", "COR-5319", "COR-5327", "COR-5330", "COR-5331", "COR-5360"],
    2: ["COR-7905", "COR-7910", "COR-7911", "COR-7972", "COR-8036", "COR-8055", "COR-8060", "COR-8180", "COR-8182", "COR-8186", "COR-7088", "COR-7098"],
    3: ["COR-4307", "COR-4308", "COR-4309", "COR-4311", "COR-4314", "COR-4319", "COR-4320", "COR-4323", "COR-4325", "COR-4327", "COR-4328", "COR-4389", "COR-2130", "COR-1761"],
    4: ["COR-6733", "COR-7923", "COR-7924", "COR-7927", "COR-7929", "COR-7931", "COR-7940", "COR-7942", "COR-8144", "COR-8237", "773569"],
    5: ["COR-4335", "COR-4336", "COR-4344", "COR-4371", "COR-4375", "COR-4376", "COR-4377", "COR-4378"],
    6: ["COR-2843", "COR-2890", "COR-2891", "COR-7088", "COR-7090", "COR-7517", "COR-7518", "COR-7909", "COR-7915"],
}


def _locations():
    out = []
    for zone_number, codes in ZONE_MAP.items():
        for idx, code in enumerate(codes, start=1):
            out.append({
                "zone_number": zone_number,
                "row_number": idx,
                "material_code": code,
                "quantity": 0,
                "min_quantity": 5,
            })
    return out


def _http_json(method: str, url: str, *, body=None, token=None) -> dict:
    data = None
    headers = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        msg = e.read().decode("utf-8", errors="ignore")
        raise SystemExit(f"HTTP {e.code} {e.reason}\n{msg}")


def main():
    email = os.environ.get("ADMIN_EMAIL") or input("Admin email: ").strip()
    pw = os.environ.get("ADMIN_PASS") or getpass.getpass("Admin password: ")
    print(f"→ Logging in to {BACKEND} as {email}…")
    r = _http_json("POST", f"{BACKEND}/api/auth/login", body={"email": email, "password": pw})
    token = r["access_token"]
    print(f"✓ Authenticated as {r['user']['name']} ({r['user']['role']})")

    payload = {
        "materials": _materials(),
        "zones": ZONES,
        "locations": _locations(),
        "wipe_existing_materials": True,
    }
    print(f"→ Importing {len(payload['materials'])} materials, "
          f"{len(payload['zones'])} zones, "
          f"{len(payload['locations'])} locations…")
    r = _http_json("POST", f"{BACKEND}/api/warehouse/import-locations",
                   body=payload, token=token)
    print(f"✓ Done: {r}")


if __name__ == "__main__":
    main()
