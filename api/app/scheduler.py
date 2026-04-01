# APScheduler — programa el scraping automático cada noche a las 3:00 AM
import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import settings
from app.scraper.runner import scrape_all_products

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()


def start_scheduler():
    """Registra el cron job y arranca el scheduler. Se llama en lifespan de FastAPI."""
    scheduler.add_job(
        scrape_all_products,
        trigger=CronTrigger(hour=settings.scraper_schedule_hour, minute=0),
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
