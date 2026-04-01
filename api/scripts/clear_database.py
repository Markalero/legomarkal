# Limpia completamente las tablas de negocio de LegoMarkal.
from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import text

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database import SessionLocal


def clear_database() -> None:
    """Elimina datos de negocio en orden seguro por dependencias."""
    with SessionLocal() as db:
        db.execute(text("DELETE FROM price_alerts"))
        db.execute(text("DELETE FROM market_prices"))
        db.execute(text("DELETE FROM portfolio_daily_snapshots"))
        db.execute(text("DELETE FROM products"))
        db.commit()

        products = db.execute(text("SELECT COUNT(*) FROM products")).scalar_one()
        prices = db.execute(text("SELECT COUNT(*) FROM market_prices")).scalar_one()
        alerts = db.execute(text("SELECT COUNT(*) FROM price_alerts")).scalar_one()
        snapshots = db.execute(text("SELECT COUNT(*) FROM portfolio_daily_snapshots")).scalar_one()

        print(f"products={products}")
        print(f"market_prices={prices}")
        print(f"price_alerts={alerts}")
        print(f"portfolio_daily_snapshots={snapshots}")


if __name__ == "__main__":
    clear_database()
