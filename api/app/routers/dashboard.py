# Router del dashboard — KPIs, top margen y tendencias de precio
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.schemas.price import (
    DashboardSummary,
    PriceDetailTrendPoint,
    PriceInsightProduct,
    PriceTrendPoint,
    RealProfitSummary,
    TopMarginProduct,
)
from app.services.price_service import dashboard_service, price_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# Router adicional para el trigger del scraper (fuera del prefijo /dashboard)
scraper_router = APIRouter(prefix="/scraper", tags=["scraper"])


@router.get("/summary", response_model=DashboardSummary)
def get_summary(db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    """KPIs principales: valor inventario, margen, ROI, total artículos."""
    return dashboard_service.get_summary(db)


@router.get("/top-margin", response_model=List[TopMarginProduct])
def get_top_margin(db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    """Top 10 productos por margen potencial."""
    return dashboard_service.get_top_margin(db)


@router.get("/price-trends", response_model=List[PriceTrendPoint])
def get_price_trends(db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    """Datos para el gráfico de evolución de inversión y valor de mercado."""
    return dashboard_service.get_price_trends(db)


@router.get("/price-detail-trends", response_model=List[PriceDetailTrendPoint])
def get_price_detail_trends(db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    """Serie diaria agregada de mínimos, media y máximos para BrickLink."""
    return dashboard_service.get_price_detail_trends(db)


@router.get("/price-insights", response_model=List[PriceInsightProduct])
def get_price_insights(db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    """Métricas detalladas por set ordenadas por beneficio absoluto en euros."""
    return dashboard_service.get_price_insights(db)


@router.get("/real-profits", response_model=RealProfitSummary)
def get_real_profits(db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    """Resumen de beneficios reales sobre productos ya vendidos."""
    return dashboard_service.get_real_profit_summary(db)


@scraper_router.post("/trigger", status_code=202)
def trigger_scraper(background_tasks: BackgroundTasks, _: str = Depends(get_current_user)):
    """Fuerza ejecución completa del scraper (admin)."""
    from app.scraper.runner import scrape_all_products
    background_tasks.add_task(scrape_all_products)
    return {"message": "Scraper completo iniciado en background"}


@scraper_router.post("/refresh-all")
def refresh_all_scraper(_: str = Depends(get_current_user)):
    """Ejecuta refresco completo síncrono y devuelve resumen de cobertura diaria."""
    from app.scraper.runner import refresh_all_products_prices_for_today

    result = refresh_all_products_prices_for_today()
    return {
        "message": "Refresco completo de precios finalizado",
        **result,
    }


@scraper_router.post("/backfill-daily")
def backfill_daily(
    product_id: Optional[UUID] = None,
    months: int = 6,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Endpoint admin: rellena histórico diario interpolado desde puntos mensuales.

    - Si `product_id` no se pasa, procesa todos los productos con `set_number`.
    - `months` controla cuántos meses hacia atrás se consideran.
    """
    created = price_service.backfill_daily_from_monthly(db, product_id=product_id, months=months)
    return {"message": "Backfill diario completado", "created_rows": created}
