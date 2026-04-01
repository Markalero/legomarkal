# Router de alertas de precio
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.schemas.price import PriceAlertCreate, PriceAlertOut
from app.services.price_service import alert_service

router = APIRouter(prefix="/price-alerts", tags=["price-alerts"])


@router.get("", response_model=List[PriceAlertOut])
def list_alerts(db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    return alert_service.list_active_alerts(db)


@router.post("", response_model=PriceAlertOut, status_code=201)
def create_alert(body: PriceAlertCreate, db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    return alert_service.create_alert(db, body)


@router.delete("/{alert_id}", status_code=204)
def delete_alert(alert_id: UUID, db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    if not alert_service.delete_alert(db, alert_id):
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
