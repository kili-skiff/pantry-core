# Data model

Reflects the schema as it actually exists in `backend/app/models.py` right
now — update this diagram in the same PR as any migration that changes it.
For the reasoning behind a given shape, see `docs/decisions/`.

```mermaid
erDiagram
    PRODUCTS ||--o{ INVENTORY_ITEMS : "scanned from"

    PRODUCTS {
        int id PK
        string barcode UK
        string name
        string category
        string default_unit
    }

    INVENTORY_ITEMS {
        int id PK
        int product_id FK "nullable"
        string name
        string category
        float quantity
        string unit
        date expiry_date
        date added_at
        string source "manual / imported / scanned"
    }
```
