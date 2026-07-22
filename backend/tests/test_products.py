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


def test_search_products_blank_query_lists_the_whole_catalog(client, monkeypatch):
    _add_product(client, monkeypatch, "1", "Oat Milk")
    _add_product(client, monkeypatch, "2", "Bread")

    response = client.get("/products", params={"q": "  "})

    assert response.status_code == 200
    names = {p["name"] for p in response.json()}
    assert names == {"Oat Milk", "Bread"}

    # Same behaviour with no q param at all - used by the product catalog
    # view to list everything.
    response = client.get("/products")
    assert response.status_code == 200
    assert len(response.json()) == 2


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


def test_get_product_reuses_a_barcode_less_product_of_the_same_name(
    client, monkeypatch
):
    # A manual item entry already created a barcode-less "Nutella" product.
    client.post("/items", json={"name": "Nutella", "quantity": 1, "unit": "pcs"})

    monkeypatch.setattr(
        open_food_facts,
        "lookup",
        lambda barcode: open_food_facts.LookupResult(
            name="Nutella", category="Spreads"
        ),
    )
    response = client.get("/products/3017620422003")

    assert response.status_code == 200
    body = response.json()
    assert body["barcode"] == "3017620422003"
    assert body["category"] == "Spreads"

    catalog = client.get("/products").json()
    assert len(catalog) == 1


def test_get_product_not_found(client, monkeypatch):
    monkeypatch.setattr(open_food_facts, "lookup", lambda barcode: None)

    response = client.get("/products/0000000000000")
    assert response.status_code == 404


def test_update_product(client, monkeypatch):
    _add_product(client, monkeypatch, "1", "milch")
    product_id = client.get("/products", params={"q": "milch"}).json()[0]["id"]

    response = client.patch(
        f"/products/{product_id}",
        json={"name": "Milch", "category": "Dairy", "default_unit": "l"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Milch"
    assert body["category"] == "Dairy"
    assert body["default_unit"] == "l"


def test_update_product_not_found(client):
    response = client.patch("/products/999", json={"name": "Milch"})
    assert response.status_code == 404


def test_update_product_rejects_blank_name(client, monkeypatch):
    _add_product(client, monkeypatch, "1", "Milch")
    product_id = client.get("/products", params={"q": "milch"}).json()[0]["id"]

    response = client.patch(f"/products/{product_id}", json={"name": "   "})
    assert response.status_code == 422
