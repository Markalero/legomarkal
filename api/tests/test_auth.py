# Tests de autenticación JWT contra API en localhost:8000
import os
import requests

BASE_URL = os.getenv("TEST_BASE_URL", "http://localhost:8000")


class TestAuth:

    def test_login_correcto(self):
        resp = requests.post(f"{BASE_URL}/auth/login", json={
            "email": "markalaladren@gmail.com",
            "password": "markaleroputero69"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert len(data["access_token"].split(".")) == 3

    def test_login_password_incorrecto(self):
        resp = requests.post(f"{BASE_URL}/auth/login", json={
            "email": "markalaladren@gmail.com",
            "password": "contraseña_incorrecta"
        })
        assert resp.status_code == 401

    def test_login_email_incorrecto(self):
        resp = requests.post(f"{BASE_URL}/auth/login", json={
            "email": "otro@ejemplo.com",
            "password": "markaleroputero69"
        })
        assert resp.status_code == 401

    def test_endpoint_protegido_sin_token(self):
        resp = requests.get(f"{BASE_URL}/products")
        assert resp.status_code == 401

    def test_endpoint_protegido_token_invalido(self):
        resp = requests.get(f"{BASE_URL}/products",
                            headers={"Authorization": "Bearer token_inventado"})
        assert resp.status_code == 401

    def test_health_sin_auth(self):
        resp = requests.get(f"{BASE_URL}/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"
