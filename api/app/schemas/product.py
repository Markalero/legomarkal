# Schemas Pydantic para validación y serialización de Product
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.price import MarketPriceOut


# ── Product ───────────────────────────────────────────────────────────────────

ConditionType = Literal["SEALED", "OPEN_COMPLETE", "OPEN_INCOMPLETE"]
AvailabilityType = Literal["available", "sold"]


class ProductBase(BaseModel):
    """Campos compartidos por todos los contratos de producto (alta, edición y lectura)."""

    set_number: Optional[str] = Field(None, max_length=20)
    name: str = Field(..., max_length=255)
    theme: Optional[str] = Field(None, max_length=100)
    year_released: Optional[int] = None
    condition: Optional[ConditionType] = None
    purchase_price: Optional[Decimal] = None
    purchase_date: Optional[date] = None
    purchase_source: Optional[str] = None
    quantity: int = 1
    images: List[str] = []
    notes: Optional[str] = None
    availability: AvailabilityType = "available"


class ProductCreate(ProductBase):
    pass


class ProductUpdate(ProductBase):
    name: Optional[str] = None  # todos los campos son opcionales en edición
    quantity: Optional[int] = None
    availability: Optional[AvailabilityType] = None
    sold_date: Optional[date] = None
    sold_price: Optional[Decimal] = None
    sale_receipts: Optional[List[Dict[str, Any]]] = None


class ProductOut(ProductBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None
    latest_market_price: Optional[MarketPriceOut] = None
    sold_date: Optional[date] = None
    sold_price: Optional[Decimal] = None
    sale_receipts: List[Dict[str, Any]] = []

    model_config = {"from_attributes": True}


class ProductQuickCreate(BaseModel):
    """Alta rápida de producto usando set_number + datos mínimos de compra."""

    set_number: str = Field(
        ...,
        min_length=3,
        max_length=20,
        pattern=r"^\d{3,7}(?:-\d+)?$",
        description="Número de set LEGO válido (ej. 75192 o 75192-1)",
    )
    condition: ConditionType
    purchase_price: Decimal = Field(..., gt=0)
    purchase_date: date
    purchase_source: str = Field(..., min_length=1, max_length=255)
    quantity: int = Field(1, ge=1)
    notes: Optional[str] = None


# ── Listado con paginación ────────────────────────────────────────────────────

class ProductListOut(BaseModel):
    items: List[ProductOut]
    total: int
    page: int
    size: int
    pages: int
