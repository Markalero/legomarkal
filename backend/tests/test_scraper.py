from fastapi.testclient import TestClient

def test_webhook_unauthorized(client: TestClient):
    response = client.post("/api/scraper/webhook", json={"prices": []}, headers={"X-Scraper-Api-Key": "wrong-key"})
    assert response.status_code == 403

def test_webhook_success(client: TestClient):
    # Setup test set
    create_resp = client.post("/api/sets/", json={
        "product_id": "80808",
        "name": "Webhook Test",
        "buy_price": 20.0,
        "quantity": 1,
        "condition": "MISB",
        "status": "IN_STOCK"
    })
    set_id = create_resp.json()["id"]

    # Trigger webhook
    payload = {
        "prices": [
            {
                "product_id": "80808",
                "current_price": 25.50
            }
        ]
    }
    response = client.post(
        "/api/scraper/webhook", 
        json=payload, 
        headers={"X-Scraper-Api-Key": "test-secret-key"}
    )
    assert response.status_code == 200
    assert response.json()["message"] == "Successfully updated 1 sets"

    # Verify set price was updated
    get_resp = client.get(f"/api/sets/{set_id}")
    assert get_resp.json()["current_price"] == 25.50
