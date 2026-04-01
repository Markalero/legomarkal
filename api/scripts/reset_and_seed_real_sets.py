# Resetea completamente la BD y carga sets LEGO reales usando la lógica de alta rápida.
from __future__ import annotations

import sys
from pathlib import Path
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID

from sqlalchemy import text

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.database import SessionLocal
from app.models.price import MarketPrice
from app.models.product import Product


SEED_SETS = [
    {
        "set_number": "75192",
        "name": "Millennium Falcon",
        "theme": "Star Wars",
        "year_released": 2017,
        "condition": "SEALED",
        "purchase_price": Decimal("536.51"),
        "purchase_date": date(2025, 9, 1),
        "purchase_source": "BrickLink",
        "quantity": 1,
        "base_new": Decimal("823.73"),
        "base_used": Decimal("688.45"),
        "image": "https://img.bricklink.com/ItemImage/SN/0/75192-1.png",
    },
    {
        "set_number": "75252",
        "name": "Imperial Star Destroyer",
        "theme": "Star Wars",
        "year_released": 2019,
        "condition": "SEALED",
        "purchase_price": Decimal("536.51"),
        "purchase_date": date(2025, 9, 28),
        "purchase_source": "BrickLink",
        "quantity": 1,
        "base_new": Decimal("823.73"),
        "base_used": Decimal("689.11"),
        "image": "https://img.bricklink.com/ItemImage/SN/0/75252-1.png",
    },
    {
        "set_number": "71043",
        "name": "Hogwarts Castle",
        "theme": "Harry Potter",
        "year_released": 2018,
        "condition": "SEALED",
        "purchase_price": Decimal("372.87"),
        "purchase_date": date(2025, 9, 3),
        "purchase_source": "LEGO Store",
        "quantity": 1,
        "base_new": Decimal("590.88"),
        "base_used": Decimal("502.74"),
        "image": "https://img.bricklink.com/ItemImage/SN/0/71043-1.png",
    },
    {
        "set_number": "75978",
        "name": "Diagon Alley",
        "theme": "Harry Potter",
        "year_released": 2020,
        "condition": "SEALED",
        "purchase_price": Decimal("327.30"),
        "purchase_date": date(2025, 9, 8),
        "purchase_source": "Amazon",
        "quantity": 1,
        "base_new": Decimal("508.26"),
        "base_used": Decimal("431.16"),
        "image": "https://img.bricklink.com/ItemImage/SN/0/75978-1.png",
    },
    {
        "set_number": "10316",
        "name": "The Lord of the Rings: Rivendell",
        "theme": "Icons",
        "year_released": 2023,
        "condition": "SEALED",
        "purchase_price": Decimal("435.22"),
        "purchase_date": date(2025, 9, 10),
        "purchase_source": "BrickLink",
        "quantity": 1,
        "base_new": Decimal("613.66"),
        "base_used": Decimal("540.72"),
        "image": "https://img.bricklink.com/ItemImage/SN/0/10316-1.png",
    },
    {
        "set_number": "76178",
        "name": "Daily Bugle",
        "theme": "Marvel Super Heroes",
        "year_released": 2021,
        "condition": "SEALED",
        "purchase_price": Decimal("277.44"),
        "purchase_date": date(2025, 9, 14),
        "purchase_source": "Wallapop",
        "quantity": 1,
        "base_new": Decimal("412.30"),
        "base_used": Decimal("352.48"),
        "image": "https://img.bricklink.com/ItemImage/SN/0/76178-1.png",
    },
    {
        "set_number": "42100",
        "name": "Liebherr R 9800 Excavator",
        "theme": "Technic",
        "year_released": 2019,
        "condition": "SEALED",
        "purchase_price": Decimal("413.77"),
        "purchase_date": date(2025, 9, 18),
        "purchase_source": "LEGO Store",
        "quantity": 1,
        "base_new": Decimal("526.13"),
        "base_used": Decimal("451.09"),
        "image": "https://img.bricklink.com/ItemImage/SN/0/42100-1.png",
    },
    {
        "set_number": "10307",
        "name": "Eiffel Tower",
        "theme": "Icons",
        "year_released": 2022,
        "condition": "SEALED",
        "purchase_price": Decimal("406.69"),
        "purchase_date": date(2025, 9, 22),
        "purchase_source": "Amazon",
        "quantity": 1,
        "base_new": Decimal("512.27"),
        "base_used": Decimal("437.50"),
        "image": "https://img.bricklink.com/ItemImage/SN/0/10307-1.png",
    },
    {
        "set_number": "75313",
        "name": "AT-AT",
        "theme": "Star Wars",
        "year_released": 2021,
        "condition": "SEALED",
        "purchase_price": Decimal("408.06"),
        "purchase_date": date(2025, 9, 24),
        "purchase_source": "BrickLink",
        "quantity": 1,
        "base_new": Decimal("505.75"),
        "base_used": Decimal("438.15"),
        "image": "https://img.bricklink.com/ItemImage/SN/0/75313-1.png",
    },
    {
        "set_number": "76210",
        "name": "Hulkbuster",
        "theme": "Marvel Super Heroes",
        "year_released": 2022,
        "condition": "SEALED",
        "purchase_price": Decimal("326.89"),
        "purchase_date": date(2025, 9, 26),
        "purchase_source": "LEGO Store",
        "quantity": 1,
        "base_new": Decimal("418.37"),
        "base_used": Decimal("358.98"),
        "image": "https://img.bricklink.com/ItemImage/SN/0/76210-1.png",
    },
]

HISTORY_DATES = [
    date(2025, 9, 30),
    date(2025, 10, 31),
    date(2025, 11, 30),
    date(2025, 12, 31),
    date(2026, 1, 31),
    date(2026, 2, 28),
    date(2026, 3, 30),
]


def q(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def history_price(base: Decimal, index: int, product_idx: int) -> Decimal:
    """Genera una progresión suave y determinista partiendo de precio real base."""
    growth = Decimal("1.00") + (Decimal("0.015") * Decimal(index)) + (Decimal(product_idx % 3) * Decimal("0.003"))
    return q(base * growth)


def reset_database(db) -> None:
    db.execute(text("DELETE FROM price_alerts"))
    db.execute(text("DELETE FROM market_prices"))
    db.execute(text("DELETE FROM portfolio_daily_snapshots"))
    db.execute(text("DELETE FROM products"))
    db.commit()


def seed_products(db) -> list[Product]:
    created: list[Product] = []

    for row in SEED_SETS:
        product = Product(
            set_number=row["set_number"],
            name=row["name"],
            theme=row["theme"],
            year_released=row["year_released"],
            condition=row["condition"],
            purchase_price=row["purchase_price"],
            purchase_date=row["purchase_date"],
            purchase_source=row["purchase_source"],
            quantity=row["quantity"],
            images=[row["image"]],
            notes="Dataset semilla real",
            availability="available",
        )
        db.add(product)
        created.append(product)

    db.commit()
    for product in created:
        db.refresh(product)

    return created


def seed_history_until_2026_03_30(db, products: list[Product]) -> None:
    # Se toma como base el último precio real capturado por quick-add y se genera histórico mensual.
    for product_idx, product in enumerate(products):
        seed_row = next((x for x in SEED_SETS if x["set_number"] == product.set_number), None)
        if seed_row is None:
            raise RuntimeError(f"No se encontró catálogo semilla para {product.set_number}")

        base_new = Decimal(str(seed_row["base_new"]))
        base_used = Decimal(str(seed_row["base_used"]))

        # Eliminar cualquier fila previa para regenerar solo hasta 30/03/2026.
        db.query(MarketPrice).filter(MarketPrice.product_id == product.id).delete()

        for idx, d in enumerate(HISTORY_DATES):
            p_new = history_price(base_new, idx, product_idx)
            p_used = history_price(base_used, idx, product_idx)
            mn = q(min(p_new, p_used) * Decimal("0.94"))
            mx = q(max(p_new, p_used) * Decimal("1.11"))

            db.add(
                MarketPrice(
                    product_id=product.id,
                    source="bricklink",
                    price_new=p_new,
                    price_used=p_used,
                    min_price_new=mn,
                    max_price_new=mx,
                    min_price_used=mn,
                    max_price_used=mx,
                    currency="EUR",
                    fetched_at=datetime(d.year, d.month, d.day, 12, 0, 0, tzinfo=timezone.utc),
                )
            )

    db.commit()


if __name__ == "__main__":
    with SessionLocal() as db:
        reset_database(db)
        products = seed_products(db)
        seed_history_until_2026_03_30(db, products)

        rows_today_prices = db.execute(
            text("SELECT COUNT(*) FROM market_prices WHERE CAST(fetched_at AS DATE) = CURRENT_DATE")
        ).scalar_one()
        rows_today_snapshots = db.execute(
            text("SELECT COUNT(*) FROM portfolio_daily_snapshots WHERE date = CURRENT_DATE")
        ).scalar_one()
        non_eur = db.execute(
            text("SELECT COUNT(*) FROM market_prices WHERE currency IS DISTINCT FROM 'EUR'")
        ).scalar_one()

        print(f"products={len(products)}")
        print(f"market_prices={db.query(MarketPrice).count()}")
        print(f"market_prices_today={rows_today_prices}")
        print(f"snapshots_today={rows_today_snapshots}")
        print(f"non_eur={non_eur}")
