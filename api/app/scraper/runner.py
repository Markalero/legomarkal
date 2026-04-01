# Runner del scraper — orquesta los 3 scrapers y persiste resultados en BD
import asyncio
import logging
from uuid import UUID

from app.database import SessionLocal
from app.models.product import Product
from app.scraper.bricklink_scraper import BrickLinkScraper
from app.services.price_service import price_service

logger = logging.getLogger(__name__)

# Fuente oficial de precio real para la app: BrickLink.
SCRAPERS = [BrickLinkScraper]


async def _run_scrapers_for_product(db, product: Product) -> None:
    """Ejecuta el scraper oficial de precio real y guarda el resultado."""
    if not product.set_number:
        return

    for ScraperClass in SCRAPERS:
        scraper = ScraperClass()
        try:
            data = await scraper.fetch_with_retry(product.set_number)
            if data:
                price_service.save_price(
                    db,
                    product_id=product.id,
                    source=data.source,
                    data={
                        "price_new": data.price_new,
                        "price_used": data.price_used,
                        "min_price": data.min_price,
                        "max_price": data.max_price,
                        "currency": data.currency,
                    },
                )
                logger.info(f"[{data.source}] Precios guardados para {product.set_number}")
        except Exception as e:
            logger.error(f"Error en scraper {ScraperClass.__name__} para {product.set_number}: {e}")
        finally:
            await scraper.close()


def scrape_all_products() -> None:
    """Scraping completo — itera todos los productos activos. Llamado por APScheduler."""
    db = SessionLocal()
    try:
        products = db.query(Product).filter(
            Product.deleted_at.is_(None),
            Product.availability == "available",
            Product.set_number.isnot(None),
        ).all()
        logger.info(f"Iniciando scraping para {len(products)} productos")

        async def run():
            for product in products:
                await _run_scrapers_for_product(db, product)
                # Verificar alertas tras cada producto
                price_service.check_alerts(db, product.id)

        asyncio.run(run())
        logger.info("Scraping completo finalizado")
    finally:
        db.close()


def scrape_single_product(product_id: UUID) -> None:
    """Scraping de un único producto — llamado desde el endpoint de scraping manual."""
    db = SessionLocal()
    try:
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            logger.warning(f"Producto {product_id} no encontrado para scraping")
            return

        asyncio.run(_run_scrapers_for_product(db, product))
        price_service.check_alerts(db, product_id)
    finally:
        db.close()
