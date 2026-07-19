def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_and_list_item(client):
    payload = {
        "name": "Milk",
        "category": "Dairy",
        "quantity": 1,
        "unit": "l",
        "expiry_date": "2026-08-01",
    }
    create_response = client.post("/items", json=payload)
    assert create_response.status_code == 201
    body = create_response.json()
    assert body["name"] == "Milk"
    assert body["source"] == "manual"
    assert "id" in body

    list_response = client.get("/items")
    assert list_response.status_code == 200
    items = list_response.json()
    assert len(items) == 1
    assert items[0]["name"] == "Milk"


def test_create_item_without_expiry_date(client):
    payload = {"name": "Rice", "category": "Grains", "quantity": 2, "unit": "kg"}
    response = client.post("/items", json=payload)
    assert response.status_code == 201
    assert response.json()["expiry_date"] is None


def test_create_item_without_category(client):
    payload = {"name": "Bread", "quantity": 1, "unit": "pcs"}
    response = client.post("/items", json=payload)
    assert response.status_code == 201
    assert response.json()["category"] is None


def test_delete_item(client):
    create_response = client.post(
        "/items",
        json={"name": "Eggs", "category": "Dairy", "quantity": 6, "unit": "pcs"},
    )
    item_id = create_response.json()["id"]

    delete_response = client.delete(f"/items/{item_id}")
    assert delete_response.status_code == 204

    list_response = client.get("/items")
    assert list_response.json() == []


def test_delete_item_not_found(client):
    response = client.delete("/items/999")
    assert response.status_code == 404
