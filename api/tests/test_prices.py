# Tests de precios de mercado contra API en localhost:8000
class TestMarketPrices:

    def test_historial_producto(self, api, test_product):
        resp = api.get(f"/market-prices/{test_product['id']}")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_historial_producto_inexistente(self, api):
        fake_id = "00000000-0000-0000-0000-000000000000"
        resp = api.get(f"/market-prices/{fake_id}")
        assert resp.status_code in (200, 404)
        if resp.status_code == 200:
            assert resp.json() == []

    def test_scrape_trigger_background(self, api, test_product):
        resp = api.post(f"/market-prices/scrape/{test_product['id']}")
        assert resp.status_code in (200, 202)
        data = resp.json()
        assert "message" in data
