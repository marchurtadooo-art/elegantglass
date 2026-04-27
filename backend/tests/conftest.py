"""Shared fixtures for GLASSWORK backend tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://site-glass-preview.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "jefe@elegantglass.es", "password": "Admin1234!"}
WORKER = {"email": "carlos@elegantglass.es", "password": "Worker1234!"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"Login failed {creds['email']}: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def api_base():
    return API


@pytest.fixture(scope="session")
def admin_tokens():
    return _login(ADMIN)


@pytest.fixture(scope="session")
def worker_tokens():
    return _login(WORKER)


@pytest.fixture(scope="session")
def admin_headers(admin_tokens):
    return {"Authorization": f"Bearer {admin_tokens['access_token']}"}


@pytest.fixture(scope="session")
def worker_headers(worker_tokens):
    return {"Authorization": f"Bearer {worker_tokens['access_token']}"}
