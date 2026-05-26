"""
Backend test: WORKER permissions for projects + ProjectPatch (PATCH parcial)
Review request — Tests A, B, C, D.
"""
import json
import time
import uuid
import requests

BASE = "http://localhost:8001/api"

def jp(d):  # pretty
    try:
        return json.dumps(d, indent=2, ensure_ascii=False)[:600]
    except Exception:
        return str(d)[:600]

results = []  # list of (name, passed, detail)

def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    mark = "PASS" if cond else "FAIL"
    print(f"[{mark}] {name}{(' — ' + detail) if (detail and not cond) else ''}")


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def main():
    stamp = int(time.time())
    admin_email = f"admin-worker-perm+{stamp}@example.com"
    worker_email = f"worker1-perm+{stamp}@example.com"
    worker2_email = f"worker2-perm+{stamp}@example.com"
    pwd = "Admin1234!"

    # Register admin tenant
    r = requests.post(f"{BASE}/auth/register", json={
        "name": "Admin Perm",
        "email": admin_email,
        "password": pwd,
        "company_name": f"Perm Co {stamp}",
    })
    check("Register admin (200)", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    admin_tok = r.json()["access_token"]
    admin_id = r.json()["user"]["id"]

    # Admin creates WORKER #1
    r = requests.post(f"{BASE}/users", headers=auth(admin_tok), json={
        "name": "Worker One",
        "email": worker_email,
        "password": pwd,
        "role": "WORKER",
    })
    check("Admin creates WORKER #1 (200)", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    worker1_id = r.json()["id"]

    # Admin creates WORKER #2 (same tenant)
    r = requests.post(f"{BASE}/users", headers=auth(admin_tok), json={
        "name": "Worker Two",
        "email": worker2_email,
        "password": pwd,
        "role": "WORKER",
    })
    check("Admin creates WORKER #2 (200)", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    worker2_id = r.json()["id"]

    # Login both workers
    r = requests.post(f"{BASE}/auth/login", json={"email": worker_email, "password": pwd})
    check("Worker #1 login (200)", r.status_code == 200)
    worker_tok = r.json()["access_token"]

    r = requests.post(f"{BASE}/auth/login", json={"email": worker2_email, "password": pwd})
    check("Worker #2 login (200)", r.status_code == 200)
    worker2_tok = r.json()["access_token"]

    # ========== TEST A — POST /api/projects as WORKER ==========
    print("\n========= TEST A — POST /api/projects con role=WORKER =========")
    payload = {
        "name": "Obra X",
        "address": "C/Y",
        "client_name": "C",
        "budget": 5000,
        "start_date": "2026-06-01",
        "end_date": "2026-09-01",
        "notes": "N",
    }
    r = requests.post(f"{BASE}/projects", headers=auth(worker_tok), json=payload)
    check("A1: Worker POST /projects → 200", r.status_code == 200, f"{r.status_code} {r.text[:300]}")
    if r.status_code == 200:
        body = r.json()
        project_id = body.get("id")
        check("A2: response budget is None (worker doesn't see budget)",
              body.get("budget") is None,
              f"budget={body.get('budget')}")
        check("A3: worker is in assigned_worker_ids automatically",
              worker1_id in (body.get("assigned_worker_ids") or []),
              f"assigned_worker_ids={body.get('assigned_worker_ids')}")
        check("A4: name preserved", body.get("name") == "Obra X")
    else:
        return False, "A1 failed; cannot continue"

    # Worker GET single
    r = requests.get(f"{BASE}/projects/{project_id}", headers=auth(worker_tok))
    check("A5: Worker GET /projects/{id} → 200", r.status_code == 200, f"{r.status_code}")
    if r.status_code == 200:
        check("A6: Worker GET shows budget=None", r.json().get("budget") is None,
              f"budget={r.json().get('budget')}")

    # Worker GET list
    r = requests.get(f"{BASE}/projects", headers=auth(worker_tok))
    check("A7: Worker GET /projects → 200", r.status_code == 200)
    if r.status_code == 200:
        ids = [p.get("id") for p in r.json()]
        check("A8: Project appears in Worker's list", project_id in ids,
              f"ids={ids}")

    # ========== TEST B — PATCH parcial ==========
    print("\n========= TEST B — PATCH parcial con ProjectPatch =========")
    # B1: admin PATCH budget
    r = requests.patch(f"{BASE}/projects/{project_id}", headers=auth(admin_tok),
                       json={"budget": 12000.0})
    check("B1: Admin PATCH {budget:12000} → 200", r.status_code == 200,
          f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        check("B1b: Admin sees budget=12000", r.json().get("budget") == 12000.0,
              f"budget={r.json().get('budget')}")

    # B2: worker GET still 200 with budget=None
    r = requests.get(f"{BASE}/projects/{project_id}", headers=auth(worker_tok))
    check("B2: Worker GET /projects/{id} → 200 (still has access)",
          r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        check("B2b: Worker still sees budget=None after admin set budget",
              r.json().get("budget") is None, f"budget={r.json().get('budget')}")
        check("B2c: Worker still in assigned_worker_ids",
              worker1_id in (r.json().get("assigned_worker_ids") or []),
              f"assigned={r.json().get('assigned_worker_ids')}")

    # B3: admin GET → 12000
    r = requests.get(f"{BASE}/projects/{project_id}", headers=auth(admin_tok))
    check("B3: Admin GET budget=12000.0", r.status_code == 200 and r.json().get("budget") == 12000.0,
          f"{r.status_code} budget={r.json().get('budget') if r.status_code==200 else None}")

    # B4: admin PATCH only name
    r = requests.patch(f"{BASE}/projects/{project_id}", headers=auth(admin_tok),
                       json={"name": "Renombrada"})
    check("B4: Admin PATCH {name:'Renombrada'} → 200", r.status_code == 200,
          f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        check("B4b: name updated", r.json().get("name") == "Renombrada")

    # Worker GET — should still be 200, see new name, budget=None
    r = requests.get(f"{BASE}/projects/{project_id}", headers=auth(worker_tok))
    check("B5: Worker GET → 200 (assigned_worker_ids preserved)",
          r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        check("B5b: name='Renombrada'", r.json().get("name") == "Renombrada",
              f"name={r.json().get('name')}")
        check("B5c: budget still None for worker", r.json().get("budget") is None,
              f"budget={r.json().get('budget')}")

    # Admin verifies budget still preserved after name-only PATCH
    r = requests.get(f"{BASE}/projects/{project_id}", headers=auth(admin_tok))
    check("B5d: Admin still sees budget=12000 (PATCH didn't wipe)",
          r.status_code == 200 and r.json().get("budget") == 12000.0,
          f"budget={r.json().get('budget') if r.status_code==200 else None}")

    # ========== TEST C — Permisos/restricciones ==========
    print("\n========= TEST C — Permisos / restricciones =========")
    # C1: Worker PATCH → 403
    r = requests.patch(f"{BASE}/projects/{project_id}", headers=auth(worker_tok),
                       json={"name": "WorkerShouldFail"})
    check("C1: Worker PATCH → 403", r.status_code == 403,
          f"{r.status_code} {r.text[:200]}")

    # C2: Worker DELETE → 403
    r = requests.delete(f"{BASE}/projects/{project_id}", headers=auth(worker_tok))
    check("C2: Worker DELETE → 403", r.status_code == 403,
          f"{r.status_code} {r.text[:200]}")

    # C3: Worker #2 cannot see worker #1's project
    r = requests.get(f"{BASE}/projects/{project_id}", headers=auth(worker2_tok))
    check("C3: Worker #2 GET other worker's project → 403",
          r.status_code == 403, f"{r.status_code} {r.text[:200]}")

    # C3b: Worker #2 list does NOT include this project
    r = requests.get(f"{BASE}/projects", headers=auth(worker2_tok))
    if r.status_code == 200:
        ids = [p.get("id") for p in r.json()]
        check("C3b: Worker #2 list does NOT include the project",
              project_id not in ids, f"ids={ids}")
    else:
        check("C3b: Worker #2 list 200", False, f"{r.status_code}")

    # C4: No Bearer → 401
    r = requests.get(f"{BASE}/projects")
    check("C4a: GET /projects no auth → 401", r.status_code == 401, f"{r.status_code}")
    r = requests.get(f"{BASE}/projects/{project_id}")
    check("C4b: GET /projects/{id} no auth → 401", r.status_code == 401, f"{r.status_code}")
    r = requests.post(f"{BASE}/projects", json={"name": "x", "address": "y"})
    check("C4c: POST /projects no auth → 401", r.status_code == 401, f"{r.status_code}")
    r = requests.patch(f"{BASE}/projects/{project_id}", json={"name": "x"})
    check("C4d: PATCH /projects/{id} no auth → 401", r.status_code == 401, f"{r.status_code}")
    r = requests.delete(f"{BASE}/projects/{project_id}")
    check("C4e: DELETE /projects/{id} no auth → 401", r.status_code == 401, f"{r.status_code}")

    # ========== TEST D — Existing endpoints NOT broken ==========
    print("\n========= TEST D — Existing endpoints NO rotos =========")
    # D1: /warehouse/stock
    r = requests.get(f"{BASE}/warehouse/stock", headers=auth(admin_tok))
    check("D1: GET /warehouse/stock (admin) → 200",
          r.status_code == 200, f"{r.status_code} {r.text[:200]}")

    # D2: /warehouse/zones/by-qr/{qr}
    # Create a zone directly via POST /warehouse/zones, then test by-qr
    r = requests.post(f"{BASE}/warehouse/zones", headers=auth(admin_tok), json={
        "name": "Zona Test Perm", "category": "PERFILERIA", "row_count": 2,
    })
    check("D2-prep: POST /warehouse/zones → 200",
          r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        qrc = r.json().get("qr_code")
        check("D2-prep: zone has qr_code", bool(qrc), f"qr_code={qrc}")
        if qrc:
            br = requests.get(f"{BASE}/warehouse/zones/by-qr/{qrc}", headers=auth(admin_tok))
            check("D2: GET /warehouse/zones/by-qr/{qr} → 200",
                  br.status_code == 200, f"{br.status_code} {br.text[:200]}")
            if br.status_code == 200:
                j = br.json()
                check("D2b: response has zone & locations",
                      isinstance(j.get("zone"), dict) and isinstance(j.get("locations"), list),
                      f"keys={list(j.keys())}")
            # No auth
            nr = requests.get(f"{BASE}/warehouse/zones/by-qr/{qrc}")
            check("D2c: by-qr no auth → 401", nr.status_code == 401, f"{nr.status_code}")

    # D3: Admin POST /projects respects budget sent
    r = requests.post(f"{BASE}/projects", headers=auth(admin_tok), json={
        "name": "Obra Admin",
        "address": "Calle Admin",
        "client_name": "C2",
        "budget": 25000.0,
        "start_date": "2026-01-01",
        "end_date": "2026-12-31",
        "notes": "Admin project",
    })
    check("D3: Admin POST /projects → 200",
          r.status_code == 200, f"{r.status_code} {r.text[:200]}")
    if r.status_code == 200:
        check("D3b: Admin sees budget=25000.0 (not wiped)",
              r.json().get("budget") == 25000.0, f"budget={r.json().get('budget')}")

    # Summary
    print("\n" + "=" * 60)
    passed = sum(1 for _, ok, _ in results if ok)
    failed = sum(1 for _, ok, _ in results if not ok)
    print(f"SUMMARY: {passed} passed / {failed} failed / {len(results)} total")
    if failed:
        print("\nFAILED:")
        for n, ok, d in results:
            if not ok:
                print(f"  - {n}: {d}")
    return passed, failed


if __name__ == "__main__":
    p, f = main()
    raise SystemExit(0 if f == 0 else 1)
