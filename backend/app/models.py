import enum
from datetime import date

from sqlalchemy import Date, Enum, Float, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Source(str, enum.Enum):
    manual = "manual"
    imported = "imported"


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String, nullable=False)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    added_at: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    source: Mapped[Source] = mapped_column(Enum(Source), nullable=False, default=Source.manual)
