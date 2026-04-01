# Tests del dashboard KPIs contra API en localhost:8000
class TestDashboard:

    def test_summary_estructura(self, api):
        resp = api.get("/dashboard/summary")
        assert resp.status_code == 200
        data = resp.json()
        assert "total_items" in data
        assert "total_purchase_value" in data
        assert "total_market_value" in data
        assert "potential_margin" in data
        assert "avg_margin_pct" in data

    def test_summary_valores_numericos(self, api):
        resp = api.get("/dashboard/summary")
        data = resp.json()
        assert int(data["total_items"]) >= 0
        assert float(data["total_purchase_value"]) >= 0
        assert isinstance(data["avg_margin_pct"], (int, float))

    def test_summary_refleja_inventario(self, api, test_product):
        """Con al menos un producto, total_items debe ser >= 1."""
        resp = api.get("/dashboard/summary")
        data = resp.json()
        assert int(data["total_items"]) >= 1

    def test_top_margin_lista(self, api):
        resp = api.get("/dashboard/top-margin")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_top_margin_estructura(self, api):
        resp = api.get("/dashboard/top-margin")
        items = resp.json()
        if items:
            item = items[0]
            assert "id" in item
            assert "name" in item
            assert "margin_pct" in item

    def test_price_trends(self, api):
        resp = api.get("/dashboard/price-trends")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
