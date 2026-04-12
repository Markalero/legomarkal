# Punto de entrada de FastAPI — registra routers, CORS y lifecycle del scheduler
import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers import auth, products, prices, alerts, dashboard
from app.routers.dashboard import scraper_router
from app.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def _clean_future_market_prices() -> None:
    """Elimina filas de market_prices cuya fecha es posterior a hoy en España.

    Estas filas son artefactos de versiones previas del scraper. La limpieza
    es idempotente y se ejecuta siempre que arranca el servidor.
    """
    try:
        from sqlalchemy import cast, Date as SADate
        from app.database import SessionLocal
        from app.models.price import MarketPrice
        from app.services.price_service import price_service

        db = SessionLocal()
        try:
            today = price_service._now_spain().date()
            deleted = (
                db.query(MarketPrice)
                .filter(cast(MarketPrice.fetched_at, SADate) > today)
                .delete(synchronize_session=False)
            )
            if deleted:
                db.commit()
                logger.info(
                    "Startup: eliminados %d registros con fecha futura en market_prices",
                    deleted,
                )
            else:
                logger.info("Startup: sin registros futuros en market_prices — OK")
        finally:
            db.close()
    except Exception as exc:
        logger.error("Error limpiando fechas futuras: %s", exc, exc_info=True)


async def _startup_scrape_if_needed() -> None:
    """Comprueba al arrancar si hoy (hora España) ya tiene precios guardados.

    Si no hay ningún registro en market_prices para la fecha actual, lanza
    un scraping completo en un hilo aparte para no bloquear el servidor.
    Esto garantiza que la gráfica siempre muestra datos del día actual aunque
    el servidor no estuviera levantado a las 3:00 AM del cron.
    """
    try:
        from sqlalchemy import cast, Date as SADate
        from app.database import SessionLocal
        from app.models.price import MarketPrice
        from app.services.price_service import price_service
        from app.scraper.runner import scrape_all_products

        db = SessionLocal()
        try:
            today = price_service._now_spain().date()
            count = (
                db.query(MarketPrice)
                .filter(cast(MarketPrice.fetched_at, SADate) == today)
                .count()
            )
        finally:
            db.close()

        if count == 0:
            logger.info(
                "Startup: sin precios para hoy (%s) — lanzando scraping automático en background…",
                today,
            )
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, scrape_all_products)
            logger.info("Startup scrape completado para %s", today)
        else:
            logger.info(
                "Startup: %d registros de precios ya existen para hoy (%s) — scraping omitido",
                count,
                today,
            )
    except Exception as exc:
        logger.error("Error en startup scrape automático: %s", exc, exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Arranca el scheduler al iniciar y lo para al apagar.

    Primero limpia datos futuros residuales, luego lanza scraping si es necesario.
    """
    start_scheduler()
    await _clean_future_market_prices()
    asyncio.create_task(_startup_scrape_if_needed())
    yield
    stop_scheduler()


app = FastAPI(
    title="LegoMarkal API",
    description="API de gestión de inventario y precios de mercado LEGO",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — permite peticiones desde el panel de administración Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://legomarkal.vercel.app", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registro de routers
app.include_router(auth.router)
app.include_router(products.router)
app.include_router(prices.router)
app.include_router(alerts.router)
app.include_router(dashboard.router)
app.include_router(scraper_router)

# Archivos estáticos para imágenes de productos.
uploads_dir = Path(__file__).resolve().parents[1] / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")


@app.get("/health")
def health():
    return {"status": "ok", "service": "LegoMarkal API"}
