from pydantic import BaseModel, Field
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
    sets_in_stock: int
    sets_sold: int
