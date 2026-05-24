from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security.api_key import APIKeyHeader
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import os
import models, database

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
    current_price: float

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
        new_price = prices_map.get(db_set.product_id)
        if new_price is not None:
            # Update current price
            db_set.current_price = new_price
            
            # Record price history if not already recorded today
            # Cast recorded_at to DATE for safe comparison
            history_today = db.query(models.PriceHistory).filter(
                models.PriceHistory.lego_set_id == db_set.id,
                func.date(models.PriceHistory.recorded_at) == today_date
            ).first()
            
            if not history_today:
                new_history = models.PriceHistory(lego_set_id=db_set.id, price=new_price)
                db.add(new_history)
                
            updated_count += 1
            
    db.commit()
    return {"message": f"Successfully updated {updated_count} sets"}
