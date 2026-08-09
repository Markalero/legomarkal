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
def scraper_webhook(payload: schemas.WebhookPayload, db: Session = Depends(database.get_db)):
    updated_count = 0
    today_date = datetime.now(timezone.utc).date()
    
    # Regardless of whether we found prices, mark all IN_STOCK sets as updated
    # so the frontend polling mechanism knows the scraper finished.
    db.query(models.LegoSet).filter(models.LegoSet.status == "IN_STOCK").update(
        {"updated_at": func.now()}, synchronize_session=False
    )
    
    for item in payload.prices:
        db_set = db.query(models.LegoSet).filter(models.LegoSet.product_id == str(item.product_id).split('-')[0]).first()
        if db_set:
            new_price = item.current_price
            new_used_price = item.used_price
            updated = False
            
            if new_price is not None or new_used_price is not None:
                if new_price is not None:
                    db_set.current_price = new_price
                if new_used_price is not None:
                    db_set.current_used_price = new_used_price
                updated = True
                
            # Create today's history record only if we have valid prices
            if updated:
                history_today = db.query(models.PriceHistory).filter(
                    models.PriceHistory.lego_set_id == db_set.id,
                    models.PriceHistory.recorded_at >= today_date
                ).first()
                
                if not history_today:
                    new_history = models.PriceHistory(
                        lego_set_id=db_set.id, 
                        price=new_price if new_price is not None else db_set.current_price,
                        used_price=new_used_price if new_used_price is not None else db_set.current_used_price
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
import os
from fastapi import BackgroundTasks

def run_scraper_task(product_id: str = None):
    scraper_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "scraper", "main.py")
    cmd = [sys.executable, scraper_path]
    if product_id:
        cmd.extend(["--product-id", product_id])
        
    env = os.environ.copy()
    
    # Render assigns a dynamic PORT. We must use this port to communicate locally.
    port = os.environ.get("PORT", "8000")
    env["API_BASE_URL"] = f"http://127.0.0.1:{port}/api"
        
    result = subprocess.run(cmd, capture_output=True, text=True, env=env)
    
    print(f"[SCRAPER TASK] Using API_BASE_URL: {env.get('API_BASE_URL')}")
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
        # Use LegoSet.updated_at so the UI can detect when a scraper run finishes
        # even if no new prices were inserted into PriceHistory.
        last_run = db.query(func.max(models.LegoSet.updated_at)).scalar()
        return {"last_run": last_run.isoformat() if last_run else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/history")
def reset_price_history(db: Session = Depends(database.get_db)):
    try:
        deleted = db.query(models.PriceHistory).delete()
        db.query(models.LegoSet).update({
            models.LegoSet.current_price: None,
            models.LegoSet.current_used_price: None
        })
        db.commit()
        return {"message": f"Historial de precios reseteado. {deleted} registros eliminados y valores de mercado restablecidos."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

