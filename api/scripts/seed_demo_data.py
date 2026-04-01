# Seed de datos demo plausibles para LegoMarkal (productos, precios y alertas)
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import random

from app.database import SessionLocal
from app.models.price import MarketPrice, PriceAlert
from app.models.product import Product


def _decimal(value: float) -> Decimal:
    return Decimal(str(round(value, 2))).quantize(Decimal("0.01"))


def _build_products() -> list[dict]:
    """Genera un catálogo plausible de sets LEGO con metadatos realistas."""
    return [
        {"set_number": "75192", "name": "Millennium Falcon", "theme": "Star Wars", "year": 2017, "base": 650},
        {"set_number": "75252", "name": "Imperial Star Destroyer", "theme": "Star Wars", "year": 2019, "base": 620},
        {"set_number": "75313", "name": "AT-AT", "theme": "Star Wars", "year": 2021, "base": 540},
        {"set_number": "10265", "name": "Ford Mustang", "theme": "Creator Expert", "year": 2019, "base": 180},
        {"set_number": "10295", "name": "Porsche 911", "theme": "Creator Expert", "year": 2021, "base": 160},
        {"set_number": "10316", "name": "Rivendell", "theme": "Icons", "year": 2023, "base": 470},
        {"set_number": "10307", "name": "Eiffel Tower", "theme": "Icons", "year": 2022, "base": 520},
        {"set_number": "42115", "name": "Lamborghini Sian", "theme": "Technic", "year": 2020, "base": 340},
        {"set_number": "42143", "name": "Ferrari Daytona SP3", "theme": "Technic", "year": 2022, "base": 350},
        {"set_number": "42100", "name": "Liebherr R 9800", "theme": "Technic", "year": 2019, "base": 430},
        {"set_number": "21318", "name": "Tree House", "theme": "Ideas", "year": 2019, "base": 210},
        {"set_number": "21327", "name": "Typewriter", "theme": "Ideas", "year": 2021, "base": 230},
        {"set_number": "21335", "name": "Motorized Lighthouse", "theme": "Ideas", "year": 2022, "base": 250},
        {"set_number": "71043", "name": "Hogwarts Castle", "theme": "Harry Potter", "year": 2018, "base": 390},
        {"set_number": "75978", "name": "Diagon Alley", "theme": "Harry Potter", "year": 2020, "base": 360},
        {"set_number": "76210", "name": "Hulkbuster", "theme": "Marvel", "year": 2022, "base": 390},
        {"set_number": "76178", "name": "Daily Bugle", "theme": "Marvel", "year": 2021, "base": 320},
        {"set_number": "10294", "name": "Titanic", "theme": "Icons", "year": 2021, "base": 560},
        {"set_number": "31203", "name": "World Map", "theme": "Art", "year": 2021, "base": 170},
        {"set_number": "31210", "name": "Modern Art", "theme": "Art", "year": 2023, "base": 65},
    ]


def seed_demo_data() -> None:
    """Inserta productos, snapshots de BrickLink y alertas de ejemplo."""
    random.seed(42)
    db = SessionLocal()

    conditions = ["SEALED", "OPEN_COMPLETE", "OPEN_INCOMPLETE", "USED"]
    condition_weights = [0.55, 0.28, 0.10, 0.07]
    sources = ["BrickLink", "Wallapop", "eBay", "Tienda local", "Vinted"]

    try:
        product_rows = _build_products()
        products: list[Product] = []

        for row in product_rows:
            condition = random.choices(conditions, weights=condition_weights, k=1)[0]
            quantity = random.choices([1, 1, 1, 2, 2, 3], k=1)[0]

            discount = random.uniform(0.55, 0.95)
            if condition == "SEALED":
                discount = random.uniform(0.70, 0.98)
            purchase_price = _decimal(row["base"] * discount)

            purchase_days_ago = random.randint(30, 900)
            purchase_date = date.today() - timedelta(days=purchase_days_ago)

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
                notes="Lote de prueba generado automáticamente.",
                availability="available",
            )
            db.add(product)
            products.append(product)

        db.flush()

        now = datetime.now(timezone.utc)
        for product in products:
            base_new = float(product.purchase_price or 0) * random.uniform(1.05, 1.55)
            if product.condition != "SEALED":
                base_new *= random.uniform(0.85, 1.0)

            base_used = base_new * random.uniform(0.65, 0.82)

            # 8 snapshots históricos en los últimos 7 meses
            for i in range(8):
                days_ago = 210 - (i * 30) + random.randint(-5, 5)
                fetched_at = now - timedelta(days=max(days_ago, 0))
                trend = 1 + (i * random.uniform(0.006, 0.018))
                noise = random.uniform(0.96, 1.04)

                price_new = _decimal(base_new * trend * noise)
                price_used = _decimal(base_used * trend * random.uniform(0.95, 1.05))

                if product.condition == "USED":
                    price_new = _decimal(float(price_new) * random.uniform(0.9, 0.98))

                db.add(
                    MarketPrice(
                        product_id=product.id,
                        source="bricklink",
                        price_new=price_new,
                        price_used=price_used,
                        min_price_new=_decimal(float(price_new) * random.uniform(0.82, 0.92)),
                        max_price_new=_decimal(float(price_new) * random.uniform(1.08, 1.18)),
                        min_price_used=_decimal(float(price_used) * random.uniform(0.82, 0.92)),
                        max_price_used=_decimal(float(price_used) * random.uniform(1.08, 1.18)),
                        currency="EUR",
                        fetched_at=fetched_at,
                    )
                )

            # Snapshot adicional del día actual para asegurar valor real reciente
            today_new = _decimal(base_new * random.uniform(1.00, 1.18))
            today_used = _decimal(base_used * random.uniform(0.98, 1.12))
            db.add(
                MarketPrice(
                    product_id=product.id,
                    source="bricklink",
                    price_new=today_new,
                    price_used=today_used,
                    min_price_new=_decimal(float(today_new) * random.uniform(0.86, 0.94)),
                    max_price_new=_decimal(float(today_new) * random.uniform(1.06, 1.14)),
                    min_price_used=_decimal(float(today_used) * random.uniform(0.86, 0.94)),
                    max_price_used=_decimal(float(today_used) * random.uniform(1.06, 1.14)),
                    currency="EUR",
                    fetched_at=now,
                )
            )

            if random.random() < 0.35:
                selected = today_new if product.condition == "SEALED" else today_used
                threshold = _decimal(float(selected) * random.uniform(0.90, 1.10))
                db.add(
                    PriceAlert(
                        product_id=product.id,
                        alert_type=random.choice(["PRICE_ABOVE", "PRICE_BELOW"]),
                        threshold_value=threshold,
                        is_active=True,
                    )
                )

        db.commit()
        print(f"Seed OK: {len(products)} productos con histórico de precios generado.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
