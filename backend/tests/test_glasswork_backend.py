"""Backend tests for GLASSWORK API covering all endpoints in review request."""
import pytest
import requests
from .conftest import API


# ---------- AUTH ----------
class TestAuth:
    def test_login_admin(self, admin_tokens):
        assert "access_token" in admin_tokens
        assert "refresh_token" in admin_tokens
        assert admin_tokens["user"]["email"] == "jefe@elegantglass.es"
        assert admin_tokens["user"]["role"] in ("ADMIN", "MANAGER")

    def test_login_worker(self, worker_tokens):
        assert "access_token" in worker_tokens
        assert worker_tokens["user"]["role"] == "WORKER"

    def test_login_bad_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": "jefe@elegantglass.es", "password": "wrong"})
        assert r.status_code in (400, 401)

    def test_me_endpoint(self, admin_headers):
        r = requests.get(f"{API}/auth/me", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["email"] == "jefe@elegantglass.es"

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code in (401, 403)

    def test_refresh_token(self, admin_tokens):
        r = requests.post(f"{API}/auth/refresh", json={"refresh_token": admin_tokens["refresh_token"]})
        assert r.status_code == 200
        assert "access_token" in r.json()


# ---------- PROJECTS ----------
class TestProjects:
    def test_admin_sees_all_projects_with_budget(self, admin_headers):
        r = requests.get(f"{API}/projects", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 4, f"Expected >=4 seeded projects, got {len(data)}"
        for p in data:
            assert p.get("budget") is not None, "Admin should see budget"
            assert "spent" in p

    def test_worker_projects_stripped(self, worker_headers):
        r = requests.get(f"{API}/projects", headers=worker_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # Worker may have 2 assigned
        for p in data:
            assert p.get("budget") is None, "Worker must not see budget"
            assert p.get("spent") is None, "Worker must not see spent"

    def test_project_detail_admin(self, admin_headers):
        r = requests.get(f"{API}/projects", headers=admin_headers)
        pid = r.json()[0]["id"]
        d = requests.get(f"{API}/projects/{pid}", headers=admin_headers)
        assert d.status_code == 200
        detail = d.json()
        assert "assigned_workers" in detail
        assert "photo_count" in detail
        assert "log_count" in detail


# ---------- MATERIALS ----------
class TestMaterials:
    def test_admin_materials_count(self, admin_headers):
        r = requests.get(f"{API}/materials", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 50, f"Expected >=50 materials, got {len(data)}"
        assert any(m.get("unit_price") is not None for m in data), "Admin should see unit_price"

    def test_worker_materials_unit_price_hidden(self, worker_headers):
        r = requests.get(f"{API}/materials", headers=worker_headers)
        assert r.status_code == 200
        for m in r.json():
            assert m.get("unit_price") is None, "Worker should not see unit_price"

    def test_materials_filter_by_category(self, admin_headers):
        r = requests.get(f"{API}/materials?category=VIDRIO", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) > 0
        for m in data:
            assert m.get("category") == "VIDRIO"


# ---------- MATERIAL ENTRIES ----------
class TestMaterialEntries:
    def test_create_material_entry_admin(self, admin_headers):
        projects = requests.get(f"{API}/projects", headers=admin_headers).json()
        materials = requests.get(f"{API}/materials", headers=admin_headers).json()
        payload = {
            "project_id": projects[0]["id"],
            "material_id": materials[0]["id"],
            "quantity": 5.0,
        }
        r = requests.post(f"{API}/material-entries", json=payload, headers=admin_headers)
        assert r.status_code in (200, 201), r.text
        entry = r.json()
        assert entry.get("total_cost") is not None
        expected = 5.0 * materials[0]["unit_price"]
        assert abs(entry["total_cost"] - expected) < 0.01

    def test_worker_material_entry_no_cost(self, worker_headers, admin_headers):
        worker_projects = requests.get(f"{API}/projects", headers=worker_headers).json()
        assert len(worker_projects) > 0
        materials = requests.get(f"{API}/materials", headers=admin_headers).json()
        payload = {
            "project_id": worker_projects[0]["id"],
            "material_id": materials[0]["id"],
            "quantity": 2.0,
        }
        r = requests.post(f"{API}/material-entries", json=payload, headers=worker_headers)
        assert r.status_code in (200, 201), r.text
        entry = r.json()
        assert entry.get("total_cost") is None, "Worker should not see total_cost"

    def test_list_material_entries(self, admin_headers):
        projects = requests.get(f"{API}/projects", headers=admin_headers).json()
        r = requests.get(f"{API}/material-entries?project_id={projects[0]['id']}", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if data:
            # enriched with material info
            assert any("material" in e or "material_name" in e or "name" in e for e in data)


# ---------- DAILY LOGS ----------
class TestDailyLogs:
    def test_create_log_short_description_fails(self, worker_headers):
        projects = requests.get(f"{API}/projects", headers=worker_headers).json()
        payload = {
            "project_id": projects[0]["id"],
            "date": "2026-01-15",
            "hours_worked": 8.0,
            "work_description": "short",
            "weather": "SOLEADO",
            "progress_percentage": 50,
        }
        r = requests.post(f"{API}/daily-logs", json=payload, headers=worker_headers)
        assert r.status_code == 400, f"Expected 400 for short desc, got {r.status_code}: {r.text}"

    def test_create_log_success_pending(self, worker_headers):
        projects = requests.get(f"{API}/projects", headers=worker_headers).json()
        payload = {
            "project_id": projects[0]["id"],
            "date": "2026-01-15",
            "hours_worked": 8.0,
            "work_description": "TEST_ Instalación de ventanas en fachada principal, trabajo normal sin incidencias.",
            "weather": "SOLEADO",
            "progress_percentage": 50,
        }
        r = requests.post(f"{API}/daily-logs", json=payload, headers=worker_headers)
        assert r.status_code in (200, 201), r.text
        log = r.json()
        assert log.get("status") == "PENDING"
        pytest.log_id = log["id"]

    def test_worker_cannot_review(self, worker_headers):
        log_id = getattr(pytest, "log_id", None)
        if not log_id:
            pytest.skip("No log created")
        r = requests.patch(f"{API}/daily-logs/{log_id}/review",
                          json={"status": "APPROVED"}, headers=worker_headers)
        assert r.status_code == 403

    def test_manager_review_approve(self, admin_headers):
        log_id = getattr(pytest, "log_id", None)
        if not log_id:
            pytest.skip("No log created")
        r = requests.patch(f"{API}/daily-logs/{log_id}/review",
                          json={"status": "APPROVED"}, headers=admin_headers)
        assert r.status_code == 200, r.text
        assert r.json().get("status") == "APPROVED"

    def test_log_with_incident_creates_alert(self, worker_headers, admin_headers):
        projects = requests.get(f"{API}/projects", headers=worker_headers).json()
        before = requests.get(f"{API}/alerts", headers=admin_headers).json()
        before_count = len(before)
        payload = {
            "project_id": projects[0]["id"],
            "date": "2026-01-16",
            "hours_worked": 7.0,
            "work_description": "TEST_ Problema grave con la estructura, requiere atención inmediata del jefe.",
            "weather": "LLUVIA",
            "progress_percentage": 30,
            "incidents": "Rotura de cristal al descargar el camión, pieza dañada",
        }
        r = requests.post(f"{API}/daily-logs", json=payload, headers=worker_headers)
        assert r.status_code in (200, 201), r.text
        after = requests.get(f"{API}/alerts", headers=admin_headers).json()
        assert len(after) > before_count, "Incident should have created an alert"


# ---------- PHOTOS ----------
class TestPhotos:
    def test_create_photo(self, admin_headers):
        projects = requests.get(f"{API}/projects", headers=admin_headers).json()
        tiny_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        payload = {
            "project_id": projects[0]["id"],
            "image_base64": tiny_b64,
            "caption": "TEST_ photo",
            "photo_type": "PROGRESS",
        }
        r = requests.post(f"{API}/photos", json=payload, headers=admin_headers)
        assert r.status_code in (200, 201), r.text

    def test_list_photos(self, admin_headers):
        projects = requests.get(f"{API}/projects", headers=admin_headers).json()
        r = requests.get(f"{API}/photos?project_id={projects[0]['id']}", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- DASHBOARD ----------
class TestDashboard:
    def test_dashboard_admin(self, admin_headers):
        r = requests.get(f"{API}/dashboard/summary", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ("active_projects", "workers_today", "week_spend", "month_spend",
                  "pending_logs", "open_alerts", "spend_by_project", "photo_feed"):
            assert k in d, f"Missing KPI {k}"
        assert isinstance(d["spend_by_project"], list)
        assert isinstance(d["photo_feed"], list)

    def test_dashboard_worker_forbidden(self, worker_headers):
        r = requests.get(f"{API}/dashboard/summary", headers=worker_headers)
        assert r.status_code == 403


# ---------- ALERTS ----------
class TestAlerts:
    def test_list_alerts(self, admin_headers):
        r = requests.get(f"{API}/alerts", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 3, f"Expected >=3 seeded alerts, got {len(data)}"

    def test_mark_alert_read(self, admin_headers):
        alerts = requests.get(f"{API}/alerts", headers=admin_headers).json()
        aid = alerts[0]["id"]
        r = requests.patch(f"{API}/alerts/{aid}/read", headers=admin_headers)
        assert r.status_code == 200


# ---------- USERS ----------
class TestUsers:
    def test_list_users_admin_enriched(self, admin_headers):
        r = requests.get(f"{API}/users", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 4, f"Expected >=4 users, got {len(data)}"
        u = data[0]
        for k in ("hours_this_month", "projects_count", "logs_this_month"):
            assert k in u, f"Missing enriched field {k}"

    def test_worker_cannot_create_user(self, worker_headers):
        payload = {"name": "TEST_u", "email": "test_denied@x.com", "password": "Worker1234!", "role": "WORKER"}
        r = requests.post(f"{API}/users", json=payload, headers=worker_headers)
        assert r.status_code == 403

    def test_admin_can_create_user(self, admin_headers):
        import uuid
        payload = {
            "name": "TEST_New Worker",
            "email": f"test_{uuid.uuid4().hex[:8]}@elegantglass.es",
            "password": "Worker1234!",
            "role": "WORKER",
        }
        r = requests.post(f"{API}/users", json=payload, headers=admin_headers)
        assert r.status_code in (200, 201), r.text
        assert r.json()["email"] == payload["email"]


# ---------- REPORTS ----------
class TestReports:
    def test_list_weekly_reports(self, admin_headers):
        r = requests.get(f"{API}/reports/weekly", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 2, f"Expected >=2 seeded reports, got {len(data)}"

    def test_generate_weekly_report(self, admin_headers):
        r = requests.post(f"{API}/reports/weekly/generate", headers=admin_headers)
        assert r.status_code in (200, 201), r.text
        rep = r.json()
        assert "summary" in rep or "total_spend" in rep or "week_start" in rep
