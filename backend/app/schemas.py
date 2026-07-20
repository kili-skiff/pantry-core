from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import Source

Unit = Literal["g", "kg", "ml", "l", "pcs"]


class InventoryItemBase(BaseModel):
    name: str = Field(min_length=1)
    category: str | None = None
    quantity: float = Field(gt=0)
    unit: Unit
    expiry_date: date | None = None

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


class InventoryItemCreate(InventoryItemBase):
    pass


class InventoryItemRead(InventoryItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    added_at: date
    source: Source
