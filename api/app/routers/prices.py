# Router de precios de mercado — historial y scraping manual por producto
from typing import List
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session
import asyncio

from app.auth import get_current_user
from app.database import get_db
from app.schemas.price import MarketPriceOut, ProductPriceHistoryOut, ProductPriceHistoryPoint, SetCodePriceOut
from app.services.price_service import price_service

router = APIRouter(prefix="/market-prices", tags=["market-prices"])


@router.get("/{product_id}", response_model=List[MarketPriceOut])
def get_price_history(product_id: UUID, db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    return price_service.get_price_history(db, product_id)


@router.get("/{product_id}/trend", response_model=ProductPriceHistoryOut)
def get_price_history_trend(
    product_id: UUID,
    months: int = 6,
    guide_type: str = "sold",
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    condition, points = price_service.get_product_history_trend(db, product_id, months=months)
    if condition is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    return ProductPriceHistoryOut(
        product_id=product_id,
        condition=condition,
        guide_type=guide_type,
        points=[ProductPriceHistoryPoint(**point) for point in points],
    )


@router.post("/scrape/{product_id}", status_code=202)
def scrape_product(product_id: UUID, background_tasks: BackgroundTasks, db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    """Lanza scraping en background para un producto concreto."""
    from app.scraper.runner import scrape_single_product
    background_tasks.add_task(scrape_single_product, product_id)
    return {"message": "Scraping iniciado en background", "product_id": str(product_id)}


@router.get("/by-set/{set_number}", response_model=SetCodePriceOut)
def get_latest_price_by_set(set_number: str, db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    price = price_service.get_latest_price_by_set_number(db, set_number)
    if not price:
        raise HTTPException(status_code=404, detail="No hay precio guardado para ese set")

    return SetCodePriceOut(
        set_number=set_number,
        source=price.source,
        price_new=price.price_new,
        min_price_new=price.min_price_new,
        max_price_new=price.max_price_new,
        price_used=price.price_used,
        min_price_used=price.min_price_used,
        max_price_used=price.max_price_used,
        currency=price.currency,
        fetched_at=price.fetched_at,
    )


@router.post("/scrape-by-set/{set_number}", response_model=SetCodePriceOut)
def scrape_by_set(set_number: str, _: str = Depends(get_current_user)):
    result = asyncio.run(price_service.scrape_by_set_number(set_number))
    if not result:
        raise HTTPException(status_code=404, detail="No se encontraron precios para ese set")
    return SetCodePriceOut(**result)
