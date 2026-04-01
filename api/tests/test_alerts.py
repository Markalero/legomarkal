# Tests de alertas de precio contra API en localhost:8000
import pytest


class TestPriceAlerts:

    def test_list_alerts(self, api):
        resp = api.get("/price-alerts")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_create_alert(self, api, test_product):
        resp = api.post("/price-alerts", json={
            "product_id": test_product["id"],
            "alert_type": "PRICE_BELOW",
            "threshold_value": 80.0
        })
        assert resp.status_code == 201
        alert = resp.json()
        assert alert["alert_type"] == "PRICE_BELOW"
        assert float(alert["threshold_value"]) == 80.0
        assert alert["is_active"] is True
        # Cleanup
        api.delete(f"/price-alerts/{alert['id']}")

    def test_delete_alert(self, api, test_product):
        create_resp = api.post("/price-alerts", json={
            "product_id": test_product["id"],
            "alert_type": "PRICE_CHANGE_PCT",
            "threshold_value": 10.0
        })
        alert_id = create_resp.json()["id"]

        del_resp = api.delete(f"/price-alerts/{alert_id}")
        assert del_resp.status_code in (200, 204)

        list_resp = api.get("/price-alerts")
        ids = [a["id"] for a in list_resp.json()]
        assert alert_id not in ids

    def test_create_alert_threshold_invalido(self, api, test_product):
        resp = api.post("/price-alerts", json={
            "product_id": test_product["id"],
            "alert_type": "PRICE_ABOVE",
            "threshold_value": -10.0
        })
        assert resp.status_code == 422
