# Modelo Product — núcleo del inventario LEGO
import uuid
from datetime import datetime

from sqlalchemy import Column, Date, Integer, Numeric, String, Text, TIMESTAMP
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.base import Base


class Product(Base):
    """Artículo de inventario LEGO con todos sus metadatos de compra, estado y venta."""

    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    set_number = Column(String(20))
    name = Column(String(255), nullable=False)
    theme = Column(String(100))
    year_released = Column(Integer)
    condition = Column(String(20), nullable=True)
    purchase_price = Column(Numeric(10, 2))
    purchase_date = Column(Date)
    purchase_source = Column(String(255))
    quantity = Column(Integer, default=1)
    images = Column(JSONB, default=list)
    sale_receipts = Column(JSONB, default=list, nullable=True)
    notes = Column(Text)
    availability = Column(String(20), nullable=False, default="available")
    sold_date = Column(Date, nullable=True)
    sold_price = Column(Numeric(10, 2), nullable=True)
    deleted_at = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    market_prices = relationship("MarketPrice", back_populates="product", cascade="all, delete-orphan")
    price_alerts = relationship("PriceAlert", back_populates="product", cascade="all, delete-orphan")
