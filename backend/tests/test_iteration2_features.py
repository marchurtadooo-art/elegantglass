"""Iteration 2 new feature tests: company, profile, GDPR, forgot-password, PDF/Excel reports."""
import base64
import json
import requests
from .conftest import API


# ---------- COMPANY ----------
class TestCompany:
    def test_get_company_admin(self, admin_headers):
        r = requests.get(f"{API}/company", headers=admin_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "id" in data
        assert "name" in data

    def test_get_company_worker(self, worker_headers):
        r = requests.get(f"{API}/company", headers=worker_headers)
        assert r.status_code == 200, r.text
        assert "name" in r.json()

    def test_patch_company_admin(self, admin_headers):
        payload = {"address": "Calvià, Mallorca", "phone": "+34 971 22 33 44", "email": "info@elegantglass.es"}
        r = requests.patch(f"{API}/company", json=payload, headers=admin_headers)
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["address"] == payload["address"]
        assert c["phone"] == payload["phone"]
        # verify GET reflects change
        g = requests.get(f"{API}/company", headers=admin_headers).json()
        assert g["phone"] == payload["phone"]

    def test_patch_company_worker_forbidden(self, worker_headers):
        r = requests.patch(f"{API}/company", json={"name": "Hack"}, headers=worker_headers)
        assert r.status_code == 403


# ---------- PROFILE ----------
class TestProfile:
    def test_patch_profile_admin(self, admin_headers):
        payload = {"name": "Joan Martí", "phone": "+34 600 11 22 33"}
        r = requests.patch(f"{API}/profile", json=payload, headers=admin_headers)
        assert r.status_code == 200, r.text
        u = r.json()
        assert u["name"] == payload["name"]
        assert u["phone"] == payload["phone"]
        assert "password_hash" not in u

    def test_patch_profile_worker(self, worker_headers):
        payload = {"phone": "+34 600 99 88 77"}
        r = requests.patch(f"{API}/profile", json=payload, headers=worker_headers)
        assert r.status_code == 200, r.text
        assert r.json()["phone"] == payload["phone"]

    def test_patch_profile_unauthenticated(self):
        r = requests.patch(f"{API}/profile", json={"name": "X"})
        assert r.status_code in (401, 403)


# ---------- GDPR EXPORT ----------
class TestGDPR:
    def test_export_admin(self, admin_headers):
        r = requests.get(f"{API}/gdpr/export", headers=admin_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("mime") == "application/json"
        assert body.get("filename", "").endswith(".json")
        # decode base64 → JSON
        raw = base64.b64decode(body["base64"])
        data = json.loads(raw.decode("utf-8"))
        for k in ("company", "users", "projects", "materials",
                  "material_entries", "daily_logs", "photos_metadata", "alerts"):
            assert k in data, f"GDPR missing key {k}"
        # photos_metadata must NOT contain image_base64
        if data["photos_metadata"]:
            assert "image_base64" not in data["photos_metadata"][0]

    def test_export_worker_allowed(self, worker_headers):
        r = requests.get(f"{API}/gdpr/export", headers=worker_headers)
        assert r.status_code == 200, r.text


# ---------- FORGOT PASSWORD ----------
class TestForgotPassword:
    def test_existing_email(self):
        r = requests.post(f"{API}/auth/forgot-password",
                          json={"email": "jefe@elegantglass.es"})
        assert r.status_code == 200
        body = r.json()
        assert body.get("ok") is True
        assert "message" in body
        # must not enumerate
        assert "no encontrado" not in body["message"].lower()

    def test_unknown_email_same_response(self):
        r = requests.post(f"{API}/auth/forgot-password",
                          json={"email": "doesnotexist@example.com"})
        assert r.status_code == 200
        assert r.json().get("ok") is True


# ---------- PDF / EXCEL REPORTS ----------
class TestReportFiles:
    def _get_report_id(self, admin_headers):
        r = requests.get(f"{API}/reports/weekly", headers=admin_headers)
        assert r.status_code == 200
        reports = r.json()
        assert len(reports) > 0, "Need at least one weekly report"
        return reports[0]["id"]

    def test_pdf_admin(self, admin_headers):
        rid = self._get_report_id(admin_headers)
        r = requests.get(f"{API}/reports/weekly/{rid}/pdf", headers=admin_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["mime"] == "application/pdf"
        assert body["filename"].startswith("glasswork_reporte_")
        assert body["filename"].endswith(".pdf")
        raw = base64.b64decode(body["base64"])
        assert raw[:4] == b"%PDF", f"Not a valid PDF: {raw[:8]}"

    def test_pdf_worker_forbidden(self, admin_headers, worker_headers):
        rid = self._get_report_id(admin_headers)
        r = requests.get(f"{API}/reports/weekly/{rid}/pdf", headers=worker_headers)
        assert r.status_code == 403

    def test_excel_admin(self, admin_headers):
        rid = self._get_report_id(admin_headers)
        r = requests.get(f"{API}/reports/weekly/{rid}/excel", headers=admin_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "spreadsheet" in body["mime"]
        assert body["filename"].endswith(".xlsx")
        raw = base64.b64decode(body["base64"])
        # xlsx is a ZIP, starts with PK\x03\x04
        assert raw[:2] == b"PK", f"Not a valid xlsx (PK ZIP): {raw[:8]}"

    def test_excel_worker_forbidden(self, admin_headers, worker_headers):
        rid = self._get_report_id(admin_headers)
        r = requests.get(f"{API}/reports/weekly/{rid}/excel", headers=worker_headers)
        assert r.status_code == 403

    def test_pdf_not_found(self, admin_headers):
        r = requests.get(f"{API}/reports/weekly/nonexistent-id/pdf", headers=admin_headers)
        assert r.status_code == 404


# ---------- MATERIAL CREATE (frontend FAB feature) ----------
class TestMaterialCreate:
    def test_admin_can_create_material(self, admin_headers):
        import uuid
        payload = {
            "name": f"TEST_Material {uuid.uuid4().hex[:6]}",
            "unit": "m2",
            "category": "VIDRIO",
            "unit_price": 50.0,
            "supplier": "TEST_Sup",
        }
        r = requests.post(f"{API}/materials", json=payload, headers=admin_headers)
        assert r.status_code in (200, 201), r.text
        assert r.json()["name"] == payload["name"]

    def test_worker_cannot_create_material(self, worker_headers):
        payload = {"name": "TEST_HackMat", "unit": "ud", "category": "OTROS"}
        r = requests.post(f"{API}/materials", json=payload, headers=worker_headers)
        assert r.status_code == 403
