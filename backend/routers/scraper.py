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

@router.post("/webhook", dependencies=[Depends(get_api_key)])
def receive_scraped_prices(payload: WebhookPayload, db: Session = Depends(database.get_db)):
    updated_count = 0
    for item in payload.prices:
        db_set = db.query(models.LegoSet).filter(
            models.LegoSet.product_id == item.product_id,
            models.LegoSet.status == models.SetStatus.IN_STOCK
        ).first()
        
        if db_set:
            db_set.current_price = item.current_price
            updated_count += 1
            
    db.commit()
    return {"message": f"Successfully updated {updated_count} sets"}
