# Modelos MarketPrice y PriceAlert — precios de mercado y alertas de precio
import uuid

from sqlalchemy import Boolean, Column, Date, ForeignKey, Numeric, String, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.base import Base


class MarketPrice(Base):
    """Snapshot de precio de mercado obtenido por el scraper para un producto."""

    __tablename__ = "market_prices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    source = Column(String(50), nullable=False)  # bricklink | brickeconomy | ebay
    price_new = Column(Numeric(10, 2))
    min_price_new = Column(Numeric(10, 2))
    max_price_new = Column(Numeric(10, 2))
    price_used = Column(Numeric(10, 2))
    min_price_used = Column(Numeric(10, 2))
    max_price_used = Column(Numeric(10, 2))
    currency = Column(String(3), default="EUR")
    fetched_at = Column(TIMESTAMP, server_default=func.now())

    product = relationship("Product", back_populates="market_prices")


class PriceAlert(Base):
    """Alerta configurable que se dispara cuando el precio supera o baja de un umbral."""

    __tablename__ = "price_alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    alert_type = Column(String(20), nullable=False)  # PRICE_ABOVE | PRICE_BELOW | PRICE_CHANGE_PCT
    threshold_value = Column(Numeric(10, 2), nullable=False)
    is_active = Column(Boolean, default=True)
    last_triggered = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())

    product = relationship("Product", back_populates="price_alerts")


class PortfolioDailySnapshot(Base):
    """Snapshot diario agregado de cartera para histórico de invertido y valor de mercado."""

    __tablename__ = "portfolio_daily_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    date = Column(Date, nullable=False, unique=True)
    invested_value = Column(Numeric(12, 2), nullable=False)
    market_value = Column(Numeric(12, 2), nullable=False)
    profit_value = Column(Numeric(12, 2), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
