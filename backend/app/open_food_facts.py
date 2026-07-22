from urllib.parse import quote

import httpx2
from pydantic import BaseModel, ValidationError

API_URL = "https://world.openfoodfacts.org/api/v2/product/{barcode}.json"
TIMEOUT = 5.0


class _Product(BaseModel):
    product_name: str | None = None
    categories: str | None = None


class _Response(BaseModel):
    status: int
    product: _Product = _Product()


class LookupResult(BaseModel):
    name: str
    category: str | None = None


def lookup(barcode: str) -> LookupResult | None:
    """Look up a barcode via the Open Food Facts API.

    Returns None on any failure (not listed, network error, unexpected
    response shape) so the caller can fall back to manual entry.
    """
    try:
        response = httpx2.get(
            API_URL.format(barcode=quote(barcode, safe="")),
            params={"fields": "product_name,categories"},
            timeout=TIMEOUT,
        )
        response.raise_for_status()
        parsed = _Response.model_validate(response.json())
    except (httpx2.HTTPError, ValidationError):
        return None

    if parsed.status != 1 or not parsed.product.product_name:
        return None

    category = None
    if parsed.product.categories:
        category = parsed.product.categories.split(",")[0].strip() or None

    return LookupResult(name=parsed.product.product_name, category=category)
