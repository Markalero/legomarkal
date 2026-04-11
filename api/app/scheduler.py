# APScheduler — programa el scraping automático cada noche a las 3:00 AM hora España
import logging
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import settings
from app.scraper.runner import scrape_all_products

logger = logging.getLogger(__name__)

# Timezone explícita para que el cron dispare siempre a la hora local de España,
# independientemente del servidor donde corra el backend (UTC en cloud, etc.).
SPAIN_TZ = ZoneInfo("Europe/Madrid")

scheduler = BackgroundScheduler(timezone=SPAIN_TZ)


def start_scheduler():
    """Registra el cron job y arranca el scheduler. Se llama en lifespan de FastAPI."""
    scheduler.add_job(
        scrape_all_products,
        trigger=CronTrigger(
            hour=settings.scraper_schedule_hour,
            minute=0,
            timezone=SPAIN_TZ,
        ),
        id="nightly_scrape",
        replace_existing=True,
        misfire_grace_time=3600,  # si el servidor estuvo caído, ejecuta si no pasó más de 1h
    )
    scheduler.start()
    logger.info(f"Scheduler iniciado — scraping diario a las {settings.scraper_schedule_hour}:00")


def stop_scheduler():
    """Para el scheduler limpiamente al apagar el servidor."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler detenido")
