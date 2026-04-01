# Inserta datos de ejemplo con histórico autoajustado hasta ayer.
from __future__ import annotations

import random
import sys
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from sqlalchemy import text

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database import SessionLocal
from app.models.price import MarketPrice, PriceAlert
from app.models.product import Product


def q(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def as_decimal(value: float) -> Decimal:
    return q(Decimal(str(value)))


def build_catalog() -> list[dict]:
    """Catálogo de sets reales para poblar entorno demo."""
    return [
        {"set_number": "75192", "name": "Millennium Falcon", "theme": "Star Wars", "year": 2017, "base": 700},
        {"set_number": "75252", "name": "Imperial Star Destroyer", "theme": "Star Wars", "year": 2019, "base": 650},
        {"set_number": "75313", "name": "AT-AT", "theme": "Star Wars", "year": 2021, "base": 520},
        {"set_number": "71043", "name": "Hogwarts Castle", "theme": "Harry Potter", "year": 2018, "base": 500},
        {"set_number": "75978", "name": "Diagon Alley", "theme": "Harry Potter", "year": 2020, "base": 420},
        {"set_number": "10316", "name": "Rivendell", "theme": "Icons", "year": 2023, "base": 560},
        {"set_number": "10307", "name": "Eiffel Tower", "theme": "Icons", "year": 2022, "base": 500},
        {"set_number": "10294", "name": "Titanic", "theme": "Icons", "year": 2021, "base": 620},
        {"set_number": "42100", "name": "Liebherr R 9800", "theme": "Technic", "year": 2019, "base": 450},
        {"set_number": "42143", "name": "Ferrari Daytona SP3", "theme": "Technic", "year": 2022, "base": 390},
        {"set_number": "76178", "name": "Daily Bugle", "theme": "Marvel", "year": 2021, "base": 340},
        {"set_number": "76210", "name": "Hulkbuster", "theme": "Marvel", "year": 2022, "base": 320},
    ]


def build_timeline_until_yesterday(points: int = 8) -> list[date]:
    """Genera fechas de histórico terminando exactamente en ayer."""
    yesterday = date.today() - timedelta(days=1)
    # 7 puntos previos espaciados 30 días + último punto en ayer.
    dates = [yesterday - timedelta(days=30 * i) for i in range(points - 1, 0, -1)]
    dates.append(yesterday)
    return dates


def clear_tables(db) -> None:
    """Borra datos previos para seed reproducible."""
    db.execute(text("DELETE FROM price_alerts"))
    db.execute(text("DELETE FROM market_prices"))
    db.execute(text("DELETE FROM portfolio_daily_snapshots"))
    db.execute(text("DELETE FROM products"))
    db.commit()


def seed_products_and_prices() -> None:
    """Puebla productos, alertas y snapshots de mercado hasta ayer."""
    random.seed(42)

    timeline = build_timeline_until_yesterday(points=8)
    yesterday = timeline[-1]

    conditions = ["SEALED", "OPEN_COMPLETE", "OPEN_INCOMPLETE", "USED"]
    condition_weights = [0.58, 0.25, 0.10, 0.07]
    sources = ["BrickLink", "Wallapop", "eBay", "Amazon", "LEGO Store"]

    with SessionLocal() as db:
        clear_tables(db)

        products: list[Product] = []
        catalog = build_catalog()

        for idx, row in enumerate(catalog):
            condition = random.choices(conditions, weights=condition_weights, k=1)[0]
            quantity = random.choice([1, 1, 1, 2])
            purchase_discount = random.uniform(0.60, 0.95)
            purchase_price = as_decimal(row["base"] * purchase_discount)

            # Compras entre 2 y 24 meses atrás, nunca posterior a ayer.
            purchase_days_ago = random.randint(60, 720)
            purchase_date = yesterday - timedelta(days=purchase_days_ago)

            product = Product(
                set_number=row["set_number"],
                name=row["name"],
                theme=row["theme"],
                year_released=row["year"],
                condition=condition,
                purchase_price=purchase_price,
                purchase_date=purchase_date,
                purchase_source=random.choice(sources),
                quantity=quantity,
                images=[],
                notes="Dataset de ejemplo autoajustado.",
                availability="available",
            )
            db.add(product)
            products.append(product)

        db.flush()

        for idx, product in enumerate(products):
            base_new = float(product.purchase_price or 0) * random.uniform(1.05, 1.45)
            if product.condition != "SEALED":
                base_new *= random.uniform(0.85, 0.98)
            base_used = base_new * random.uniform(0.68, 0.84)

            for point_idx, d in enumerate(timeline):
                trend = 1 + (point_idx * random.uniform(0.007, 0.016))
                noise = random.uniform(0.96, 1.04)

                price_new = as_decimal(base_new * trend * noise)
                price_used = as_decimal(base_used * trend * random.uniform(0.95, 1.05))
                min_price_new = as_decimal(float(price_new) * random.uniform(0.84, 0.93))
                max_price_new = as_decimal(float(price_new) * random.uniform(1.07, 1.16))
                min_price_used = as_decimal(float(price_used) * random.uniform(0.84, 0.93))
                max_price_used = as_decimal(float(price_used) * random.uniform(1.07, 1.16))

                db.add(
                    MarketPrice(
                        product_id=product.id,
                        source="bricklink",
                        price_new=price_new,
                        price_used=price_used,
                        min_price_new=min_price_new,
                        max_price_new=max_price_new,
                        min_price_used=min_price_used,
                        max_price_used=max_price_used,
                        currency="EUR",
                        fetched_at=datetime.combine(d, time(12, 0, 0), tzinfo=timezone.utc),
                    )
                )

            if idx % 3 == 0:
                last_market = as_decimal(max(float(price_new), float(price_used)))
                threshold = as_decimal(float(last_market) * random.uniform(0.90, 1.10))
                db.add(
                    PriceAlert(
                        product_id=product.id,
                        alert_type=random.choice(["PRICE_ABOVE", "PRICE_BELOW"]),
                        threshold_value=threshold,
                        is_active=True,
                    )
                )

        db.commit()

        prices_total = db.execute(text("SELECT COUNT(*) FROM market_prices")).scalar_one()
        products_total = db.execute(text("SELECT COUNT(*) FROM products")).scalar_one()
        alerts_total = db.execute(text("SELECT COUNT(*) FROM price_alerts")).scalar_one()
        prices_today = db.execute(text("SELECT COUNT(*) FROM market_prices WHERE CAST(fetched_at AS DATE) = CURRENT_DATE")).scalar_one()
        prices_yesterday = db.execute(text("SELECT COUNT(*) FROM market_prices WHERE CAST(fetched_at AS DATE) = CURRENT_DATE - INTERVAL '1 day'")).scalar_one()

        print(f"products={products_total}")
        print(f"market_prices={prices_total}")
        print(f"price_alerts={alerts_total}")
        print(f"market_prices_today={prices_today}")
        print(f"market_prices_yesterday={prices_yesterday}")


if __name__ == "__main__":
    seed_products_and_prices()
