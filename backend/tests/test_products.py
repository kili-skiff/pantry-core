from app import open_food_facts


def test_get_product_looks_up_and_caches(client, monkeypatch):
    calls = []

    def fake_lookup(barcode):
        calls.append(barcode)
        return open_food_facts.LookupResult(name="Nutella", category="Spreads")

    monkeypatch.setattr(open_food_facts, "lookup", fake_lookup)

    response = client.get("/products/3017620422003")
    assert response.status_code == 200
    body = response.json()
    assert body["barcode"] == "3017620422003"
    assert body["name"] == "Nutella"
    assert body["category"] == "Spreads"

    # Second request hits the local cache, not the external lookup again.
    response = client.get("/products/3017620422003")
    assert response.status_code == 200
    assert calls == ["3017620422003"]


def test_get_product_not_found(client, monkeypatch):
    monkeypatch.setattr(open_food_facts, "lookup", lambda barcode: None)

    response = client.get("/products/0000000000000")
    assert response.status_code == 404
