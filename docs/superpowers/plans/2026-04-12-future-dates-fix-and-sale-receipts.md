# Bug Fix Fechas Futuras + Recibos PDF de Venta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar la contaminación de datos futuros en `market_prices` (tres capas: startup, escritura, lectura) y añadir subida de recibos PDF al registrar una venta en el inventario.

**Architecture:** El fix de fechas aplica defensa en profundidad: un cleanup al arrancar el servidor borra rows fantasma ya existentes, el prune en escritura descarta futuros al guardar histórico mensual, y los filtros de lectura garantizan que ninguna query devuelva datos posteriores a hoy. Los recibos se almacenan en Supabase Storage (bucket `receipts`, privado) usando la Service Role Key; los metadatos se guardan como JSONB en la columna `sale_receipts` de `products`; las URLs de descarga son firmadas (TTL 1h) generadas bajo demanda. El `SaleModal` frontend (nuevo) gestiona el PATCH de venta y la subida de PDFs en un solo flujo.

**Tech Stack:** Python/FastAPI, SQLAlchemy (sync), Alembic, supabase-py 2.10.0, Next.js 14, TypeScript, Tailwind CSS.

---

## File Map

### Backend — modificar
| Archivo | Qué cambia |
|---------|-----------|
| `api/app/main.py` | Añade `_clean_future_market_prices()` y lo llama en `lifespan` |
| `api/app/services/price_service.py` | Prune futuro en escritura + filtro `≤ today` en 3 queries de lectura |
| `api/app/config.py` | Campo `supabase_service_key: str = ""` |
| `api/app/models/product.py` | Columna `sale_receipts = Column(JSONB, ...)` |
| `api/app/schemas/product.py` | `sale_receipts` en `ProductOut` y `ProductUpdate` |
| `api/app/routers/products.py` | 3 endpoints nuevos de recibos PDF |

### Backend — crear
| Archivo | Propósito |
|---------|-----------|
| `api/app/services/storage_service.py` | `StorageService`: upload, delete, signed URL |
| `api/alembic/versions/008_add_sale_receipts.py` | Migración: `sale_receipts JSONB` en `products` |

### Frontend — modificar
| Archivo | Qué cambia |
|---------|-----------|
| `admin-panel/types/index.ts` | Interface `SaleReceipt` + campo en `Product` |
| `admin-panel/lib/api-client.ts` | 3 métodos en `productsApi` |
| `admin-panel/components/inventory/InventoryTable.tsx` | Reemplaza `SellModal` por `SaleModal`; añade prop `onSaleComplete` |
| `admin-panel/app/(auth)/inventory/page.tsx` | Añade `onSaleComplete={() => load(filters)}` |
| `admin-panel/app/(auth)/inventory/[id]/page.tsx` | Reemplaza `SellModal` por `SaleModal`; añade bloque recibos |

### Frontend — crear
| Archivo | Propósito |
|---------|-----------|
| `admin-panel/components/inventory/SaleModal.tsx` | Modal de venta + dropzone PDF (auto-gestiona PATCH + upload) |
| `admin-panel/components/product/SaleReceiptList.tsx` | Lista de recibos con descarga y borrado |

---

## Task 1: Startup cleanup de fechas futuras

**Files:**
- Modify: `api/app/main.py`

- [ ] **Step 1: Añadir función `_clean_future_market_prices`**

Insertar la siguiente función en `api/app/main.py` **justo antes de `_startup_scrape_if_needed`** (línea ~19):

```python
async def _clean_future_market_prices() -> None:
    """Elimina filas de market_prices cuya fecha es posterior a hoy en España.

    Estas filas son artefactos de versiones previas del scraper. La limpieza
    es idempotente y se ejecuta siempre que arranca el servidor.
    """
    try:
        from sqlalchemy import cast, Date as SADate
        from app.database import SessionLocal
        from app.models.price import MarketPrice
        from app.services.price_service import price_service

        db = SessionLocal()
        try:
            today = price_service._now_spain().date()
            deleted = (
                db.query(MarketPrice)
                .filter(cast(MarketPrice.fetched_at, SADate) > today)
                .delete(synchronize_session=False)
            )
            if deleted:
                db.commit()
                logger.info(
                    "Startup: eliminados %d registros con fecha futura en market_prices",
                    deleted,
                )
            else:
                logger.info("Startup: sin registros futuros en market_prices — OK")
        finally:
            db.close()
    except Exception as exc:
        logger.error("Error limpiando fechas futuras: %s", exc, exc_info=True)
```

- [ ] **Step 2: Llamar al cleanup en `lifespan` antes del scrape**

Reemplazar el cuerpo de la función `lifespan` en `api/app/main.py`:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Arranca el scheduler al iniciar y lo para al apagar.

    Primero limpia datos futuros residuales, luego lanza scraping si es necesario.
    """
    start_scheduler()
    await _clean_future_market_prices()
    asyncio.create_task(_startup_scrape_if_needed())
    yield
    stop_scheduler()
```

- [ ] **Step 3: Verificar arranque del servidor**

```bash
cd api && uvicorn app.main:app --reload --port 8000
```

Esperar logs similares a:
```
INFO:app.main:Startup: sin registros futuros en market_prices — OK
INFO:app.main:Startup: N registros de precios ya existen para hoy...
```

- [ ] **Step 4: Commit**

```bash
git add api/app/main.py
git commit -m "fix: eliminar market_prices con fecha futura al arrancar el servidor"
```

---

## Task 2: Prune de futuros en escritura

**Files:**
- Modify: `api/app/services/price_service.py:391-405`

- [ ] **Step 1: Extender el bloque `prune_missing_months`**

En `price_service.py`, dentro de `save_monthly_history_points`, el bloque `if prune_missing_months:` actualmente termina en `db.delete(row)` (línea ~405). Añadir justo después de ese bloque (tras el `for row in stale_rows: ... db.delete(row)`) el siguiente fragmento para también borrar futuros:

```python
        # Borra también filas con fecha futura (segunda barrera de seguridad).
        future_rows = (
            db.query(MarketPrice)
            .filter(
                MarketPrice.product_id == storage_product_id,
                MarketPrice.source == source,
                cast(MarketPrice.fetched_at, SADate) > today_spain,
            )
            .all()
        )
        for row in future_rows:
            db.delete(row)
```

El bloque completo `if prune_missing_months:` queda así:

```python
        if prune_missing_months:
            today_spain = self._now_spain().date()
            stale_rows = (
                db.query(MarketPrice)
                .filter(
                    MarketPrice.product_id == storage_product_id,
                    MarketPrice.source == source,
                    cast(MarketPrice.fetched_at, SADate) < today_spain,
                )
                .all()
            )
            for row in stale_rows:
                row_date = row.fetched_at.date() if isinstance(row.fetched_at, datetime) else None
                if row_date not in keep_dates:
                    db.delete(row)

            # Borra también filas con fecha futura (segunda barrera de seguridad).
            future_rows = (
                db.query(MarketPrice)
                .filter(
                    MarketPrice.product_id == storage_product_id,
                    MarketPrice.source == source,
                    cast(MarketPrice.fetched_at, SADate) > today_spain,
                )
                .all()
            )
            for row in future_rows:
                db.delete(row)
```

- [ ] **Step 2: Commit**

```bash
git add api/app/services/price_service.py
git commit -m "fix: prune de market_prices con fecha futura en save_monthly_history_points"
```

---

## Task 3: Filtros `<= today` en queries de lectura

**Files:**
- Modify: `api/app/services/price_service.py` (3 funciones en `DashboardService`)

- [ ] **Step 1: Añadir filtro en `_latest_price_for_set`**

Localizar la función `_latest_price_for_set` (línea ~691). Reemplazar su cuerpo completo:

```python
    def _latest_price_for_set(
        self,
        db: Session,
        set_number: Optional[str],
        condition: Optional[str],
    ) -> Optional[MarketPrice]:
        if not set_number:
            return None

        today_spain = datetime.now(self.SPAIN_TZ).date()
        condition_price_filter = (
            MarketPrice.price_new.isnot(None)
            if condition == "SEALED"
            else MarketPrice.price_used.isnot(None)
        )

        return (
            db.query(MarketPrice)
            .join(Product, MarketPrice.product_id == Product.id)
            .filter(
                Product.set_number == set_number,
                Product.deleted_at.is_(None),
                MarketPrice.source == "bricklink",
                condition_price_filter,
                cast(MarketPrice.fetched_at, SADate) <= today_spain,
            )
            .order_by(MarketPrice.fetched_at.desc())
            .first()
        )
```

- [ ] **Step 2: Añadir filtro en `get_price_detail_trends`**

Localizar la función `get_price_detail_trends` (línea ~937). Reemplazar:

```python
    def get_price_detail_trends(self, db: Session) -> List[PriceDetailTrendPoint]:
        """Devuelve min/medio/max diario para análisis global de precios de mercado."""
        from sqlalchemy import cast, Date as SADate, func

        today_spain = datetime.now(self.SPAIN_TZ).date()
        base_price = func.coalesce(MarketPrice.price_new, MarketPrice.price_used)
        rows = (
            db.query(
                cast(MarketPrice.fetched_at, SADate).label("date"),
                func.min(base_price).label("min_price"),
                func.avg(base_price).label("avg_price"),
                func.max(base_price).label("max_price"),
            )
            .filter(
                MarketPrice.source == "bricklink",
                cast(MarketPrice.fetched_at, SADate) <= today_spain,
            )
            .group_by(cast(MarketPrice.fetched_at, SADate))
            .order_by(cast(MarketPrice.fetched_at, SADate))
            .limit(365)
            .all()
        )

        return [
            PriceDetailTrendPoint(
                date=row.date,
                min_price=Decimal(str(row.min_price or 0)).quantize(Decimal("0.01")),
                avg_price=Decimal(str(row.avg_price or 0)).quantize(Decimal("0.01")),
                max_price=Decimal(str(row.max_price or 0)).quantize(Decimal("0.01")),
            )
            for row in rows
        ]
```

- [ ] **Step 3: Añadir filtro en `get_price_insights`**

Localizar la función `get_price_insights` (línea ~966). Al principio del cuerpo de la función, añadir `today_spain` y usarla en la query de `history`:

```python
    def get_price_insights(self, db: Session, limit: int = 200) -> List[PriceInsightProduct]:
        """Calcula métricas por set y ordena por beneficio absoluto en euros."""
        today_spain = datetime.now(self.SPAIN_TZ).date()
        products = (
            db.query(Product)
            .filter(Product.deleted_at.is_(None), Product.availability == "available")
            .order_by(Product.created_at.desc())
            .limit(limit)
            .all()
        )
        insights: list[PriceInsightProduct] = []

        for product in products:
            history = (
                db.query(MarketPrice)
                .join(Product, MarketPrice.product_id == Product.id)
                .filter(
                    Product.set_number == product.set_number,
                    Product.deleted_at.is_(None),
                    MarketPrice.source == "bricklink",
                    cast(MarketPrice.fetched_at, SADate) <= today_spain,
                )
                .order_by(MarketPrice.fetched_at.asc())
                .all()
            )
            # ... resto del bucle sin cambios
```

El resto del bucle `for product in products:` permanece exactamente igual que en el original (cálculo de values, min_candidates, max_candidates, etc.).

- [ ] **Step 4: Commit**

```bash
git add api/app/services/price_service.py
git commit -m "fix: filtrar fechas futuras en queries de lectura de market_prices"
```

---

## Task 4: Añadir `supabase_service_key` a config

**Files:**
- Modify: `api/app/config.py`

- [ ] **Step 1: Añadir el campo**

Reemplazar la clase `Settings` completa:

```python
# Configuración central de la aplicación usando Pydantic BaseSettings
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Carga variables de entorno y provee configuración tipada a toda la app."""

    database_url: str
    direct_url: str
    supabase_url: str
    supabase_anon_key: str
    supabase_service_key: str = ""
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24  # 24 horas
    admin_email: str
    admin_password: str
    scraper_schedule_hour: int = 3
    rebrickable_api_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
```

- [ ] **Step 2: Añadir la variable a `.env`**

En el fichero `api/.env` (o donde esté configurado el entorno de producción/Render), añadir:

```
SUPABASE_SERVICE_KEY=<service_role_key_de_supabase>
```

La Service Role Key se obtiene en Supabase → Project Settings → API → `service_role` (secret).

- [ ] **Step 3: Commit**

```bash
git add api/app/config.py
git commit -m "feat: añadir supabase_service_key a la configuración"
```

---

## Task 5: Crear `StorageService`

**Files:**
- Create: `api/app/services/storage_service.py`

- [ ] **Step 1: Crear el fichero**

```python
# Servicio de almacenamiento de recibos PDF en Supabase Storage
import uuid
from datetime import datetime, timezone

from supabase import create_client, Client


class StorageService:
    """Gestiona ficheros de recibos de venta en el bucket 'receipts' (privado) de Supabase.

    Usa la Service Role Key para poder operar sobre un bucket privado desde el backend.
    Las URLs de descarga son firmadas con TTL de 1 hora y se generan bajo demanda.
    """

    BUCKET = "receipts"

    def __init__(self) -> None:
        from app.config import settings
        self._client: Client = create_client(settings.supabase_url, settings.supabase_service_key)

    def upload_receipt(
        self,
        product_id: str,
        file_bytes: bytes,
        filename: str,
        content_type: str,
    ) -> dict:
        """Sube un PDF y devuelve los metadatos del recibo para persistir en JSONB."""
        receipt_id = str(uuid.uuid4())
        storage_path = f"{product_id}/{receipt_id}_{filename}"
        self._client.storage.from_(self.BUCKET).upload(
            storage_path,
            file_bytes,
            {"content-type": content_type, "upsert": "false"},
        )
        return {
            "id": receipt_id,
            "filename": filename,
            "storage_path": storage_path,
            "uploaded_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }

    def delete_receipt(self, storage_path: str) -> None:
        """Borra el fichero del bucket. No lanza excepción si ya no existe."""
        try:
            self._client.storage.from_(self.BUCKET).remove([storage_path])
        except Exception:
            pass

    def get_signed_url(self, storage_path: str, expires_in: int = 3600) -> str:
        """Genera y devuelve una URL firmada válida durante `expires_in` segundos."""
        response = self._client.storage.from_(self.BUCKET).create_signed_url(
            storage_path, expires_in
        )
        # supabase-py v2: el objeto devuelto tiene atributo .signed_url
        return response.signed_url


storage_service = StorageService
```

> **Nota**: `storage_service = StorageService` (sin paréntesis) expone la clase para instanciarla en cada request, evitando que la conexión quede en estado stale.

- [ ] **Step 2: Commit**

```bash
git add api/app/services/storage_service.py
git commit -m "feat: crear StorageService para recibos PDF en Supabase Storage"
```

---

## Task 6: Migración Alembic — columna `sale_receipts`

**Files:**
- Create: `api/alembic/versions/008_add_sale_receipts.py`

- [ ] **Step 1: Crear la migración**

```python
"""Add sale_receipts JSONB column to products

Revision ID: 008_add_sale_receipts
Revises: 007_price_new_cols
Create Date: 2026-04-12
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB


revision = "008_add_sale_receipts"
down_revision = "007_price_new_cols"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column(
            "sale_receipts",
            JSONB,
            nullable=True,
            server_default="[]",
        ),
    )


def downgrade() -> None:
    op.drop_column("products", "sale_receipts")
```

- [ ] **Step 2: Aplicar la migración**

```bash
cd api && alembic upgrade head
```

Salida esperada:
```
INFO  [alembic.runtime.migration] Running upgrade 007_price_new_cols -> 008_add_sale_receipts, Add sale_receipts JSONB column to products
```

- [ ] **Step 3: Commit**

```bash
git add api/alembic/versions/008_add_sale_receipts.py
git commit -m "feat: migración Alembic — añadir sale_receipts JSONB a products"
```

---

## Task 7: Actualizar modelo `Product`

**Files:**
- Modify: `api/app/models/product.py`

- [ ] **Step 1: Añadir columna `sale_receipts`**

Añadir la línea justo después de la columna `images` (línea 28):

```python
    sale_receipts = Column(JSONB, default=list, nullable=True)
```

El bloque de columnas queda:

```python
    images = Column(JSONB, default=list)
    sale_receipts = Column(JSONB, default=list, nullable=True)
    notes = Column(Text)
```

- [ ] **Step 2: Commit**

```bash
git add api/app/models/product.py
git commit -m "feat: añadir columna sale_receipts al modelo Product"
```

---

## Task 8: Actualizar schemas Pydantic

**Files:**
- Modify: `api/app/schemas/product.py`

- [ ] **Step 1: Añadir `sale_receipts` a `ProductOut` y `ProductUpdate`**

Reemplazar el fichero completo con:

```python
# Schemas Pydantic para validación y serialización de Product
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.price import MarketPriceOut


# ── Product ───────────────────────────────────────────────────────────────────

ConditionType = Literal["SEALED", "OPEN_COMPLETE", "OPEN_INCOMPLETE"]
AvailabilityType = Literal["available", "sold"]


class ProductBase(BaseModel):
    """Campos compartidos por todos los contratos de producto (alta, edición y lectura)."""

    set_number: Optional[str] = Field(None, max_length=20)
    name: str = Field(..., max_length=255)
    theme: Optional[str] = Field(None, max_length=100)
    year_released: Optional[int] = None
    condition: Optional[ConditionType] = None
    purchase_price: Optional[Decimal] = None
    purchase_date: Optional[date] = None
    purchase_source: Optional[str] = None
    quantity: int = 1
    images: List[str] = []
    notes: Optional[str] = None
    availability: AvailabilityType = "available"


class ProductCreate(ProductBase):
    pass


class ProductUpdate(ProductBase):
    name: Optional[str] = None  # todos los campos son opcionales en edición
    quantity: Optional[int] = None
    availability: Optional[AvailabilityType] = None
    sold_date: Optional[date] = None
    sold_price: Optional[Decimal] = None
    sale_receipts: Optional[List[Dict[str, Any]]] = None


class ProductOut(ProductBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None
    latest_market_price: Optional[MarketPriceOut] = None
    sold_date: Optional[date] = None
    sold_price: Optional[Decimal] = None
    sale_receipts: List[Dict[str, Any]] = []

    model_config = {"from_attributes": True}


class ProductQuickCreate(BaseModel):
    """Alta rápida de producto usando set_number + datos mínimos de compra."""

    set_number: str = Field(
        ...,
        min_length=3,
        max_length=20,
        pattern=r"^\d{3,7}(?:-\d+)?$",
        description="Número de set LEGO válido (ej. 75192 o 75192-1)",
    )
    condition: ConditionType
    purchase_price: Decimal = Field(..., gt=0)
    purchase_date: date
    purchase_source: str = Field(..., min_length=1, max_length=255)
    quantity: int = Field(1, ge=1)
    notes: Optional[str] = None


# ── Listado con paginación ────────────────────────────────────────────────────

class ProductListOut(BaseModel):
    items: List[ProductOut]
    total: int
    page: int
    size: int
    pages: int
```

- [ ] **Step 2: Commit**

```bash
git add api/app/schemas/product.py
git commit -m "feat: añadir sale_receipts a ProductOut y ProductUpdate"
```

---

## Task 9: Endpoints de recibos en `products.py`

**Files:**
- Modify: `api/app/routers/products.py`

- [ ] **Step 1: Añadir los 3 endpoints al final del fichero**

Añadir al final de `api/app/routers/products.py` (tras el endpoint de imágenes):

```python
from app.services.storage_service import StorageService


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
```

> **Nota**: el `import StorageService` va al final del fichero (tras los imports existentes en la cabecera). Para evitar conflictos con el import circular en el contexto de Alembic, el import de `StorageService` se hace dentro del módulo del router, no en la cabecera global.

- [ ] **Step 2: Mover el import de StorageService a la cabecera del fichero**

En la cabecera de `api/app/routers/products.py`, añadir el import junto al resto:

```python
from app.services.storage_service import StorageService
```

Y eliminar el import inline del Step 1 (`from app.services.storage_service import StorageService` que pusiste antes del primer endpoint).

- [ ] **Step 3: Verificar que el servidor levanta sin errores**

```bash
cd api && uvicorn app.main:app --reload --port 8000
```

Abrir `http://localhost:8000/docs` y confirmar que aparecen los 3 endpoints bajo `/products`.

- [ ] **Step 4: Commit**

```bash
git add api/app/routers/products.py
git commit -m "feat: endpoints upload/delete/download de recibos PDF de venta"
```

---

## Task 10: Tipos TypeScript — `SaleReceipt` + actualizar `Product`

**Files:**
- Modify: `admin-panel/types/index.ts`

- [ ] **Step 1: Añadir interface `SaleReceipt` y actualizar `Product`**

En `admin-panel/types/index.ts`, añadir la interface `SaleReceipt` justo antes de `export interface Product`:

```typescript
export interface SaleReceipt {
  id: string;
  filename: string;
  storage_path: string;
  uploaded_at: string;
}
```

Y dentro de `interface Product`, añadir el campo `sale_receipts` después de `sold_price`:

```typescript
  sale_receipts: SaleReceipt[];
```

La sección del `Product` queda:

```typescript
export interface Product {
  id: string;
  set_number: string | null;
  name: string;
  theme: string | null;
  year_released: number | null;
  condition: Condition | null;
  purchase_price: number | null;
  purchase_date: string | null;
  purchase_source: string | null;
  quantity: number;
  images: string[];
  notes: string | null;
  availability: Availability;
  sold_date: string | null;
  sold_price: number | null;
  sale_receipts: SaleReceipt[];
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  latest_market_price?: MarketPrice | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add admin-panel/types/index.ts
git commit -m "feat: añadir SaleReceipt interface y campo sale_receipts a Product"
```

---

## Task 11: Métodos de API client

**Files:**
- Modify: `admin-panel/lib/api-client.ts`

- [ ] **Step 1: Añadir 3 métodos a `productsApi`**

Al final del objeto `productsApi` (tras `bulkImport`), añadir:

```typescript
  uploadSaleReceipts: (id: string, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    return request<Product>(`/products/${id}/sale-receipts`, {
      method: "POST",
      body: form,
    });
  },

  deleteSaleReceipt: (id: string, receiptId: string) =>
    request<void>(`/products/${id}/sale-receipts/${receiptId}`, {
      method: "DELETE",
    }),

  getSaleReceiptDownloadUrl: (id: string, receiptId: string) =>
    request<{ url: string }>(
      `/products/${id}/sale-receipts/${receiptId}/download`
    ),
```

También añadir `SaleReceipt` a la línea de imports de tipos (primer bloque de imports del fichero):

```typescript
import type {
  // ...existentes...
  SaleReceipt,
} from "@/types";
```

- [ ] **Step 2: Commit**

```bash
git add admin-panel/lib/api-client.ts
git commit -m "feat: métodos uploadSaleReceipts, deleteSaleReceipt, getSaleReceiptDownloadUrl en api-client"
```

---

## Task 12: Crear `SaleModal.tsx`

**Files:**
- Create: `admin-panel/components/inventory/SaleModal.tsx`

- [ ] **Step 1: Crear el componente**

```typescript
// Modal de venta con subida opcional de recibos PDF
"use client";
import { useEffect, useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { productsApi } from "@/lib/api-client";

interface SaleModalProps {
  open: boolean;
  /** ID del producto que se va a marcar como vendido */
  productId: string;
  productName: string;
  /** Precio sugerido como valor inicial del input */
  suggestedPrice: number | null;
  /** Se llama tras PATCH + upload exitosos */
  onSuccess: () => void;
  onCancel: () => void;
}

export function SaleModal({
  open,
  productId,
  productName,
  suggestedPrice,
  onSuccess,
  onCancel,
}: SaleModalProps) {
  const [price, setPrice] = useState("");
  const [date, setDate] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Resetea el formulario cada vez que el modal se abre
  useEffect(() => {
    if (!open) return;
    setPrice(suggestedPrice != null ? String(suggestedPrice) : "");
    setDate(new Date().toISOString().slice(0, 10));
    setFiles([]);
    setError(null);
  }, [open, suggestedPrice]);

  function handleFilePick(picked: FileList) {
    const pdfs = Array.from(picked).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (pdfs.length < picked.length) {
      setError("Solo se aceptan archivos PDF.");
    } else {
      setError(null);
    }
    setFiles((prev) => [...prev, ...pdfs]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleConfirm() {
    const parsedPrice = parseFloat(price);
    if (!price || isNaN(parsedPrice) || parsedPrice <= 0) {
      setError("Introduce un precio de venta válido.");
      return;
    }
    if (!date) {
      setError("Introduce la fecha de venta.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // 1. Marcar como vendido
      await productsApi.update(productId, {
        availability: "sold",
        sold_price: parsedPrice,
        sold_date: date,
      });
      // 2. Subir recibos si los hay
      if (files.length > 0) {
        await productsApi.uploadSaleReceipts(productId, files);
      }
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al registrar la venta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onCancel} title="Registrar venta" className="max-w-sm">
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Datos de la venta de{" "}
          <span className="font-medium text-text-primary">{productName}</span>.
        </p>

        <Input
          label="Precio de venta (€)"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0.00"
          value={price}
          onChange={(e) => {
            setPrice(e.target.value);
            setError(null);
          }}
        />
        <Input
          label="Fecha de venta"
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setError(null);
          }}
        />

        {/* Dropzone PDF */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-text-secondary">
            Recibos PDF (opcional)
          </p>

          {files.length > 0 && (
            <ul className="space-y-1">
              {files.map((f, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-bg-elevated px-3 py-1.5 text-xs text-text-secondary"
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <FileText className="h-3.5 w-3.5 flex-shrink-0 text-accent-lego" />
                    <span className="truncate">{f.name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="ml-2 flex-shrink-0 text-text-muted hover:text-status-error"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full justify-center border-dashed"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
          >
            <Upload className="h-4 w-4" />
            Añadir PDF
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) handleFilePick(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {error && <p className="text-xs text-status-error">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleConfirm} loading={loading}>
            Confirmar venta
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add admin-panel/components/inventory/SaleModal.tsx
git commit -m "feat: crear SaleModal con dropzone PDF integrado"
```

---

## Task 13: Crear `SaleReceiptList.tsx`

**Files:**
- Create: `admin-panel/components/product/SaleReceiptList.tsx`

- [ ] **Step 1: Crear el componente**

```typescript
// Lista de recibos de venta adjuntos a un producto vendido
"use client";
import { useState } from "react";
import { Download, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { productsApi } from "@/lib/api-client";
import type { SaleReceipt } from "@/types";

interface SaleReceiptListProps {
  productId: string;
  receipts: SaleReceipt[];
  /** Llamado con la lista actualizada tras borrar un recibo */
  onUpdate: (receipts: SaleReceipt[]) => void;
}

export function SaleReceiptList({ productId, receipts, onUpdate }: SaleReceiptListProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDownload(receipt: SaleReceipt) {
    setDownloadingId(receipt.id);
    try {
      const { url } = await productsApi.getSaleReceiptDownloadUrl(productId, receipt.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDelete(receipt: SaleReceipt) {
    if (!confirm(`¿Eliminar el recibo "${receipt.filename}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    setDeletingId(receipt.id);
    try {
      await productsApi.deleteSaleReceipt(productId, receipt.id);
      onUpdate(receipts.filter((r) => r.id !== receipt.id));
    } finally {
      setDeletingId(null);
    }
  }

  if (receipts.length === 0) {
    return <p className="text-sm text-text-muted">Sin recibos adjuntos.</p>;
  }

  return (
    <ul className="space-y-2">
      {receipts.map((receipt) => (
        <li
          key={receipt.id}
          className="flex items-center justify-between rounded-lg bg-bg-elevated px-3 py-2 text-sm"
        >
          <span className="flex items-center gap-2 min-w-0 text-text-secondary">
            <FileText className="h-4 w-4 flex-shrink-0 text-accent-lego" />
            <span className="truncate">{receipt.filename}</span>
          </span>
          <div className="flex gap-1 flex-shrink-0 ml-2">
            <Button
              variant="ghost"
              size="sm"
              loading={downloadingId === receipt.id}
              onClick={() => handleDownload(receipt)}
              title="Descargar"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              loading={deletingId === receipt.id}
              onClick={() => handleDelete(receipt)}
              title="Eliminar recibo"
              className="text-status-error hover:text-status-error"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add admin-panel/components/product/SaleReceiptList.tsx
git commit -m "feat: crear SaleReceiptList con descarga y borrado de recibos"
```

---

## Task 14: Actualizar `InventoryTable.tsx`

**Files:**
- Modify: `admin-panel/components/inventory/InventoryTable.tsx`

- [ ] **Step 1: Cambiar import de `SellModal` por `SaleModal`**

Reemplazar:
```typescript
import { SellModal } from "@/components/ui/SellModal";
```
por:
```typescript
import { SaleModal } from "@/components/inventory/SaleModal";
```

- [ ] **Step 2: Añadir prop `onSaleComplete` a la interface**

Reemplazar la interface `InventoryTableProps`:

```typescript
interface InventoryTableProps {
  data: ProductListOut;
  onPageChange: (page: number) => void;
  onToggleAvailability?: (
    productId: string,
    currentAvailability: "available" | "sold",
  ) => void;
  /** Llamado tras completar la venta (PATCH + upload) para refrescar la lista */
  onSaleComplete?: () => void;
}
```

> **Nota**: se eliminan los parámetros opcionales `soldPrice` y `soldDate` del callback, ya que ahora `SaleModal` gestiona el PATCH internamente.

- [ ] **Step 3: Añadir `onSaleComplete` a la desestructuración**

```typescript
export function InventoryTable({ data, onPageChange, onToggleAvailability, onSaleComplete }: InventoryTableProps) {
```

- [ ] **Step 4: Reemplazar `<SellModal>` por `<SaleModal>`**

El bloque `SellModal` actual (líneas 76-85) pasa a ser:

```typescript
      <SaleModal
        open={sellTarget !== null}
        productId={sellTarget?.productId ?? ""}
        productName={sellTarget?.productName ?? ""}
        suggestedPrice={sellTarget?.suggestedPrice ?? null}
        onSuccess={() => {
          setSellTarget(null);
          onSaleComplete?.();
        }}
        onCancel={() => setSellTarget(null)}
      />
```

- [ ] **Step 5: Actualizar el botón de revertir venta**

El onClick del botón "Vendido" (revertir) actualmente llama a `onToggleAvailability?.(product.id, "sold")`. Con la firma simplificada, queda igual:

```typescript
onClick={(e) => {
  e.stopPropagation();
  if (isSold) {
    onToggleAvailability?.(product.id, "sold");
  } else {
    setSellTarget({
      productId: product.id,
      productName: product.name,
      suggestedPrice: marketPrice,
    });
  }
}}
```

- [ ] **Step 6: Commit**

```bash
git add admin-panel/components/inventory/InventoryTable.tsx
git commit -m "feat: reemplazar SellModal por SaleModal en InventoryTable"
```

---

## Task 15: Actualizar `inventory/page.tsx`

**Files:**
- Modify: `admin-panel/app/(auth)/inventory/page.tsx`

- [ ] **Step 1: Actualizar `handleToggleAvailability` para solo manejar el revert**

La función `handleToggleAvailability` actualmente maneja tanto "sold" como "available". Como el flujo "sold" lo gestiona `SaleModal`, simplificar:

```typescript
  async function handleToggleAvailability(
    productId: string,
    currentAvailability: "available" | "sold",
  ) {
    // Solo se llega aquí para revertir a "available"; el flujo "sold" lo maneja SaleModal.
    if (currentAvailability === "sold") {
      await productsApi.update(productId, {
        availability: "available",
        sold_price: null,
        sold_date: null,
      });
      await load(filters);
    }
  }
```

- [ ] **Step 2: Añadir `onSaleComplete` al componente `InventoryTable`**

En el JSX donde se renderiza `<InventoryTable>`, añadir la prop:

```tsx
            <InventoryTable
              data={data}
              onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
              onToggleAvailability={handleToggleAvailability}
              onSaleComplete={() => load(filters)}
            />
```

- [ ] **Step 3: Commit**

```bash
git add admin-panel/app/(auth)/inventory/page.tsx
git commit -m "feat: conectar onSaleComplete en inventory page para refrescar tras venta"
```

---

## Task 16: Actualizar `inventory/[id]/page.tsx`

**Files:**
- Modify: `admin-panel/app/(auth)/inventory/[id]/page.tsx`

- [ ] **Step 1: Reemplazar import de `SellModal` por `SaleModal` y añadir `SaleReceiptList`**

Reemplazar:
```typescript
import { SellModal } from "@/components/ui/SellModal";
```
por:
```typescript
import { SaleModal } from "@/components/inventory/SaleModal";
import { SaleReceiptList } from "@/components/product/SaleReceiptList";
import type { SaleReceipt } from "@/types";
```

> **Nota**: el import de `SaleReceipt` puede omitirse si TypeScript lo infiere del tipo de `product.sale_receipts`.

- [ ] **Step 2: Eliminar `handleConfirmSell` y simplificar `handleToggleAvailability`**

Eliminar la función `handleConfirmSell` (líneas 94-103) completa. La función `handleToggleAvailability` queda:

```typescript
  function handleToggleAvailability() {
    if (!product) return;
    if (product.availability === "available") {
      setSellModalOpen(true);
    } else {
      productsApi
        .update(params.id, { availability: "available", sold_price: null, sold_date: null })
        .then(setProduct);
    }
  }
```

- [ ] **Step 3: Reemplazar `<SellModal>` por `<SaleModal>` al final del JSX**

Reemplazar el bloque `<SellModal ...>` (líneas 396-403) por:

```tsx
      <SaleModal
        open={sellModalOpen}
        productId={params.id}
        productName={product.name}
        suggestedPrice={marketPrice ?? null}
        onSuccess={() => {
          setSellModalOpen(false);
          load();
        }}
        onCancel={() => setSellModalOpen(false)}
      />
```

- [ ] **Step 4: Añadir bloque "Recibos de venta" en la columna derecha**

En la sección de la columna derecha (tras el card de alertas, dentro del `<div className="space-y-6">`), añadir condicionalmente:

```tsx
            {/* Recibos de venta — solo visible cuando el producto está vendido */}
            {isSold && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    Recibos de venta ({(product.sale_receipts ?? []).length})
                  </CardTitle>
                </CardHeader>
                <SaleReceiptList
                  productId={product.id}
                  receipts={product.sale_receipts ?? []}
                  onUpdate={(updated) =>
                    setProduct({ ...product, sale_receipts: updated })
                  }
                />
              </Card>
            )}
```

- [ ] **Step 5: Commit**

```bash
git add admin-panel/app/(auth)/inventory/[id]/page.tsx
git commit -m "feat: SaleModal + bloque de recibos en ficha de producto"
```

---

## Task 17: Verificación end-to-end

- [ ] **Step 1: Arrancar el backend y aplicar migración**

```bash
cd api
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Verificar en logs que no aparecen registros futuros.

- [ ] **Step 2: Arrancar el frontend**

```bash
cd admin-panel
npm run dev
```

- [ ] **Step 3: Flujo de venta desde la tabla de inventario**

1. Ir a `/inventory`
2. Hacer clic en "Disponible" de cualquier producto
3. Verificar que se abre `SaleModal` con precio sugerido y fecha actual
4. Subir un PDF de prueba desde el dropzone
5. Pulsar "Confirmar venta"
6. Verificar que el producto pasa a "Vendido" en la tabla

- [ ] **Step 4: Flujo de recibos desde la ficha de producto**

1. Ir a la ficha del producto vendido en `/inventory/{id}`
2. Verificar que aparece el card "Recibos de venta" en la columna derecha
3. Pulsar el icono de descarga → debe abrirse una URL firmada en nueva pestaña
4. Pulsar el icono de borrado → confirmar y verificar que desaparece de la lista

- [ ] **Step 5: Verificar que no aparecen datos futuros en los gráficos**

1. Ir a `/prices` o al dashboard
2. Verificar que la gráfica de precios no muestra datos de fechas futuras

- [ ] **Step 6: Commit final de verificación (si hubiera ajustes menores)**

```bash
git add -p
git commit -m "fix: ajustes menores tras verificación end-to-end"
```

---

## Self-Review

### Spec coverage check

| Req. del spec | Tarea que lo implementa |
|---------------|------------------------|
| Cleanup startup futuros | Task 1 |
| Prune futuro en escritura | Task 2 |
| Filtro `≤ today` en `_latest_price_for_set` | Task 3 Step 1 |
| Filtro `≤ today` en `get_price_detail_trends` | Task 3 Step 2 |
| Filtro `≤ today` en `get_price_insights` | Task 3 Step 3 |
| `supabase_service_key` en config | Task 4 |
| `StorageService` (upload/delete/signed URL) | Task 5 |
| Migración `sale_receipts JSONB` | Task 6 |
| Modelo `Product` + columna | Task 7 |
| Schemas Pydantic actualizados | Task 8 |
| 3 endpoints API recibos | Task 9 |
| `SaleReceipt` TypeScript + `Product.sale_receipts` | Task 10 |
| 3 métodos `api-client.ts` | Task 11 |
| `SaleModal.tsx` | Task 12 |
| `SaleReceiptList.tsx` | Task 13 |
| `InventoryTable` → `SaleModal` | Task 14 |
| `inventory/page.tsx` → `onSaleComplete` | Task 15 |
| `[id]/page.tsx` → `SaleModal` + recibos | Task 16 |

### Consistencia de tipos

- `StorageService.upload_receipt` devuelve `dict` con keys `id`, `filename`, `storage_path`, `uploaded_at` — coincide con la interface `SaleReceipt` en TypeScript.
- `ProductUpdate.sale_receipts: Optional[List[Dict[str, Any]]]` — compatible con `model_dump(exclude_unset=True)` en `update_product`.
- `SaleModal.onSuccess: () => void` — sin parámetros; el padre decide qué hacer (reload, setState).
- `SaleReceiptList.onUpdate: (receipts: SaleReceipt[]) => void` — recibe la lista ya filtrada.
- `InventoryTable.onToggleAvailability` simplificado a `(productId, currentAvailability)` sin `soldPrice`/`soldDate`.
