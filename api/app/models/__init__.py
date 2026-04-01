# Exporta todos los modelos para que Alembic los detecte en autogenerate
from app.models.base import Base
from app.models.product import Product
from app.models.price import MarketPrice, PortfolioDailySnapshot, PriceAlert

__all__ = ["Base", "Product", "MarketPrice", "PriceAlert", "PortfolioDailySnapshot"]
