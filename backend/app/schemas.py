from datetime import date

from pydantic import BaseModel, ConfigDict

from app.models import Source


class InventoryItemBase(BaseModel):
    name: str
    category: str
    quantity: float
    unit: str
    expiry_date: date | None = None


class InventoryItemCreate(InventoryItemBase):
    pass


class InventoryItemRead(InventoryItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    added_at: date
    source: Source
