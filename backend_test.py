"""Backend tests for GLASSWORK client-report endpoints (new in this session)."""
import base64
import re
import zlib

import requests

BASE = "https://site-glass-preview.preview.emergentagent.com/api"

ADMIN_EMAIL = "jefe@elegantglass.es"
ADMIN_PASSWORD = "Admin1234!"
WORKER_EMAIL = "carlos@elegantglass.es"
WORKER_PASSWORD = "Worker1234!"


def login(email, password):
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def authed(tok):
    return {"Authorization": f"Bearer {tok}"}


results = []


def record(case, passed, detail=""):
    icon = "PASS" if passed else "FAIL"
    print(f"[{icon}] {case}: {detail}")
    results.append((case, passed, detail))


def main():
    print(f"BASE URL: {BASE}")

    try:
        admin_token = login(ADMIN_EMAIL, ADMIN_PASSWORD)
        record("admin login", True, "token obtained")
    except Exception as e:
        record("admin login", False, str(e))
        return

    # Case 1
    r = requests.get(f"{BASE}/reports/projects", headers=authed(admin_token), timeout=30)
    case1_ok = r.status_code == 200
    projects = []
    if case1_ok:
        projects = r.json()
        if not isinstance(projects, list):
            case1_ok = False
        else:
            required = {"id", "name", "status", "client_name", "address",
                        "hours_total", "workers_count", "photo_count", "log_count",
                        "start_date", "end_date"}
            missing_fields = []
            for p in projects:
                missing = required - set(p.keys())
                if missing:
                    missing_fields.append((p.get("id"), list(missing)))
            if missing_fields:
                case1_ok = False
                record("Case 1 - fields", False, f"Missing fields on items: {missing_fields[:3]}")
            else:
                record("Case 1 - fields", True, f"All {len(projects)} projects contain required fields")

            status_order = {"COMPLETED": 0, "ACTIVE": 1, "PAUSED": 2, "PENDING": 3, "CANCELLED": 4}
            ordered_statuses = [p["status"] for p in projects]
            mapped = [status_order.get(s, 9) for s in ordered_statuses]
            is_sorted = all(mapped[i] <= mapped[i + 1] for i in range(len(mapped) - 1))
            record("Case 1 - sorting", is_sorted, f"status order: {ordered_statuses}")
            if not is_sorted:
                case1_ok = False
    record("Case 1 - GET /reports/projects admin 200", case1_ok,
           f"status={r.status_code}, items={len(projects) if isinstance(projects, list) else 'n/a'}")

    # Case 2
    active_proj = next((p for p in projects if p.get("status") == "ACTIVE"), None)
    completed_id = None
    if not active_proj:
        record("Case 2 - mark-complete", False, "No ACTIVE project found; using existing COMPLETED for case 3")
        already_completed = next((p for p in projects if p.get("status") == "COMPLETED"), None)
        if already_completed:
            completed_id = already_completed["id"]
    else:
        r2 = requests.post(f"{BASE}/projects/{active_proj['id']}/mark-complete",
                           headers=authed(admin_token), timeout=30)
        ok2 = r2.status_code == 200
        detail = f"status={r2.status_code}"
        if ok2:
            j = r2.json()
            status_ok = j.get("status") == "COMPLETED"
            date_ok = bool(j.get("actual_end_date"))
            prog_ok = j.get("progress_percentage") == 100
            ok2 = status_ok and date_ok and prog_ok
            detail = (f"status={j.get('status')}, actual_end_date={j.get('actual_end_date')}, "
                      f"progress_percentage={j.get('progress_percentage')}")
            completed_id = active_proj["id"]
        record("Case 2 - POST /projects/{id}/mark-complete", ok2,
               f"project={active_proj.get('name')} id={active_proj['id']} | {detail}")

    # Case 3
    pdf_bytes = b""
    if completed_id:
        r3 = requests.get(f"{BASE}/projects/{completed_id}/client-report/pdf",
                          headers=authed(admin_token), timeout=60)
        ok3 = r3.status_code == 200
        if ok3:
            j = r3.json()
            has_keys = all(k in j for k in ("filename", "mime", "base64"))
            mime_ok = j.get("mime") == "application/pdf"
            try:
                pdf_bytes = base64.b64decode(j.get("base64", ""))
            except Exception as e:
                pdf_bytes = b""
                record("Case 3 - base64 decode", False, str(e))
            magic_ok = pdf_bytes.startswith(b"%PDF-")
            size_ok = len(pdf_bytes) > 2000
            ok3 = has_keys and mime_ok and magic_ok and size_ok
            record("Case 3 - GET client-report/pdf", ok3,
                   f"filename={j.get('filename')}, mime={j.get('mime')}, "
                   f"magic_ok={magic_ok}, size={len(pdf_bytes)} bytes")
        else:
            record("Case 3 - GET client-report/pdf", False,
                   f"status={r3.status_code} body={r3.text[:200]}")
    else:
        record("Case 3 - GET client-report/pdf", False, "No completed project id available")

    # Case 4
    r4 = requests.get(f"{BASE}/projects/nonexistent-xyz-999/client-report/pdf",
                      headers=authed(admin_token), timeout=30)
    ok4 = r4.status_code == 404
    record("Case 4 - nonexistent project → 404", ok4, f"status={r4.status_code}")

    # Case 5
    r5 = requests.get(f"{BASE}/reports/projects", timeout=30)
    ok5 = r5.status_code == 401
    record("Case 5 - GET /reports/projects NO token → 401", ok5, f"status={r5.status_code}")

    # Case 6
    try:
        worker_token = login(WORKER_EMAIL, WORKER_PASSWORD)
        r6 = requests.get(f"{BASE}/reports/projects", headers=authed(worker_token), timeout=30)
        ok6 = r6.status_code == 403
        record("Case 6 - worker GET /reports/projects → 403", ok6, f"status={r6.status_code}")
    except Exception as e:
        record("Case 6 - worker login/access", False, str(e))

    # Financial leak check
    if pdf_bytes:
        raw = pdf_bytes
        decoded_chunks = [raw]
        stream_re = re.compile(rb"stream\s*(.*?)\s*endstream", re.DOTALL)
        for m in stream_re.finditer(raw):
            blob = m.group(1)
            try:
                decoded_chunks.append(zlib.decompress(blob))
            except Exception:
                try:
                    decoded_chunks.append(zlib.decompress(blob.lstrip(b"\r\n")))
                except Exception:
                    pass

        combined = b"\n".join(decoded_chunks).lower()
        strict_keywords = ["unit_price", "budget", "total_cost"]
        strict_leaks = [k for k in strict_keywords if k.encode("utf-8") in combined]
        record("Financial leak — strict (unit_price/budget/total_cost)", not strict_leaks,
               f"strict leaks: {strict_leaks}" if strict_leaks else "none of the three strict keywords found")

        info_keywords = ["presupuesto", "coste", "precio", "gastado", "\u20ac", "eur ", " eur"]
        info_hits = [k for k in info_keywords if k.encode("utf-8", errors="ignore") in combined]
        print(f"[INFO] Additional price/currency-related terms visible: {info_hits}")

    # Summary
    print("\n================ SUMMARY ================")
    for case, passed, detail in results:
        print(f"{'OK ' if passed else 'FAIL'} | {case} | {detail}")
    failed = [c for c, p, _ in results if not p]
    print(f"\n{len(results) - len(failed)}/{len(results)} passed. Failures: {failed}")


if __name__ == "__main__":
    main()
