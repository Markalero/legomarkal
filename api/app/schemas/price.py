# Schemas Pydantic para MarketPrice, PriceAlert y Dashboard
from datetime import datetime
from decimal import Decimal
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ── MarketPrice ───────────────────────────────────────────────────────────────

SourceType = Literal["bricklink", "brickeconomy", "ebay"]
AlertType = Literal["PRICE_ABOVE", "PRICE_BELOW", "PRICE_CHANGE_PCT"]


class MarketPriceOut(BaseModel):
    id: UUID
    product_id: UUID
    source: SourceType
    price_new: Optional[Decimal]
    min_price_new: Optional[Decimal]
    max_price_new: Optional[Decimal]
    price_used: Optional[Decimal]
    min_price_used: Optional[Decimal]
    max_price_used: Optional[Decimal]
    currency: str
    fetched_at: datetime

    model_config = {"from_attributes": True}


# ── PriceAlert ────────────────────────────────────────────────────────────────

class PriceAlertCreate(BaseModel):
    product_id: UUID
    alert_type: AlertType
    threshold_value: Decimal = Field(..., gt=0)


class PriceAlertOut(BaseModel):
    id: UUID
    product_id: UUID
    alert_type: AlertType
    threshold_value: Decimal
    is_active: bool
    last_triggered: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Dashboard ─────────────────────────────────────────────────────────────────

class DashboardSummary(BaseModel):
    total_items: int
    total_purchase_value: Decimal
    total_market_value: Decimal
    potential_margin: Decimal
    avg_margin_pct: float


class TopMarginProduct(BaseModel):
    id: UUID
    name: str
    set_number: Optional[str]
    purchase_price: Optional[Decimal]
    market_value: Optional[Decimal]
    margin_pct: Optional[float]


class PriceTrendPoint(BaseModel):
    date: datetime
    invested_value: Decimal
    market_value: Decimal
    profit_value: Decimal


class PriceDetailTrendPoint(BaseModel):
    date: datetime
    min_price: Decimal
    avg_price: Decimal
    max_price: Decimal


class PriceInsightProduct(BaseModel):
    id: UUID
    name: str
    set_number: Optional[str]
    condition: Optional[str]
    purchase_price: Optional[Decimal]
    current_market_price: Optional[Decimal]
    min_market_price: Optional[Decimal]
    max_market_price: Optional[Decimal]
    avg_market_price: Optional[Decimal]
    profit_eur: Optional[Decimal]


class SetCodePriceOut(BaseModel):
    set_number: str
    source: SourceType
    price_new: Optional[Decimal]
    min_price_new: Optional[Decimal]
    max_price_new: Optional[Decimal]
    price_used: Optional[Decimal]
    min_price_used: Optional[Decimal]
    max_price_used: Optional[Decimal]
    currency: str
    fetched_at: datetime


class ProductPriceHistoryPoint(BaseModel):
    date: datetime
    price_new: Optional[Decimal]
    price_used: Optional[Decimal]


class ProductPriceHistoryOut(BaseModel):
    product_id: UUID
    condition: Optional[str]
    guide_type: str
    points: List[ProductPriceHistoryPoint]


class RealProfitSummary(BaseModel):
    """Métricas de beneficios reales de productos ya vendidos."""
    total_sold_items: int
    total_sold_revenue: Decimal
    total_real_profit: Decimal
    avg_profit_per_item: Decimal
