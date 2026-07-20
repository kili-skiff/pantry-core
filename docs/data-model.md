# Data model

Reflects the schema as it actually exists in `backend/app/models.py` right
now — update this diagram in the same PR as any migration that changes it.
For the reasoning behind a given shape, see `docs/decisions/`.

```mermaid
erDiagram
    INVENTORY_ITEMS {
        int id PK
        string name
        string category
        float quantity
        string unit
        date expiry_date
        date added_at
        string source "manual / imported"
    }
```
