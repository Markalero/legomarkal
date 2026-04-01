# Fixtures para tests de integración contra la API viva en localhost:8000
import os
import pytest
import requests

BASE_URL = os.getenv("TEST_BASE_URL", "http://localhost:8000")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def token(base_url):
    """Obtiene JWT de administrador al iniciar la sesión de tests."""
    resp = requests.post(f"{base_url}/auth/login", json={
        "email": "markalaladren@gmail.com",
        "password": "markaleroputero69"
    })
    assert resp.status_code == 200, f"Login fallido: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture(scope="session")
def auth_headers(token):
    """Cabeceras HTTP con Bearer token."""
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def api(base_url, auth_headers):
    """Wrapper de requests con auth pre-configurada."""
    class API:
        def get(self, path, **kw):
            return requests.get(f"{base_url}{path}", headers=auth_headers, **kw)

        def post(self, path, **kw):
            return requests.post(f"{base_url}{path}", headers=auth_headers, **kw)

        def put(self, path, **kw):
            return requests.put(f"{base_url}{path}", headers=auth_headers, **kw)

        def delete(self, path, **kw):
            return requests.delete(f"{base_url}{path}", headers=auth_headers, **kw)
    return API()


@pytest.fixture(scope="session")
def test_product(api):
    """Crea un producto de test y lo elimina al finalizar la sesión."""
    resp = api.post("/products", json={
        "name": "TEST — Set Pytest (borrar)",
        "set_number": "TEST01",
        "theme": "Tests",
        "condition": "SEALED",
        "purchase_price": 100.0,
        "quantity": 1,
    })
    assert resp.status_code == 201
    product = resp.json()
    yield product
    api.delete(f"/products/{product['id']}")
