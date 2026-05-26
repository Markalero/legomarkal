from fastapi.testclient import TestClient

def test_create_set(client: TestClient):
    payload = {
        "product_id": "75192",
        "name": "Millennium Falcon",
        "theme": "Star Wars",
        "buy_price": 700.0,
        "quantity": 1,
        "condition": "MISB",
        "status": "IN_STOCK"
    }
    response = client.post("/api/sets/", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["product_id"] == "75192"
    assert data["name"] == "Millennium Falcon"
    assert "id" in data

def test_get_sets(client: TestClient):
    # Setup test set
    test_create_set(client)
    
    response = client.get("/api/sets/")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["product_id"] == "75192"

def test_update_set(client: TestClient):
    # Setup test set
    create_resp = client.post("/api/sets/", json={
        "product_id": "10281",
        "name": "Bonsai Tree",
        "theme": "Botanical",
        "buy_price": 40.0,
        "quantity": 1,
        "condition": "MISB",
        "status": "IN_STOCK"
    })
    set_id = create_resp.json()["id"]

    # Update
    response = client.put(f"/api/sets/{set_id}", json={
        "current_price": 55.0,
        "status": "SOLD"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["current_price"] == 55.0
    assert data["status"] == "SOLD"

def test_delete_set(client: TestClient):
    create_resp = client.post("/api/sets/", json={
        "product_id": "99999",
        "name": "To Delete",
        "buy_price": 10.0,
        "quantity": 1,
        "condition": "USED",
        "status": "IN_STOCK"
    })
    set_id = create_resp.json()["id"]

    response = client.delete(f"/api/sets/{set_id}")
    assert response.status_code == 200
    
    get_resp = client.get(f"/api/sets/{set_id}")
    assert get_resp.status_code == 404
