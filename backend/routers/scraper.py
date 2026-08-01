from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security.api_key import APIKeyHeader
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
import os
import models, database
from typing import List, Optional

router = APIRouter(
    prefix="/scraper",
    tags=["scraper"]
)

API_KEY_NAME = "X-Scraper-Api-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

def get_api_key(api_key_header: str = Security(api_key_header)):
    expected_api_key = os.environ.get("SCRAPER_API_KEY")
    if api_key_header == expected_api_key:
        return api_key_header
    raise HTTPException(status_code=403, detail="Could not validate API key")

class ScrapedPrice(BaseModel):
    product_id: str
    current_price: Optional[float] = None
    used_price: Optional[float] = None
    year_eol: Optional[str] = None

class WebhookPayload(BaseModel):
    prices: List[ScrapedPrice]

from datetime import datetime, timezone
from sqlalchemy.sql import func

@router.post("/webhook", dependencies=[Depends(get_api_key)])
def receive_scraped_prices(payload: WebhookPayload, db: Session = Depends(database.get_db)):
    product_ids = [item.product_id for item in payload.prices]
    prices_map = {item.product_id: item.current_price for item in payload.prices}
    
    # Batch select to prevent N+1 query problem
    db_sets = db.query(models.LegoSet).filter(
        models.LegoSet.product_id.in_(product_ids),
        models.LegoSet.status == models.SetStatus.IN_STOCK
    ).all()
    
    # Ensure idempotency by tracking today's date
    today_date = datetime.now(timezone.utc).date()
    updated_count = 0
    
    for db_set in db_sets:
        item = next((i for i in payload.prices if i.product_id == db_set.product_id), None)
        if not item: continue
        
        new_price = item.current_price
        new_used_price = item.used_price
        new_eol = item.year_eol
        
        updated = False
        if new_eol and db_set.year_eol != new_eol:
            db_set.year_eol = new_eol
            updated = True
            
        if new_price is not None or new_used_price is not None:
            if new_price is not None:
                db_set.current_price = new_price
            if new_used_price is not None:
                db_set.current_used_price = new_used_price
            updated = True
            
            # Record price history if not already recorded today
            # Cast recorded_at to DATE for safe comparison
            history_today = db.query(models.PriceHistory).filter(
                models.PriceHistory.lego_set_id == db_set.id,
                func.date(models.PriceHistory.recorded_at) == today_date
            ).first()
            
            if not history_today:
                new_history = models.PriceHistory(
                    lego_set_id=db_set.id, 
                    price=new_price if new_price is not None else db_set.current_price,
                    used_price=new_used_price
                )
                db.add(new_history)
            else:
                if new_price is not None: history_today.price = new_price
                if new_used_price is not None: history_today.used_price = new_used_price
                
        if updated:
            updated_count += 1
            
    db.commit()
    return {"message": f"Successfully updated {updated_count} sets"}

import subprocess
import sys
from fastapi import BackgroundTasks

def run_scraper_task(product_id: str = None):
    scraper_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "scraper", "main.py")
    cmd = [sys.executable, scraper_path]
    if product_id:
        cmd.extend(["--product-id", product_id])
    result = subprocess.run(cmd, capture_output=True, text=True)
    print(f"[SCRAPER TASK] STDOUT: {result.stdout}")
    if result.stderr:
        print(f"[SCRAPER TASK] STDERR: {result.stderr}", file=sys.stderr)

@router.post("/trigger")
def trigger_scraper(background_tasks: BackgroundTasks, api_key_header: str = Security(api_key_header)):
    background_tasks.add_task(run_scraper_task)
    return {"message": "Scraper iniciado en segundo plano. Los precios se actualizarán en breve."}

@router.get("/status")
def get_scraper_status(db: Session = Depends(database.get_db)):
    try:
        last_run = db.query(func.max(models.PriceHistory.recorded_at)).scalar()
        return {"last_run": last_run.isoformat() if last_run else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/history")
def reset_price_history(db: Session = Depends(database.get_db)):
    try:
        deleted = db.query(models.PriceHistory).delete()
        db.commit()
        return {"message": f"Historial de precios reseteado. {deleted} registros eliminados."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

