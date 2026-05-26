from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from models import SetStatus, SetCondition

# --- Price History Schemas ---
class PriceHistoryBase(BaseModel):
    price: float

class PriceHistory(PriceHistoryBase):
    id: int
    lego_set_id: int
    recorded_at: datetime

    class Config:
        from_attributes = True

# --- Sales Schemas ---
class SaleBase(BaseModel):
    sell_price: float
    platform: Optional[str] = None
    receipt_url: Optional[str] = None

class SaleCreate(SaleBase):
    pass

class SaleUpdate(BaseModel):
    sell_price: Optional[float] = None
    platform: Optional[str] = None

class Sale(SaleBase):
    id: int
    lego_set_id: int
    sell_date: datetime

    class Config:
        from_attributes = True

# --- LegoSet Schemas ---
class LegoSetBase(BaseModel):
    product_id: str
    name: str
    theme: Optional[str] = None
    image_url: Optional[str] = None
    buy_price: float
    msrp: Optional[float] = None
    current_price: Optional[float] = None
    target_price: Optional[float] = None
    year_eol: Optional[str] = None
    quantity: int = 1
    status: SetStatus = SetStatus.IN_STOCK
    condition: SetCondition = SetCondition.MISB
    notes: Optional[str] = None

class LegoSetCreate(LegoSetBase):
    pass

class LegoSetUpdate(BaseModel):
    name: Optional[str] = None
    theme: Optional[str] = None
    image_url: Optional[str] = None
    buy_price: Optional[float] = None
    msrp: Optional[float] = None
    current_price: Optional[float] = None
    target_price: Optional[float] = None
    year_eol: Optional[str] = None
    quantity: Optional[int] = None
    status: Optional[SetStatus] = None
    condition: Optional[SetCondition] = None
    notes: Optional[str] = None

class LegoSet(LegoSetBase):
    id: int
    purchase_date: datetime
    updated_at: Optional[datetime] = None
    sales: List[Sale] = []
    price_history: List[PriceHistory] = []

    class Config:
        from_attributes = True

# --- Dashboard Metrics ---
class DashboardMetrics(BaseModel):
    total_investment: float
    current_value: float
    total_roi: float
    realized_profit: float
    realized_profit_1m: float
    realized_profit_6m: float
    unrealized_profit: float
    potential_roi: float
    sets_in_stock: int
    sets_sold: int

class ChartDataPoint(BaseModel):
    date: str
    value: float
    investment: float = 0.0

class TopPerformer(BaseModel):
    id: int
    product_id: str
    name: str
    image_url: Optional[str] = None
    buy_price: float
    current_price: float
    roi_percentage: float
