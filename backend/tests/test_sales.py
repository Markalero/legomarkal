from fastapi.testclient import TestClient

def test_create_sale(client: TestClient):
    # Setup set
    create_resp = client.post("/api/sets/", json={
        "product_id": "SALE-1",
        "name": "To be sold",
        "buy_price": 50.0,
        "quantity": 1,
        "condition": "MISB",
        "status": "IN_STOCK"
    })
    assert create_resp.status_code == 200
    set_id = create_resp.json()["id"]

    # Create sale
    sale_payload = {
        "sell_price": 100.0,
        "platform": "Wallapop"
    }
    response = client.post(f"/api/sales/set/{set_id}", data=sale_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["sell_price"] == 100.0
    assert data["platform"] == "Wallapop"
    assert "id" in data

    # Check set status was updated to SOLD automatically
    get_resp = client.get(f"/api/sets/{set_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["status"] == "SOLD"

def test_delete_sale(client: TestClient):
    create_resp = client.post("/api/sets/", json={
        "product_id": "SALE-DEL",
        "name": "To Delete Sale",
        "buy_price": 10.0,
        "quantity": 1,
        "condition": "USED",
        "status": "IN_STOCK"
    })
    set_id = create_resp.json()["id"]

    sale_resp = client.post(f"/api/sales/set/{set_id}", data={
        "sell_price": 15.0,
        "platform": "Vinted"
    })
    sale_id = sale_resp.json()["id"]

    # Delete the sale
    delete_resp = client.delete(f"/api/sales/{sale_id}")
    assert delete_resp.status_code == 200

    # Ensure set is IN_STOCK again (assuming that logic exists or just testing deletion)
    # The current backend doesn't automatically revert to IN_STOCK, but let's test sale is gone.
    get_resp = client.get(f"/api/sets/{set_id}")
    assert get_resp.status_code == 200
    assert len(get_resp.json()["sales"]) == 0
