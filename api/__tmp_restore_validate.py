from datetime import datetime, timezone
import re
import asyncio

from app.database import SessionLocal
from app.models.product import Product
from app.scraper.bricklink_scraper import BrickLinkScraper

# 1) Restaurar productos desactivados hoy por la limpieza anterior
with SessionLocal() as db:
    restored = 0
    today = datetime.now(timezone.utc).date()
    candidates = db.query(Product).filter(Product.deleted_at.isnot(None)).all()
    for p in candidates:
        if p.deleted_at and p.deleted_at.date() == today and re.fullmatch(r"\d{3,8}", (p.set_number or "").strip()):
            p.deleted_at = None
            restored += 1
    db.commit()
    print(f"restored_today_soft_deleted={restored}")

# 2) Validar y desactivar solo si set_number invalido o sin precio de mercado
async def main():
    db = SessionLocal()
    scraper = BrickLinkScraper()
    invalid = []
    fixed = 0
    checked = 0
    try:
        products = db.query(Product).filter(Product.deleted_at.is_(None)).all()
        for p in products:
            checked += 1
            set_number = (p.set_number or "").strip()
            if not re.fullmatch(r"\d{3,8}", set_number):
                invalid.append((p.id, p.name, set_number, "set_number_invalido"))
                continue

            live_price = await scraper.fetch_with_retry(set_number)
            if not live_price or (live_price.price_new is None and live_price.price_used is None):
                invalid.append((p.id, p.name, set_number, "sin_precio_mercado"))
                continue

            meta = await scraper.fetch_set_metadata(set_number)
            if meta:
                changed = False
                if meta.get("name") and p.name != meta.get("name"):
                    p.name = meta.get("name")
                    changed = True
                if meta.get("theme") and (not p.theme):
                    p.theme = meta.get("theme")
                    changed = True
                if meta.get("year_released") and (not p.year_released):
                    p.year_released = meta.get("year_released")
                    changed = True
                if meta.get("image_url") and (not p.images):
                    p.images = [meta.get("image_url")]
                    changed = True
                if changed:
                    fixed += 1

        now = datetime.now(timezone.utc)
        for pid, _, _, _ in invalid:
            product = db.query(Product).filter(Product.id == pid).first()
            if product and product.deleted_at is None:
                product.deleted_at = now

        db.commit()
        print(f"checked_active_products={checked}")
        print(f"invalid_soft_deleted={len(invalid)}")
        print(f"metadata_fixed={fixed}")
        if invalid:
            print("invalid_examples=")
            for row in invalid[:15]:
                print(row)
    finally:
        await scraper.close()
        db.close()

asyncio.run(main())
