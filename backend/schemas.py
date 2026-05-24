from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from models import SetStatus

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
    buy_price: float
    msrp: Optional[float] = None
    current_price: Optional[float] = None
    quantity: int = 1
    status: SetStatus = SetStatus.IN_STOCK

class LegoSetCreate(LegoSetBase):
    pass

class LegoSetUpdate(BaseModel):
    name: Optional[str] = None
    theme: Optional[str] = None
    buy_price: Optional[float] = None
    msrp: Optional[float] = None
    current_price: Optional[float] = None
    quantity: Optional[int] = None
    status: Optional[SetStatus] = None

class LegoSet(LegoSetBase):
    id: int
    purchase_date: datetime
    updated_at: Optional[datetime] = None
    sales: List[Sale] = []

    class Config:
        from_attributes = True

# --- Dashboard Metrics ---
class DashboardMetrics(BaseModel):
    total_investment: float
    current_value: float
    total_roi: float
    sets_in_stock: int
    sets_sold: int
