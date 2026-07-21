from app import open_food_facts


def _add_product(client, monkeypatch, barcode, name, category=None):
    monkeypatch.setattr(
        open_food_facts,
        "lookup",
        lambda b: open_food_facts.LookupResult(name=name, category=category),
    )
    client.get(f"/products/{barcode}")


def test_search_products_matches_by_partial_name_case_insensitively(
    client, monkeypatch
):
    _add_product(client, monkeypatch, "1", "Oat Milk", "Dairy")
    _add_product(client, monkeypatch, "2", "Whole Milk", "Dairy")
    _add_product(client, monkeypatch, "3", "Bread", "Bakery")

    response = client.get("/products", params={"q": "milk"})

    assert response.status_code == 200
    names = {p["name"] for p in response.json()}
    assert names == {"Oat Milk", "Whole Milk"}


def test_search_products_blank_query_returns_nothing(client, monkeypatch):
    _add_product(client, monkeypatch, "1", "Oat Milk")

    response = client.get("/products", params={"q": "  "})

    assert response.status_code == 200
    assert response.json() == []


def test_search_products_no_match_returns_empty_list(client, monkeypatch):
    _add_product(client, monkeypatch, "1", "Oat Milk")

    response = client.get("/products", params={"q": "nonexistent"})

    assert response.status_code == 200
    assert response.json() == []


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
