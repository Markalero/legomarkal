from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from database import Base

class SetStatus(str, enum.Enum):
    IN_STOCK = "IN_STOCK"
    SOLD = "SOLD"

class SetCondition(str, enum.Enum):
    MISB = "MISB" # Mint In Sealed Box
    CIB = "CIB"   # Complete In Box
    USED = "USED" # Used/Loose

class LegoSet(Base):
    __tablename__ = "lego_sets"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(String, index=True, nullable=False) # e.g. "75192"
    name = Column(String, nullable=False)
    theme = Column(String, nullable=True)
    image_url = Column(String, nullable=True) # Fetched from Rebrickable API
    buy_price = Column(Float, nullable=False)
    msrp = Column(Float, nullable=True)
    current_price = Column(Float, nullable=True) # Fetched from Scraper
    target_price = Column(Float, nullable=True) # For market alerts
    year_eol = Column(String, nullable=True)
    quantity = Column(Integer, default=1)
    status = Column(Enum(SetStatus), default=SetStatus.IN_STOCK)
    condition = Column(Enum(SetCondition), default=SetCondition.MISB)
    notes = Column(Text, nullable=True)
    purchase_date = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    sales = relationship("Sale", back_populates="lego_set", cascade="all, delete-orphan")
    price_history = relationship("PriceHistory", back_populates="lego_set", cascade="all, delete-orphan")

class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    lego_set_id = Column(Integer, ForeignKey("lego_sets.id"), nullable=False)
    sell_price = Column(Float, nullable=False)
    sell_date = Column(DateTime(timezone=True), server_default=func.now())
    platform = Column(String, nullable=True) # e.g., "Wallapop", "Vinted", "Direct"
    receipt_url = Column(String, nullable=True) # URL from Supabase Storage

    lego_set = relationship("LegoSet", back_populates="sales")

class PriceHistory(Base):
    __tablename__ = "price_history"
    
    id = Column(Integer, primary_key=True, index=True)
    lego_set_id = Column(Integer, ForeignKey("lego_sets.id"), nullable=False)
    price = Column(Float, nullable=False)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())
    
    lego_set = relationship("LegoSet", back_populates="price_history")
