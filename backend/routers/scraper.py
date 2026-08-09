from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security.api_key import APIKeyHeader
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import os
import asyncio
import json
import time
from datetime import datetime, timezone
from sqlalchemy.sql import func
from fastapi.responses import StreamingResponse
import requests as http_requests

import models, database
from price_utils import extract_brickeconomy_data

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

@router.post("/webhook", dependencies=[Depends(get_api_key)])
def receive_scraped_prices(payload: WebhookPayload, db: Session = Depends(database.get_db)):
    product_ids = [item.product_id for item in payload.prices]
    
    db_sets = db.query(models.LegoSet).filter(
        models.LegoSet.product_id.in_(product_ids),
        models.LegoSet.status == models.SetStatus.IN_STOCK
    ).all()
    
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


# ─── Scraping inline con Playwright (y fallback HTTP) ─────────────────

def _scrape_set_http_fallback(product_id: str) -> dict | None:
    set_num = product_id if "-" in product_id else f"{product_id}-1"
    url = f"https://www.brickeconomy.com/set/{set_num}/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }
    try:
        resp = http_requests.get(url, headers=headers, timeout=12)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return extract_brickeconomy_data(resp.text)
    except Exception as e:
        print(f"[HttpFallback] Error fetching {product_id}: {e}")
        return None


@router.post("/update-prices")
async def update_prices_inline(db: Session = Depends(database.get_db)):
    """Actualiza precios de todos los sets IN_STOCK scrapeando BrickEconomy.
    Usa Playwright (Chromium) para evitar bloqueos de Cloudflare y emite progreso SSE."""
    in_stock_sets = db.query(models.LegoSet).filter(
        models.LegoSet.status == models.SetStatus.IN_STOCK
    ).all()

    if not in_stock_sets:
        async def empty_gen():
            yield f"data: {json.dumps({'type': 'done', 'updated': 0, 'total': 0})}\n\n"
        return StreamingResponse(empty_gen(), media_type="text/event-stream")

    today_date = datetime.now(timezone.utc).date()

    async def generate():
        updated_count = 0
        total = len(in_stock_sets)

        playwright_available = False
        browser = None
        context = None
        page = None

        try:
            from playwright.async_api import async_playwright
            p = await async_playwright().start()
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                ]
            )
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            page = await context.new_page()
            playwright_available = True
        except Exception as e:
            print(f"[UpdatePrices] Playwright launch failed, falling back to HTTP: {e}")
            playwright_available = False

        for idx, db_set in enumerate(in_stock_sets):
            progress = {
                "type": "progress",
                "current": idx + 1,
                "total": total,
                "product_id": db_set.product_id,
                "name": db_set.name,
            }

            data = None

            if playwright_available and page:
                try:
                    set_num = db_set.product_id if "-" in db_set.product_id else f"{db_set.product_id}-1"
                    url = f"https://www.brickeconomy.com/set/{set_num}/"
                    resp = await page.goto(url, wait_until="domcontentloaded", timeout=20000)
                    if resp and resp.status == 200:
                        html = await page.content()
                        data = extract_brickeconomy_data(html)
                except Exception as e:
                    print(f"[Playwright] Error scraping {db_set.product_id}: {e}")
                    data = None

            # Fallback a HTTP si Playwright fallo o no estaba disponible
            if not data:
                data = _scrape_set_http_fallback(db_set.product_id)

            if data:
                new_price = data.get("current_price")
                used_price = data.get("used_price")
                new_eol = data.get("year_eol")

                if new_eol and db_set.year_eol != new_eol:
                    db_set.year_eol = new_eol

                if new_price is not None:
                    db_set.current_price = new_price
                if used_price is not None:
                    db_set.current_used_price = used_price

                if new_price is not None or used_price is not None:
                    history_today = db.query(models.PriceHistory).filter(
                        models.PriceHistory.lego_set_id == db_set.id,
                        func.date(models.PriceHistory.recorded_at) == today_date
                    ).first()

                    if not history_today:
                        new_history = models.PriceHistory(
                            lego_set_id=db_set.id,
                            price=new_price if new_price is not None else db_set.current_price,
                            used_price=used_price
                        )
                        db.add(new_history)
                    else:
                        if new_price is not None:
                            history_today.price = new_price
                        if used_price is not None:
                            history_today.used_price = used_price

                    db.commit()
                    updated_count += 1

                progress["status"] = "ok"
                progress["price"] = new_price
                progress["used_price"] = used_price
            else:
                progress["status"] = "error"

            yield f"data: {json.dumps(progress)}\n\n"

            if idx < total - 1:
                await asyncio.sleep(1.5)

        if browser:
            try:
                await browser.close()
            except Exception:
                pass

        summary = {
            "type": "done",
            "updated": updated_count,
            "total": total,
        }
        yield f"data: {json.dumps(summary)}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

@router.get("/status")
def get_scraper_status(db: Session = Depends(database.get_db)):
    try:
        last_run = db.query(func.max(models.PriceHistory.recorded_at)).scalar()
        return {"last_run": last_run.isoformat() if last_run else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/history")
def reset_price_history(db: Session = Depends(database.get_db)):
    """Borra todo el historial de precios Y resetea los precios actuales de todos los sets a NULL."""
    try:
        deleted = db.query(models.PriceHistory).delete()
        
        all_sets = db.query(models.LegoSet).all()
        for s in all_sets:
            s.current_price = None
            s.current_used_price = None
        
        db.commit()
        return {"message": f"Historial de precios reseteado. {deleted} registros eliminados. Precios actuales limpiados."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
