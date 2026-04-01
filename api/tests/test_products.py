# Tests CRUD de productos contra API en localhost:8000
import pytest


class TestProductsCRUD:

    def test_list_products(self, api):
        resp = api.get("/products")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "size" in data
        assert "pages" in data
        assert data["page"] == 1
        assert isinstance(data["items"], list)

    def test_create_product(self, api):
        payload = {
            "name": "Test Technic 42083",
            "set_number": "42083",
            "theme": "Technic",
            "condition": "SEALED",
            "purchase_price": 200.0,
            "quantity": 1,
        }
        resp = api.post("/products", json=payload)
        assert resp.status_code == 201
        product = resp.json()
        assert product["name"] == payload["name"]
        assert product["condition"] == "SEALED"
        assert float(product["purchase_price"]) == 200.0
        assert "id" in product
        # Cleanup
        api.delete(f"/products/{product['id']}")

    def test_get_product(self, api, test_product):
        resp = api.get(f"/products/{test_product['id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == test_product["id"]
        assert data["name"] == test_product["name"]

    def test_update_product(self, api, test_product):
        resp = api.put(
            f"/products/{test_product['id']}",
            json={"purchase_source": "BrickLink", "availability": "sold"}
        )
        assert resp.status_code == 200
        updated = resp.json()
        assert updated["purchase_source"] == "BrickLink"
        assert updated["availability"] == "sold"

    def test_get_product_no_existe(self, api):
        fake_id = "00000000-0000-0000-0000-000000000000"
        resp = api.get(f"/products/{fake_id}")
        assert resp.status_code == 404

    def test_delete_product(self, api):
        resp = api.post("/products", json={"name": "Borrar este", "quantity": 1})
        assert resp.status_code == 201
        product_id = resp.json()["id"]

        del_resp = api.delete(f"/products/{product_id}")
        assert del_resp.status_code in (200, 204)

        # El producto ya no debe aparecer en la lista
        list_resp = api.get("/products")
        ids = [p["id"] for p in list_resp.json()["items"]]
        assert product_id not in ids

    def test_filter_por_condicion(self, api):
        resp = api.get("/products?condition=SEALED")
        assert resp.status_code == 200
        for item in resp.json()["items"]:
            assert item["condition"] == "SEALED"

    def test_busqueda_por_nombre(self, api, test_product):
        resp = api.get("/products?search=Pytest")
        assert resp.status_code == 200
        ids = [p["id"] for p in resp.json()["items"]]
        assert test_product["id"] in ids

    def test_paginacion(self, api):
        resp = api.get("/products?page=1&size=2")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) <= 2
        assert data["size"] == 2
