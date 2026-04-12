# Router de productos — CRUD, paginación, filtros, importación, exportación y recibos PDF
import csv
import io
from pathlib import Path
from typing import Optional
from uuid import UUID
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.schemas.product import ProductCreate, ProductListOut, ProductOut, ProductQuickCreate, ProductUpdate
from app.services.product_service import product_service
from app.services.import_service import bulk_import
from app.services.storage_service import StorageService

router = APIRouter(prefix="/products", tags=["products"])


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
    """Genera una URL firmada de descarga válida durante 1 hora."""
    product = product_service.get_product(db, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    receipts = list(product.sale_receipts or [])
    target = next((r for r in receipts if r.get("id") == receipt_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Recibo no encontrado")

    url = StorageService().get_signed_url(target["storage_path"])
    return {"url": url}
