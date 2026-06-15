from fastapi.testclient import TestClient

def test_dashboard_metrics(client: TestClient):
    # Create an in stock item
    client.post("/api/sets/", json={
        "product_id": "METRICS-1",
        "name": "Invested",
        "buy_price": 50.0,
        "quantity": 2,
        "condition": "MISB",
        "status": "IN_STOCK",
        "current_price": 100.0
    })

    # Create a sold item
    create_resp = client.post("/api/sets/", json={
        "product_id": "METRICS-2",
        "name": "Sold",
        "buy_price": 40.0,
        "quantity": 1,
        "condition": "MISB",
        "status": "IN_STOCK"
    })
    set_id = create_resp.json()["id"]
    client.post(f"/api/sales/set/{set_id}", data={
        "sell_price": 80.0,
        "platform": "Vinted"
    })

    response = client.get("/api/metrics/dashboard")
    assert response.status_code == 200
    data = response.json()
    # It aggregates based on all tests in the db, but we check if it returns correct schema types
    assert "total_investment" in data
    assert "current_value" in data
    assert "sets_in_stock" in data
    assert data["sets_in_stock"] >= 2
    assert "sets_sold" in data
    assert data["sets_sold"] >= 1
    assert "realized_profit" in data

def test_history_metrics(client: TestClient):
    response = client.get("/api/metrics/history")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

def test_top_performers(client: TestClient):
    response = client.get("/api/metrics/top-performers")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
