# Router de productos — CRUD, paginación, filtros, importación, exportación y recibos PDF
import base64
import csv
import io
import json
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any, Optional
from uuid import UUID
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import Boolean, Date as SADate, Integer, Numeric, String, TIMESTAMP
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models.price import MarketPrice, PortfolioDailySnapshot, PriceAlert
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductListOut, ProductOut, ProductQuickCreate, ProductUpdate
from app.services.product_service import product_service
from app.services.import_service import bulk_import
from app.services.storage_service import StorageService

router = APIRouter(prefix="/products", tags=["products"])

BACKUP_FORMAT = "legomarkal-backup-v1"
BACKUP_MODELS = {
    "products": Product,
    "market_prices": MarketPrice,
    "price_alerts": PriceAlert,
    "portfolio_daily_snapshots": PortfolioDailySnapshot,
}


def _serialize_value(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, UUID):
        return str(value)
    return value


def _model_to_record(instance: Any) -> dict[str, Any]:
    return {
        column.name: _serialize_value(getattr(instance, column.name))
        for column in instance.__table__.columns
    }


def _coerce_value(column: Any, value: Any) -> Any:
    if value is None:
        return None

    col_type = column.type

    if isinstance(col_type, PGUUID):
        return UUID(str(value))

    if isinstance(col_type, Numeric):
        return Decimal(str(value))

    if isinstance(col_type, SADate):
        if isinstance(value, date) and not isinstance(value, datetime):
            return value
        if isinstance(value, datetime):
            return value.date()
        return date.fromisoformat(str(value)[:10])

    if isinstance(col_type, TIMESTAMP):
        if isinstance(value, datetime):
            return value
        date_text = str(value).strip()
        if date_text.endswith("Z"):
            date_text = f"{date_text[:-1]}+00:00"
        return datetime.fromisoformat(date_text)

    if isinstance(col_type, Integer):
        return int(value)

    if isinstance(col_type, Boolean):
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            lowered = value.strip().lower()
            if lowered in {"true", "1", "yes", "si", "sí"}:
                return True
            if lowered in {"false", "0", "no"}:
                return False
        return bool(value)

    if isinstance(col_type, (String,)):
        return str(value)

    if isinstance(col_type, JSONB):
        return value

    return value


def _normalize_record(model: Any, raw_record: Any) -> dict[str, Any]:
    if not isinstance(raw_record, dict):
        raise ValueError("Cada fila del backup debe ser un objeto JSON")

    normalized: dict[str, Any] = {}
    for column in model.__table__.columns:
        if column.name in raw_record:
            normalized[column.name] = _coerce_value(column, raw_record[column.name])
    return normalized


@router.get("", response_model=ProductListOut)
def list_products(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    theme: Optional[str] = None,
    condition: Optional[str] = None,
    availability: Optional[str] = Query(None, pattern="^(available|sold)$"),
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    return product_service.list_products(db, page, size, theme, condition, availability, search)


@router.post("", response_model=ProductOut, status_code=201)
def create_product(body: ProductCreate, db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    return product_service.create_product(db, body)


@router.post("/quick-add", response_model=ProductOut, status_code=201)
def create_product_quick(body: ProductQuickCreate, db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    try:
        return product_service.create_product_from_set(db, body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/export")
def export_csv(db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    """Exporta todo el inventario activo como CSV descargable."""
    result = product_service.list_products(db, page=1, size=10000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "set_number", "name", "theme", "condition", "purchase_price", "quantity", "availability"])
    for p in result.items:
        writer.writerow([p.id, p.set_number, p.name, p.theme, p.condition, p.purchase_price, p.quantity, p.availability])
    output.seek(0)
    return StreamingResponse(output, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=inventario.csv"})


@router.get("/export-all")
def export_all_data(db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    """Exporta todas las tablas de negocio, sus datos y los PDFs de recibos en un único JSON."""
    storage = StorageService()

    # Recorre todos los productos y recopila los ficheros de recibo que existan en disco
    receipt_files: list[dict[str, str]] = []
    for product in db.query(Product).all():
        for receipt in (product.sale_receipts or []):
            storage_path = receipt.get("storage_path")
            if not storage_path:
                continue
            file_path = storage.get_local_path(storage_path)
            if file_path.exists():
                receipt_files.append({
                    "storage_path": storage_path,
                    "content_base64": base64.b64encode(file_path.read_bytes()).decode("utf-8"),
                })

    payload = {
        "format": BACKUP_FORMAT,
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "tables": {
            table_name: [_model_to_record(row) for row in db.query(model).all()]
            for table_name, model in BACKUP_MODELS.items()
        },
        # Lista de ficheros PDF codificados en base64 para que el backup sea autocontenido
        "receipt_files": receipt_files,
    }

    output = io.StringIO()
    json.dump(payload, output, ensure_ascii=False, indent=2)
    output.seek(0)

    filename = f"legomarkal_backup_{datetime.utcnow().date().isoformat()}.json"
    return StreamingResponse(
        output,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/import-all")
def import_all_data(file: UploadFile = File(...), db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    """Importa un backup JSON completo y reemplaza los datos existentes."""
    try:
        raw_content = file.file.read()
        payload = json.loads(raw_content.decode("utf-8-sig"))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="El archivo no es un JSON válido") from exc

    if payload.get("format") != BACKUP_FORMAT:
        raise HTTPException(status_code=400, detail="Formato de backup no compatible")

    tables = payload.get("tables")
    if not isinstance(tables, dict):
        raise HTTPException(status_code=400, detail="El backup no contiene el bloque 'tables'")

    missing_tables = [name for name in BACKUP_MODELS if name not in tables]
    if missing_tables:
        raise HTTPException(
            status_code=400,
            detail=f"Faltan tablas requeridas en el backup: {', '.join(missing_tables)}",
        )

    try:
        removed = {
            "market_prices": db.query(MarketPrice).delete(synchronize_session=False),
            "price_alerts": db.query(PriceAlert).delete(synchronize_session=False),
            "portfolio_daily_snapshots": db.query(PortfolioDailySnapshot).delete(synchronize_session=False),
            "products": db.query(Product).delete(synchronize_session=False),
        }

        products_data = tables.get("products") or []
        market_prices_data = tables.get("market_prices") or []
        price_alerts_data = tables.get("price_alerts") or []
        snapshots_data = tables.get("portfolio_daily_snapshots") or []

        if not all(isinstance(chunk, list) for chunk in [products_data, market_prices_data, price_alerts_data, snapshots_data]):
            raise ValueError("Cada tabla del backup debe ser un array JSON")

        for row in products_data:
            db.add(Product(**_normalize_record(Product, row)))
        db.flush()

        for row in market_prices_data:
            db.add(MarketPrice(**_normalize_record(MarketPrice, row)))

        for row in price_alerts_data:
            db.add(PriceAlert(**_normalize_record(PriceAlert, row)))

        for row in snapshots_data:
            db.add(PortfolioDailySnapshot(**_normalize_record(PortfolioDailySnapshot, row)))

        db.commit()
        inserted = {
            "products": len(products_data),
            "market_prices": len(market_prices_data),
            "price_alerts": len(price_alerts_data),
            "portfolio_daily_snapshots": len(snapshots_data),
        }

        # Restaura los ficheros PDF si el backup los incluye (campo opcional para compatibilidad)
        receipt_files_data = payload.get("receipt_files") or []
        storage = StorageService()
        restored_files = 0
        for rf in receipt_files_data:
            storage_path = rf.get("storage_path")
            content_b64 = rf.get("content_base64")
            if not storage_path or not content_b64:
                continue
            file_path = storage.get_local_path(storage_path)
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_bytes(base64.b64decode(content_b64))
            restored_files += 1

        return {
            "message": "Backup importado correctamente",
            "removed": removed,
            "inserted": inserted,
            "receipt_files_restored": restored_files,
        }
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"No se pudo importar el backup: {exc}") from exc


@router.post("/reset-all")
def reset_all_data(db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    """Elimina todos los datos de negocio en todas las tablas principales."""
    deleted = {
        "market_prices": db.query(MarketPrice).count(),
        "price_alerts": db.query(PriceAlert).count(),
        "portfolio_daily_snapshots": db.query(PortfolioDailySnapshot).count(),
        "products": db.query(Product).count(),
    }

    db.query(MarketPrice).delete(synchronize_session=False)
    db.query(PriceAlert).delete(synchronize_session=False)
    db.query(PortfolioDailySnapshot).delete(synchronize_session=False)
    db.query(Product).delete(synchronize_session=False)
    db.commit()

    return {
        "message": "Datos reseteados correctamente",
        "deleted": deleted,
    }


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: UUID, db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    product = product_service.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return product


@router.put("/{product_id}", response_model=ProductOut)
def update_product(product_id: UUID, body: ProductUpdate, db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    product = product_service.update_product(db, product_id, body)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return product


@router.delete("/{product_id}", status_code=204)
def delete_product(product_id: UUID, db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    if not product_service.soft_delete(db, product_id):
        raise HTTPException(status_code=404, detail="Producto no encontrado")


@router.post("/bulk-import", status_code=201)
def bulk_import_products(file: UploadFile = File(...), db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    """Importa productos en masa desde CSV o Excel."""
    content = file.file.read()
    created, errors = bulk_import(db, content, file.filename)
    return {"created": created, "errors": errors}


@router.post("/{product_id}/images", response_model=dict)
def upload_product_images(
    product_id: UUID,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Sube imágenes del producto a almacenamiento local y actualiza el listado de URLs."""
    product = product_service.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    upload_dir = Path(__file__).resolve().parents[2] / "uploads" / "products" / str(product_id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    image_urls = list(product.images or [])

    for file in files:
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Solo se permiten archivos de imagen",
            )

        suffix = Path(file.filename or "").suffix.lower() or ".jpg"
        filename = f"{uuid4().hex}{suffix}"
        destination = upload_dir / filename
        destination.write_bytes(file.file.read())
        image_urls.append(f"/uploads/products/{product_id}/{filename}")

    updated = product_service.update_product(db, product_id, ProductUpdate(images=image_urls))
    return {"images": updated.images if updated else image_urls}


@router.post("/{product_id}/sale-receipts", response_model=ProductOut)
def upload_sale_receipts(
    product_id: UUID,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Sube PDFs de recibo de venta y los asocia al producto."""
    product = product_service.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    storage = StorageService()
    receipts = list(product.sale_receipts or [])

    for file in files:
        if file.content_type != "application/pdf":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"'{file.filename}' no es un PDF válido",
            )
        data = file.file.read()
        meta = storage.upload_receipt(
            str(product_id),
            data,
            file.filename or "receipt.pdf",
            "application/pdf",
        )
        receipts.append(meta)

    updated = product_service.update_product(db, product_id, ProductUpdate(sale_receipts=receipts))
    return updated


@router.delete("/{product_id}/sale-receipts/{receipt_id}", status_code=204)
def delete_sale_receipt(
    product_id: UUID,
    receipt_id: str,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Elimina un recibo de venta del bucket Supabase y de los metadatos del producto."""
    product = product_service.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    receipts = list(product.sale_receipts or [])
    target = next((r for r in receipts if r.get("id") == receipt_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Recibo no encontrado")

    StorageService().delete_receipt(target["storage_path"])
    remaining = [r for r in receipts if r.get("id") != receipt_id]
    product_service.update_product(db, product_id, ProductUpdate(sale_receipts=remaining))


@router.get("/{product_id}/sale-receipts/{receipt_id}/download")
def download_sale_receipt(
    product_id: UUID,
    receipt_id: str,
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    """Sirve el PDF de recibo directamente como fichero descargable (requiere auth)."""
    product = product_service.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    receipts = list(product.sale_receipts or [])
    target = next((r for r in receipts if r.get("id") == receipt_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Recibo no encontrado")

    file_path = StorageService().get_local_path(target["storage_path"])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Fichero de recibo no encontrado en disco")

    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        filename=target.get("filename", "recibo.pdf"),
    )
