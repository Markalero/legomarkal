# Runner del scraper — orquesta los 3 scrapers y persiste resultados en BD
import asyncio
import logging
from datetime import date
from uuid import UUID

from sqlalchemy import Date as SADate, cast

from app.database import SessionLocal
from app.models.price import MarketPrice
from app.models.product import Product
from app.scraper.bricklink_scraper import BrickLinkScraper
from app.services.price_service import dashboard_service, price_service

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
                        "min_price_new": data.min_price_new,
                        "max_price_new": data.max_price_new,
                        "min_price_used": data.min_price_used,
                        "max_price_used": data.max_price_used,
                        "currency": data.currency,
                    },
                )
                logger.info(f"[{data.source}] Precios guardados para {product.set_number}")
        except Exception as e:
            logger.error(f"Error en scraper {ScraperClass.__name__} para {product.set_number}: {e}")
        finally:
            await scraper.close()


def scrape_all_products() -> None:
    """Scraping completo — itera todos los productos con set_number. Llamado por APScheduler."""
    db = SessionLocal()
    try:
        products = db.query(Product).filter(
            Product.deleted_at.is_(None),
            Product.set_number.isnot(None),
        ).all()
        logger.info(f"Iniciando scraping para {len(products)} productos")

        async def run():
            for product in products:
                await _run_scrapers_for_product(db, product)
                # Verificar alertas tras cada producto
                price_service.check_alerts(db, product.id)

        asyncio.run(run())
        # Mantiene portfolio_daily_snapshots sincronizado tras el refresco masivo.
        dashboard_service.upsert_today_snapshot_spain(db)
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


def _products_missing_today_price(db, products: list[Product], today_spain: date) -> list[Product]:
    """Devuelve los productos que aún no tienen snapshot en la fecha local de España."""
    missing: list[Product] = []
    checked_sets: set[str] = set()
    for product in products:
        set_number = (product.set_number or "").strip()
        if not set_number:
            continue
        if set_number in checked_sets:
            continue
        checked_sets.add(set_number)

        today_count = (
            db.query(MarketPrice)
            .join(Product, MarketPrice.product_id == Product.id)
            .filter(
                Product.set_number == set_number,
                Product.deleted_at.is_(None),
                cast(MarketPrice.fetched_at, SADate) == today_spain,
            )
            .count()
        )
        if today_count == 0:
            missing.append(product)
    return missing


def refresh_all_products_prices_for_today() -> dict:
    """Refresco síncrono completo para UI.

    Flujo:
    1) scraping para todos los productos con set_number,
    2) detección de productos sin fila del día actual (España),
    3) segunda pasada forzada sobre los faltantes,
    4) reporte final para auditoría en UI/logs.
    """
    db = SessionLocal()
    today_spain = price_service._now_spain().date()
    try:
        products = db.query(Product).filter(
            Product.deleted_at.is_(None),
            Product.set_number.isnot(None),
        ).all()

        logger.info(
            "Refresco de precios iniciado para %s productos (fecha España=%s)",
            len(products),
            today_spain,
        )

        async def run_for(items: list[Product]):
            for product in items:
                await _run_scrapers_for_product(db, product)
                price_service.check_alerts(db, product.id)

        # Primera pasada: actualizar rápido todos los productos.
        asyncio.run(run_for(products))

        missing_after_first = _products_missing_today_price(db, products, today_spain)
        if missing_after_first:
            logger.info(
                "Detectados %s productos sin precio del día; ejecutando segunda pasada forzada",
                len(missing_after_first),
            )
            asyncio.run(run_for(missing_after_first))

        missing_after_second = _products_missing_today_price(db, products, today_spain)
        # Tras asegurar precios del día, recalculamos todo el histórico diario de cartera.
        dashboard_service.rebuild_daily_snapshots_from_market_history(db)

        result = {
            "total_products": len(products),
            "missing_after_first": len(missing_after_first),
            "missing_after_second": len(missing_after_second),
            "spain_today": str(today_spain),
            "portfolio_daily_rebuilt": True,
        }
        logger.info("Refresco de precios finalizado: %s", result)
        return result
    finally:
        db.close()
