"""
Scraper router: triggers price scraping, stores results, and exposes status/logs.

Architecture (simplified, no subprocess):
  POST /scraper/trigger -> spawns a background thread via FastAPI BackgroundTasks
                        -> background thread calls scrape_all_sets() directly in-process
                        -> scrape_all_sets() fetches each set from BrickEconomy using requests+BS4
                        -> results are written directly to the DB (no webhook needed)
  GET  /scraper/status  -> returns the max(updated_at) of LegoSets so the frontend can poll
  GET  /scraper/logs    -> returns in-memory logs of the last run for debugging
"""

from fastapi import APIRouter, Depends, HTTPException, Security, BackgroundTasks
from fastapi.security.api_key import APIKeyHeader
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import os
import requests as http_requests

import models
import database
from price_utils import extract_brickeconomy_data

router = APIRouter(prefix="/scraper", tags=["scraper"])

# --------------------------------------------------------------------------- #
#  API Key auth (kept for backward-compat with the webhook endpoint)
# --------------------------------------------------------------------------- #
API_KEY_NAME = "X-Scraper-Api-Key"
api_key_header_scheme = APIKeyHeader(name=API_KEY_NAME, auto_error=False)


def get_api_key(api_key_header: str = Security(api_key_header_scheme)):
    expected = os.environ.get("SCRAPER_API_KEY")
    if api_key_header == expected:
        return api_key_header
    raise HTTPException(status_code=403, detail="Could not validate API key")


# --------------------------------------------------------------------------- #
#  Pydantic schemas (kept for webhook backward-compat)
# --------------------------------------------------------------------------- #
class ScrapedPrice(BaseModel):
    product_id: str
    current_price: Optional[float] = None
    used_price: Optional[float] = None
    year_eol: Optional[str] = None


class WebhookPayload(BaseModel):
    prices: List[ScrapedPrice]


# --------------------------------------------------------------------------- #
#  In-memory log store (one per worker process – enough for debugging)
# --------------------------------------------------------------------------- #
LAST_SCRAPER_LOGS: dict = {
    "status": "idle",
    "started_at": None,
    "finished_at": None,
    "logs": [],
    "errors": [],
}

BRICKECONOMY_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}


# --------------------------------------------------------------------------- #
#  Core scraping logic (runs in-process, no subprocess)
# --------------------------------------------------------------------------- #
def scrape_and_save_prices(db: Session):
    """
    Fetches price data from BrickEconomy for every IN_STOCK set and saves it
    directly to the database. Runs in a FastAPI background task.
    """
    global LAST_SCRAPER_LOGS

    LAST_SCRAPER_LOGS = {
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "finished_at": None,
        "logs": [],
        "errors": [],
    }

    def log(msg: str):
        print(f"[Scraper] {msg}")
        LAST_SCRAPER_LOGS["logs"].append(msg)

    try:
        sets = db.query(models.LegoSet).filter(
            models.LegoSet.status == models.SetStatus.IN_STOCK
        ).all()

        log(f"Found {len(sets)} IN_STOCK sets to scrape.")
        today = datetime.now(timezone.utc).date()
        updated_count = 0

        for lego_set in sets:
            pid = lego_set.product_id
            set_num = pid if "-" in pid else f"{pid}-1"
            url = f"https://www.brickeconomy.com/set/{set_num}/"

            try:
                response = http_requests.get(url, headers=BRICKECONOMY_HEADERS, timeout=20)

                if response.status_code == 404:
                    log(f"{pid}: Not found on BrickEconomy (404).")
                    continue
                elif response.status_code != 200:
                    err = f"{pid}: HTTP {response.status_code}"
                    log(err)
                    LAST_SCRAPER_LOGS["errors"].append(err)
                    continue

                data = extract_brickeconomy_data(response.text)
                new_price = data.get("current_price")
                new_used = data.get("used_price")
                new_eol = data.get("year_eol")

                log(f"{pid}: price={new_price}, used={new_used}, eol={new_eol}")

                # Update the set record
                if new_price is not None:
                    lego_set.current_price = new_price
                if new_used is not None:
                    lego_set.current_used_price = new_used
                if new_eol and not lego_set.year_eol:
                    lego_set.year_eol = new_eol

                # Write price history (one record per day)
                if new_price is not None or new_used is not None:
                    history_today = db.query(models.PriceHistory).filter(
                        models.PriceHistory.lego_set_id == lego_set.id,
                        func.date(models.PriceHistory.recorded_at) == today,
                    ).first()

                    if history_today:
                        if new_price is not None:
                            history_today.price = new_price
                        if new_used is not None:
                            history_today.used_price = new_used
                    else:
                        db.add(models.PriceHistory(
                            lego_set_id=lego_set.id,
                            price=new_price if new_price is not None else lego_set.current_price,
                            used_price=new_used,
                        ))
                    updated_count += 1

            except Exception as e:
                err = f"{pid}: Exception – {e}"
                log(err)
                LAST_SCRAPER_LOGS["errors"].append(err)

        # Mark all IN_STOCK sets as updated so frontend polling detects completion
        db.query(models.LegoSet).filter(
            models.LegoSet.status == models.SetStatus.IN_STOCK
        ).update({"updated_at": func.now()}, synchronize_session=False)

        db.commit()
        log(f"Done. Updated {updated_count}/{len(sets)} sets.")

    except Exception as e:
        LAST_SCRAPER_LOGS["errors"].append(f"Fatal error: {e}")
        print(f"[Scraper] Fatal error: {e}")
        try:
            db.rollback()
        except Exception:
            pass
    finally:
        LAST_SCRAPER_LOGS["status"] = "finished"
        LAST_SCRAPER_LOGS["finished_at"] = datetime.now(timezone.utc).isoformat()
        db.close()


# --------------------------------------------------------------------------- #
#  Endpoints
# --------------------------------------------------------------------------- #
@router.post("/trigger")
def trigger_scraper(
    background_tasks: BackgroundTasks,
    api_key_header: str = Security(api_key_header_scheme),
):
    # Open a *new* DB session that will live for the duration of the background task
    db = database.SessionLocal()
    background_tasks.add_task(scrape_and_save_prices, db)
    return {"message": "Scraper iniciado en segundo plano. Los precios se actualizarán en breve."}


@router.get("/status")
def get_scraper_status(db: Session = Depends(database.get_db)):
    try:
        last_run = db.query(func.max(models.LegoSet.updated_at)).scalar()
        return {"last_run": last_run.isoformat() if last_run else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs")
def get_scraper_logs():
    return LAST_SCRAPER_LOGS


@router.post("/webhook", dependencies=[Depends(get_api_key)])
def scraper_webhook(payload: WebhookPayload, db: Session = Depends(database.get_db)):
    """Legacy webhook endpoint kept for backward-compat."""
    today = datetime.now(timezone.utc).date()
    updated_count = 0

    db.query(models.LegoSet).filter(
        models.LegoSet.status == models.SetStatus.IN_STOCK
    ).update({"updated_at": func.now()}, synchronize_session=False)

    for item in payload.prices:
        base_pid = str(item.product_id).split("-")[0]
        db_set = db.query(models.LegoSet).filter(
            models.LegoSet.product_id == base_pid
        ).first()
        if not db_set:
            continue

        if item.current_price is not None:
            db_set.current_price = item.current_price
        if item.used_price is not None:
            db_set.current_used_price = item.used_price

        if item.current_price is not None or item.used_price is not None:
            history_today = db.query(models.PriceHistory).filter(
                models.PriceHistory.lego_set_id == db_set.id,
                func.date(models.PriceHistory.recorded_at) == today,
            ).first()
            if history_today:
                if item.current_price is not None:
                    history_today.price = item.current_price
                if item.used_price is not None:
                    history_today.used_price = item.used_price
            else:
                db.add(models.PriceHistory(
                    lego_set_id=db_set.id,
                    price=item.current_price if item.current_price is not None else db_set.current_price,
                    used_price=item.used_price,
                ))
            updated_count += 1

    db.commit()
    return {"message": f"Successfully updated {updated_count} sets"}


@router.delete("/history")
def reset_price_history(db: Session = Depends(database.get_db)):
    try:
        deleted = db.query(models.PriceHistory).delete()
        db.query(models.LegoSet).update(
            {models.LegoSet.current_price: None, models.LegoSet.current_used_price: None}
        )
        db.commit()
        return {"message": f"Historial de precios reseteado. {deleted} registros eliminados."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
