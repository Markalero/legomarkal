# UI/UX Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar simplificación de condiciones, flujo de venta con modal, beneficios reales en dashboard, historial congelado con marcador de venta, skeleton de navegación, correcciones funcionales y rediseño visual de la tabla de precios.

**Architecture:** Los cambios arrancan en backend (migración BD, endpoints nuevos, filtros de disponibilidad) y continúan en frontend (tipos → componentes → páginas). Cada tarea genera un commit limpio e independiente.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic (backend), Next.js 14 App Router + Tailwind CSS + Recharts (frontend)

---

## Mapa de ficheros

| Acción | Fichero |
|---|---|
| CREAR | `api/alembic/versions/002_add_sold_fields.py` |
| MODIFICAR | `api/app/models/product.py` |
| MODIFICAR | `api/app/schemas/product.py` |
| MODIFICAR | `api/app/schemas/price.py` |
| MODIFICAR | `api/app/services/price_service.py` |
| MODIFICAR | `api/app/routers/dashboard.py` |
| MODIFICAR | `api/app/scraper/runner.py` |
| MODIFICAR | `admin-panel/types/index.ts` |
| MODIFICAR | `admin-panel/lib/api-client.ts` |
| MODIFICAR | `admin-panel/lib/utils.ts` |
| CREAR | `admin-panel/components/ui/SellModal.tsx` |
| MODIFICAR | `admin-panel/components/inventory/FilterBar.tsx` |
| MODIFICAR | `admin-panel/components/product/ProductForm.tsx` |
| MODIFICAR | `admin-panel/components/inventory/InventoryTable.tsx` |
| CREAR | `admin-panel/app/(auth)/inventory/[id]/loading.tsx` |
| MODIFICAR | `admin-panel/components/product/PriceHistory.tsx` |
| MODIFICAR | `admin-panel/app/(auth)/inventory/[id]/page.tsx` |
| MODIFICAR | `admin-panel/app/(auth)/dashboard/page.tsx` |
| MODIFICAR | `admin-panel/app/(auth)/prices/page.tsx` |

---

## Task 1: Migración Alembic 002

**Files:**
- Create: `api/alembic/versions/002_add_sold_fields.py`

- [ ] **Step 1: Crear el fichero de migración**

```python
# Migración 002 — añade sold_date y sold_price a products; soft-delete de condición USED
"""add sold fields and remove USED condition

Revision ID: 002
Revises: 001
Create Date: 2026-04-01
"""
from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Nuevas columnas de venta
    op.add_column("products", sa.Column("sold_date", sa.Date(), nullable=True))
    op.add_column("products", sa.Column("sold_price", sa.Numeric(10, 2), nullable=True))

    # Soft-delete de productos con condición USED (eliminación de datos según spec)
    op.execute(
        "UPDATE products SET deleted_at = NOW() "
        "WHERE condition = 'USED' AND deleted_at IS NULL"
    )


def downgrade() -> None:
    op.drop_column("products", "sold_price")
    op.drop_column("products", "sold_date")
    # Nota: no se revierten los soft-deletes de USED
```

- [ ] **Step 2: Verificar que Alembic reconoce la migración**

```bash
cd api && alembic history
```
Esperado: aparece `002 -> (head) add sold fields and remove USED condition`

- [ ] **Step 3: Aplicar la migración**

```bash
alembic upgrade head
```
Esperado: `Running upgrade 001 -> 002` sin errores.

- [ ] **Step 4: Commit**

```bash
git add api/alembic/versions/002_add_sold_fields.py
git commit -m "feat(db): add sold_date/sold_price columns; soft-delete USED products"
```

---

## Task 2: Modelo SQLAlchemy — sold_date + sold_price

**Files:**
- Modify: `api/app/models/product.py`

- [ ] **Step 1: Añadir columnas al modelo**

Reemplaza el bloque de columnas en `api/app/models/product.py` con:

```python
# Modelo Product — núcleo del inventario LEGO
import uuid
from datetime import datetime

from sqlalchemy import Column, Date, Integer, Numeric, String, Text, TIMESTAMP
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.base import Base


class Product(Base):
    """Artículo de inventario LEGO con todos sus metadatos de compra, estado y venta."""

    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    set_number = Column(String(20))
    name = Column(String(255), nullable=False)
    theme = Column(String(100))
    year_released = Column(Integer)
    condition = Column(String(20), nullable=True)
    condition_notes = Column(Text)
    purchase_price = Column(Numeric(10, 2))
    purchase_date = Column(Date)
    purchase_source = Column(String(255))
    quantity = Column(Integer, default=1)
    images = Column(JSONB, default=list)
    notes = Column(Text)
    availability = Column(String(20), nullable=False, default="available")
    sold_date = Column(Date, nullable=True)
    sold_price = Column(Numeric(10, 2), nullable=True)
    deleted_at = Column(TIMESTAMP, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())

    market_prices = relationship("MarketPrice", back_populates="product", cascade="all, delete-orphan")
    price_alerts = relationship("PriceAlert", back_populates="product", cascade="all, delete-orphan")
```

- [ ] **Step 2: Verificar que el servidor arranca sin errores**

```bash
cd api && uvicorn app.main:app --port 8011 --reload
# En otra terminal:
curl http://localhost:8011/health
```
Esperado: `{"status":"ok"}` o similar.

- [ ] **Step 3: Commit**

```bash
git add api/app/models/product.py
git commit -m "feat(model): add sold_date and sold_price columns to Product"
```

---

## Task 3: Schemas Pydantic — sold fields + RealProfitSummary

**Files:**
- Modify: `api/app/schemas/product.py`
- Modify: `api/app/schemas/price.py`

- [ ] **Step 1: Actualizar `api/app/schemas/product.py`**

```python
# Schemas Pydantic para validación y serialización de Product
from datetime import date, datetime
from decimal import Decimal
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.price import MarketPriceOut


ConditionType = Literal["SEALED", "OPEN_COMPLETE", "OPEN_INCOMPLETE"]
QuickConditionType = Literal["SEALED", "OPEN_COMPLETE", "OPEN_INCOMPLETE"]
AvailabilityType = Literal["available", "sold"]


class ProductBase(BaseModel):
    set_number: Optional[str] = Field(None, max_length=20)
    name: str = Field(..., max_length=255)
    theme: Optional[str] = Field(None, max_length=100)
    year_released: Optional[int] = None
    condition: Optional[ConditionType] = None
    condition_notes: Optional[str] = None
    purchase_price: Optional[Decimal] = None
    purchase_date: Optional[date] = None
    purchase_source: Optional[str] = None
    quantity: int = 1
    images: List[str] = []
    notes: Optional[str] = None
    availability: AvailabilityType = "available"
    sold_date: Optional[date] = None
    sold_price: Optional[Decimal] = None


class ProductCreate(ProductBase):
    pass


class ProductUpdate(ProductBase):
    name: Optional[str] = None
    quantity: Optional[int] = None
    availability: Optional[AvailabilityType] = None


class ProductOut(ProductBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None
    latest_market_price: Optional[MarketPriceOut] = None

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
    condition: QuickConditionType
    purchase_price: Decimal = Field(..., gt=0)
    purchase_date: date
    purchase_source: str = Field(..., min_length=1, max_length=255)
    quantity: int = Field(1, ge=1)
    notes: Optional[str] = None


class ProductListOut(BaseModel):
    items: List[ProductOut]
    total: int
    page: int
    size: int
    pages: int
```

- [ ] **Step 2: Añadir `RealProfitSummary` en `api/app/schemas/price.py`**

Añade al final del fichero (antes del último salto de línea):

```python
class RealProfitSummary(BaseModel):
    """Métricas de beneficios reales de productos ya vendidos."""
    total_sold_items: int
    total_sold_revenue: Decimal
    total_real_profit: Decimal
    avg_profit_per_item: Decimal
```

- [ ] **Step 3: Commit**

```bash
git add api/app/schemas/product.py api/app/schemas/price.py
git commit -m "feat(schemas): add sold fields to Product; add RealProfitSummary schema"
```

---

## Task 4: Price Service — filtrar available + beneficios reales

**Files:**
- Modify: `api/app/services/price_service.py`

Los cambios son:
1. `select_price_by_condition` / `_select_market_price`: eliminar "USED" del check de condición.
2. `get_summary`: filtrar solo `availability='available'`.
3. `get_top_margin`: filtrar solo `availability='available'`.
4. `get_price_insights`: filtrar solo `availability='available'`.
5. Nuevo método `get_real_profit_summary`.

- [ ] **Step 1: Actualizar `select_price_by_condition` en `PriceService`**

Localiza el método (línea ~35) y reemplázalo:

```python
    def select_price_by_condition(
        self,
        condition: Optional[str],
        price_new: Optional[Decimal],
        price_used: Optional[Decimal],
    ) -> Optional[Decimal]:
        """Selecciona el precio de mercado real según condición del producto."""
        if condition == "SEALED":
            return price_new or price_used
        if condition in ("OPEN_COMPLETE", "OPEN_INCOMPLETE"):
            return price_used or price_new
        return price_used or price_new
```

- [ ] **Step 2: Actualizar `_select_market_price` en `DashboardService`**

Localiza el método (línea ~321) y reemplázalo:

```python
    def _select_market_price(
        self,
        condition: Optional[str],
        price_new: Optional[Decimal],
        price_used: Optional[Decimal],
    ) -> Optional[Decimal]:
        if condition == "SEALED":
            return price_new or price_used
        if condition in ("OPEN_COMPLETE", "OPEN_INCOMPLETE"):
            return price_used or price_new
        return price_used or price_new
```

- [ ] **Step 3: Actualizar `get_summary` para filtrar solo disponibles**

Reemplaza el método `get_summary` (línea ~452):

```python
    def get_summary(self, db: Session) -> DashboardSummary:
        # Solo artículos disponibles para el resumen del stock actual
        products = db.query(Product).filter(
            Product.deleted_at.is_(None),
            Product.availability == "available",
        ).all()

        total_items = sum(p.quantity for p in products)
        total_purchase = sum(
            (p.purchase_price or Decimal("0")) * p.quantity for p in products
        )

        total_market = Decimal("0")
        for p in products:
            latest = (
                db.query(MarketPrice)
                .filter(MarketPrice.product_id == p.id)
                .order_by(MarketPrice.fetched_at.desc())
                .first()
            )
            if latest:
                market_price = self._select_market_price(p.condition, latest.price_new, latest.price_used) or Decimal("0")
                total_market += market_price * p.quantity

        potential_margin = total_market - total_purchase
        avg_margin_pct = (
            float((potential_margin / total_purchase) * 100) if total_purchase else 0.0
        )

        return DashboardSummary(
            total_items=total_items,
            total_purchase_value=total_purchase,
            total_market_value=total_market,
            potential_margin=potential_margin,
            avg_margin_pct=round(avg_margin_pct, 2),
        )
```

- [ ] **Step 4: Actualizar `get_top_margin` para filtrar solo disponibles**

Reemplaza la primera línea de consulta en `get_top_margin`:

```python
    def get_top_margin(self, db: Session, limit: int = 10) -> List[TopMarginProduct]:
        products = db.query(Product).filter(
            Product.deleted_at.is_(None),
            Product.availability == "available",
        ).all()
        # resto del método sin cambios
```

- [ ] **Step 5: Actualizar `get_price_insights` para filtrar solo disponibles**

Reemplaza la consulta inicial en `get_price_insights`:

```python
    def get_price_insights(self, db: Session, limit: int = 200) -> List[PriceInsightProduct]:
        """Calcula métricas por set disponible y ordena por beneficio absoluto en euros."""
        products = (
            db.query(Product)
            .filter(
                Product.deleted_at.is_(None),
                Product.availability == "available",
            )
            .order_by(Product.created_at.desc())
            .limit(limit)
            .all()
        )
        # resto del método sin cambios
```

- [ ] **Step 6: Añadir método `get_real_profit_summary` a `DashboardService`**

Añade este método después de `get_price_insights`, antes de `get_price_trends`:

```python
    def get_real_profit_summary(self, db: Session) -> "RealProfitSummary":
        """Calcula beneficios reales de todos los productos vendidos."""
        from app.schemas.price import RealProfitSummary

        sold = db.query(Product).filter(
            Product.deleted_at.is_(None),
            Product.availability == "sold",
            Product.sold_price.isnot(None),
        ).all()

        if not sold:
            return RealProfitSummary(
                total_sold_items=0,
                total_sold_revenue=Decimal("0"),
                total_real_profit=Decimal("0"),
                avg_profit_per_item=Decimal("0"),
            )

        total_items = sum(p.quantity for p in sold)
        total_revenue = sum(
            Decimal(str(p.sold_price)) * p.quantity for p in sold
        ).quantize(Decimal("0.01"))
        total_profit = sum(
            (Decimal(str(p.sold_price)) - Decimal(str(p.purchase_price or 0))) * p.quantity
            for p in sold
        ).quantize(Decimal("0.01"))
        avg = (total_profit / Decimal(str(total_items))).quantize(Decimal("0.01")) if total_items else Decimal("0")

        return RealProfitSummary(
            total_sold_items=total_items,
            total_sold_revenue=total_revenue,
            total_real_profit=total_profit,
            avg_profit_per_item=avg,
        )
```

- [ ] **Step 7: Commit**

```bash
git add api/app/services/price_service.py
git commit -m "feat(service): filter available products in KPIs; add real profit summary"
```

---

## Task 5: Router Dashboard — endpoint /real-profits

**Files:**
- Modify: `api/app/routers/dashboard.py`

- [ ] **Step 1: Añadir el import y el endpoint**

Añade el import de `RealProfitSummary` en la sección de imports del router:

```python
from app.schemas.price import (
    DashboardSummary,
    PriceDetailTrendPoint,
    PriceInsightProduct,
    PriceTrendPoint,
    RealProfitSummary,
    TopMarginProduct,
)
```

Añade el endpoint al final del fichero (antes de `scraper_router`):

```python
@router.get("/real-profits", response_model=RealProfitSummary)
def get_real_profits(db: Session = Depends(get_db), _: str = Depends(get_current_user)):
    """Beneficios reales de productos vendidos (sold_price - purchase_price)."""
    return dashboard_service.get_real_profit_summary(db)
```

- [ ] **Step 2: Verificar el endpoint con curl**

```bash
curl -H "Authorization: Bearer <token>" http://localhost:8011/dashboard/real-profits
```
Esperado: JSON con `total_sold_items`, `total_sold_revenue`, `total_real_profit`, `avg_profit_per_item`.

- [ ] **Step 3: Commit**

```bash
git add api/app/routers/dashboard.py
git commit -m "feat(router): add /dashboard/real-profits endpoint"
```

---

## Task 6: Scraper Runner — omitir productos vendidos

**Files:**
- Modify: `api/app/scraper/runner.py`

- [ ] **Step 1: Añadir filtro de availability en `scrape_all_products`**

Reemplaza la consulta de productos en `scrape_all_products`:

```python
def scrape_all_products() -> None:
    """Scraping completo — itera productos disponibles. Llamado por APScheduler."""
    db = SessionLocal()
    try:
        products = db.query(Product).filter(
            Product.deleted_at.is_(None),
            Product.set_number.isnot(None),
            Product.availability == "available",  # no scrapar sets ya vendidos
        ).all()
        logger.info(f"Iniciando scraping para {len(products)} productos disponibles")

        async def run():
            for product in products:
                await _run_scrapers_for_product(db, product)
                price_service.check_alerts(db, product.id)

        asyncio.run(run())
        logger.info("Scraping completo finalizado")
    finally:
        db.close()
```

- [ ] **Step 2: Commit**

```bash
git add api/app/scraper/runner.py
git commit -m "fix(scraper): skip sold products during automated price refresh"
```

---

## Task 7: Frontend — Types + api-client + utils

**Files:**
- Modify: `admin-panel/types/index.ts`
- Modify: `admin-panel/lib/api-client.ts`
- Modify: `admin-panel/lib/utils.ts`

- [ ] **Step 1: Actualizar `admin-panel/types/index.ts`**

```typescript
// Interfaces TypeScript del dominio LegoMarkal — espejo de los schemas Pydantic del backend

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenOut {
  access_token: string;
  token_type: string;
}

// ── Productos ─────────────────────────────────────────────────────────────────

export type Condition = "SEALED" | "OPEN_COMPLETE" | "OPEN_INCOMPLETE";
export type Availability = "available" | "sold";

export interface Product {
  id: string;
  set_number: string | null;
  name: string;
  theme: string | null;
  year_released: number | null;
  condition: Condition | null;
  condition_notes: string | null;
  purchase_price: number | null;
  purchase_date: string | null;
  purchase_source: string | null;
  quantity: number;
  images: string[];
  notes: string | null;
  availability: Availability;
  sold_date: string | null;
  sold_price: number | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  latest_market_price?: MarketPrice | null;
}

export interface ProductCreate {
  set_number?: string;
  name: string;
  theme?: string;
  year_released?: number;
  condition?: Condition;
  condition_notes?: string;
  purchase_price?: number;
  purchase_date?: string | null;
  purchase_source?: string | null;
  quantity?: number;
  images?: string[];
  notes?: string | null;
  availability?: Availability;
  sold_date?: string | null;
  sold_price?: number | null;
}

export interface ProductQuickCreate {
  set_number: string;
  condition: "SEALED" | "OPEN_COMPLETE" | "OPEN_INCOMPLETE";
  purchase_price: number;
  purchase_date?: string | null;
  purchase_source?: string | null;
  quantity?: number;
  notes?: string | null;
}

export type ProductUpdate = Partial<ProductCreate>;

export interface ProductListOut {
  items: Product[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface ProductFilters {
  search?: string;
  theme?: string;
  condition?: Condition;
  availability?: Availability;
  page?: number;
  size?: number;
}

// ── Precios de mercado ────────────────────────────────────────────────────────

export type PriceSource = "bricklink" | "brickeconomy" | "ebay";

export interface MarketPrice {
  id: string;
  product_id: string;
  source: PriceSource;
  price_new: number | null;
  price_used: number | null;
  min_price: number | null;
  max_price: number | null;
  currency: string;
  fetched_at: string;
}

// ── Alertas de precio ─────────────────────────────────────────────────────────

export type AlertType = "PRICE_ABOVE" | "PRICE_BELOW" | "PRICE_CHANGE_PCT";

export interface PriceAlert {
  id: string;
  product_id: string;
  alert_type: AlertType;
  threshold_value: number;
  is_active: boolean;
  last_triggered: string | null;
  created_at: string;
  product?: Product;
}

export interface PriceAlertCreate {
  product_id: string;
  alert_type: AlertType;
  threshold_value: number;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardSummary {
  total_items: number;
  total_purchase_value: number;
  total_market_value: number;
  potential_margin: number;
  avg_margin_pct: number;
}

export interface RealProfitSummary {
  total_sold_items: number;
  total_sold_revenue: number;
  total_real_profit: number;
  avg_profit_per_item: number;
}

export interface TopMarginProduct {
  id: string;
  name: string;
  set_number: string | null;
  purchase_price: number | null;
  market_value: number | null;
  margin_pct: number | null;
}

export interface PriceTrendPoint {
  date: string;
  invested_value: number;
  market_value: number;
  profit_value: number;
}

export interface PriceDetailTrendPoint {
  date: string;
  min_price: number;
  avg_price: number;
  max_price: number;
}

export interface PriceInsightProduct {
  id: string;
  name: string;
  set_number: string | null;
  condition: Condition | null;
  purchase_price: number | null;
  current_market_price: number | null;
  min_market_price: number | null;
  max_market_price: number | null;
  avg_market_price: number | null;
  profit_eur: number | null;
}

export interface ProductPriceHistoryPoint {
  date: string;
  price_new: number | null;
  price_used: number | null;
}

export interface ProductPriceHistory {
  product_id: string;
  condition: Condition | null;
  guide_type: string;
  points: ProductPriceHistoryPoint[];
}

// ── Importación masiva ────────────────────────────────────────────────────────

export interface ImportResult {
  created: number;
  errors: Array<{ row: number; message: string }>;
}
```

- [ ] **Step 2: Añadir `realProfits()` en `admin-panel/lib/api-client.ts`**

En el objeto `dashboardApi`, añade al final:

```typescript
  realProfits: () => request<RealProfitSummary>("/dashboard/real-profits"),
```

Y añade `RealProfitSummary` al import de tipos al inicio del fichero.

- [ ] **Step 3: Actualizar `admin-panel/lib/utils.ts`**

```typescript
// Utilidades de formato y helpers generales del panel LegoMarkal
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Condition } from "@/types";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatPct(value: number | null | undefined): string {
  if (value == null) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-ES");
}

/** Etiqueta legible para el estado de condición del producto */
export function conditionLabel(condition: string | null | undefined): string {
  const labels: Record<string, string> = {
    SEALED: "Sellado",
    OPEN_COMPLETE: "Completo",
    OPEN_INCOMPLETE: "Incompleto",
  };
  return condition && labels[condition] ? labels[condition] : condition ?? "—";
}

export function calcMarginPct(
  purchasePrice: number | null,
  marketPrice: number | null
): number | null {
  if (!purchasePrice || !marketPrice || purchasePrice === 0) return null;
  return ((marketPrice - purchasePrice) / purchasePrice) * 100;
}
```

- [ ] **Step 4: Verificar que TypeScript compila**

```bash
cd admin-panel && npx tsc --noEmit
```
Esperado: sin errores.

- [ ] **Step 5: Commit**

```bash
git add admin-panel/types/index.ts admin-panel/lib/api-client.ts admin-panel/lib/utils.ts
git commit -m "feat(frontend): update types, api-client and utils for sold fields; remove USED"
```

---

## Task 8: Nuevo componente SellModal

**Files:**
- Create: `admin-panel/components/ui/SellModal.tsx`

- [ ] **Step 1: Crear el componente**

```typescript
// Modal de confirmación de venta — captura precio real y fecha de venta
"use client";
import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { formatCurrency } from "@/lib/utils";

interface SellModalProps {
  open: boolean;
  productName: string;
  /** Precio sugerido: último precio de mercado conocido */
  suggestedPrice: number | null;
  onConfirm: (soldPrice: number, soldDate: string) => Promise<void>;
  onCancel: () => void;
}

export function SellModal({
  open,
  productName,
  suggestedPrice,
  onConfirm,
  onCancel,
}: SellModalProps) {
  const today = new Date().toISOString().split("T")[0];
  const [soldPrice, setSoldPrice] = useState<string>("");
  const [soldDate, setSoldDate] = useState<string>(today);
  const [loading, setLoading] = useState(false);

  // Resetea los valores cada vez que se abre el modal
  useEffect(() => {
    if (open) {
      setSoldPrice(suggestedPrice != null ? String(suggestedPrice) : "");
      setSoldDate(today);
    }
  }, [open, suggestedPrice, today]);

  async function handleConfirm() {
    if (!soldPrice || !soldDate) return;
    setLoading(true);
    try {
      await onConfirm(Number(soldPrice), soldDate);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onCancel} title="Registrar venta">
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Introduce el precio real al que vendiste{" "}
          <span className="font-medium text-text-primary">{productName}</span>.
        </p>
        {suggestedPrice != null && (
          <p className="text-xs text-text-muted">
            Último precio de mercado conocido:{" "}
            <span className="font-medium">{formatCurrency(suggestedPrice)}</span>
          </p>
        )}
        <Input
          label="Precio de venta real (€)"
          type="number"
          step="0.01"
          min="0"
          value={soldPrice}
          onChange={(e) => setSoldPrice(e.target.value)}
        />
        <Input
          label="Fecha de venta"
          type="date"
          value={soldDate}
          onChange={(e) => setSoldDate(e.target.value)}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            loading={loading}
            disabled={!soldPrice || !soldDate}
          >
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
git add admin-panel/components/ui/SellModal.tsx
git commit -m "feat(ui): add SellModal component for capturing sold_price and sold_date"
```

---

## Task 9: FilterBar + ProductForm — etiquetas de condición

**Files:**
- Modify: `admin-panel/components/inventory/FilterBar.tsx`
- Modify: `admin-panel/components/product/ProductForm.tsx`

- [ ] **Step 1: Actualizar `FilterBar.tsx`**

Reemplaza el array `CONDITIONS`:

```typescript
const CONDITIONS: { value: Condition; label: string }[] = [
  { value: "SEALED", label: "Sellado" },
  { value: "OPEN_COMPLETE", label: "Completo" },
  { value: "OPEN_INCOMPLETE", label: "Incompleto" },
];
```

- [ ] **Step 2: Actualizar `ProductForm.tsx`**

Reemplaza el esquema zod de `condition`:

```typescript
  condition: z
    .enum(["SEALED", "OPEN_COMPLETE", "OPEN_INCOMPLETE"])
    .optional(),
```

Reemplaza el selector de condición en el JSX:

```tsx
          <select className={selectClass} {...register("condition")}>
            <option value="">Seleccionar…</option>
            <option value="SEALED">Sellado</option>
            <option value="OPEN_COMPLETE">Completo</option>
            <option value="OPEN_INCOMPLETE">Incompleto</option>
          </select>
```

- [ ] **Step 3: Commit**

```bash
git add admin-panel/components/inventory/FilterBar.tsx admin-panel/components/product/ProductForm.tsx
git commit -m "feat(ui): rename condition labels; remove USED option from all selectors"
```

---

## Task 10: InventoryTable — SellModal, sold_price, filas tenues

**Files:**
- Modify: `admin-panel/components/inventory/InventoryTable.tsx`

- [ ] **Step 1: Reemplazar el fichero completo**

```typescript
// Tabla densa de inventario con paginación server-side y navegación a ficha
"use client";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SellModal } from "@/components/ui/SellModal";
import {
  formatCurrency,
  formatPct,
  conditionLabel,
  calcMarginPct,
} from "@/lib/utils";
import type { Product, ProductListOut } from "@/types";

interface InventoryTableProps {
  data: ProductListOut;
  onPageChange: (page: number) => void;
  onToggleAvailability?: (
    productId: string,
    currentAvailability: "available" | "sold",
    soldPrice?: number,
    soldDate?: string
  ) => Promise<void>;
}

function marginBadge(pct: number | null) {
  if (pct === null) return <span className="text-text-muted">—</span>;
  const variant = pct >= 20 ? "success" : pct >= 0 ? "warning" : "error";
  return <Badge variant={variant}>{formatPct(pct)}</Badge>;
}

export function InventoryTable({ data, onPageChange, onToggleAvailability }: InventoryTableProps) {
  const router = useRouter();
  const { items, total, page, size, pages } = data;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  // Estado del modal de venta
  const [sellTarget, setSellTarget] = useState<Product | null>(null);

  function resolveImageUrl(url: string) {
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return new URL(url, apiUrl).toString();
  }

  function openProductDetail(productId: string) {
    router.push(`/inventory/${productId}`);
  }

  async function handleSellConfirm(soldPrice: number, soldDate: string) {
    if (!sellTarget) return;
    await onToggleAvailability?.(sellTarget.id, "available", soldPrice, soldDate);
    setSellTarget(null);
  }

  function handleAvailabilityClick(e: React.MouseEvent, product: Product) {
    e.stopPropagation();
    if (product.availability === "available") {
      // Abrir modal para capturar precio y fecha de venta
      setSellTarget(product);
    } else {
      // Devolver a disponible directamente (sin modal)
      onToggleAvailability?.(product.id, "sold");
    }
  }

  return (
    <>
      <div className="flex flex-col">
        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-elevated text-left text-xs text-text-muted uppercase tracking-wider">
                <th className="px-4 py-3">Set ID</th>
                <th className="px-4 py-3">Imagen</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Tema</th>
                <th className="px-4 py-3">Condición</th>
                <th className="px-4 py-3 text-right">Compra</th>
                <th className="px-4 py-3 text-right">Precio ref.</th>
                <th className="px-4 py-3 text-right">Margen</th>
                <th className="px-4 py-3">Disponibilidad</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-text-muted">
                    Sin productos que coincidan con los filtros.
                  </td>
                </tr>
              )}
              {items.map((product: Product) => {
                const isSold = product.availability === "sold";

                // Para vendidos: mostrar sold_price. Para disponibles: último precio de mercado.
                const refPrice = isSold
                  ? product.sold_price
                  : (product.latest_market_price?.price_new ??
                     product.latest_market_price?.price_used ??
                     null);

                const marginPct = calcMarginPct(product.purchase_price, refPrice);

                return (
                  <tr
                    key={product.id}
                    className={`cursor-pointer transition-colors hover:bg-bg-elevated/50 ${
                      isSold ? "opacity-55" : ""
                    }`}
                    onClick={() => openProductDetail(product.id)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                      {product.set_number ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {product.images?.[0] ? (
                        <div className="relative h-10 w-10 overflow-hidden rounded-md border border-border">
                          <Image
                            src={resolveImageUrl(product.images[0])}
                            alt={product.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-text-primary max-w-48 truncate">
                      {product.name}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {product.theme ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="neutral">{conditionLabel(product.condition)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary">
                      {formatCurrency(product.purchase_price)}
                    </td>
                    <td className="px-4 py-3 text-right text-text-primary">
                      <span className={isSold ? "text-text-muted text-xs" : ""}>
                        {isSold && product.sold_price != null ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="rounded bg-bg-elevated px-1.5 py-0.5 text-xs text-text-muted">venta</span>
                            {formatCurrency(product.sold_price)}
                          </span>
                        ) : (
                          formatCurrency(refPrice)
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {marginBadge(marginPct)}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant={isSold ? "danger" : "secondary"}
                        size="sm"
                        className={
                          isSold
                            ? "h-8"
                            : "h-8 border-status-success/30 text-status-success bg-status-success/10 hover:bg-status-success/20"
                        }
                        onClick={(e) => handleAvailabilityClick(e, product)}
                      >
                        {isSold ? "Vendido" : "Disponible"}
                      </Button>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/inventory/${product.id}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-4 w-4 text-text-muted hover:text-accent-lego transition-colors" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <p className="text-xs text-text-muted">
            {total === 0
              ? "Sin resultados"
              : `${(page - 1) * size + 1}–${Math.min(page * size, total)} de ${total}`}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-text-secondary">{page} / {pages || 1}</span>
            <Button variant="ghost" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= pages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Modal de venta */}
      <SellModal
        open={sellTarget !== null}
        productName={sellTarget?.name ?? ""}
        suggestedPrice={
          sellTarget?.latest_market_price?.price_new ??
          sellTarget?.latest_market_price?.price_used ??
          null
        }
        onConfirm={handleSellConfirm}
        onCancel={() => setSellTarget(null)}
      />
    </>
  );
}
```

- [ ] **Step 2: Actualizar `inventory/page.tsx` — cambiar firma de `handleToggleAvailability`**

En `admin-panel/app/(auth)/inventory/page.tsx`, reemplaza la función `handleToggleAvailability`:

```typescript
  async function handleToggleAvailability(
    productId: string,
    currentAvailability: "available" | "sold",
    soldPrice?: number,
    soldDate?: string
  ) {
    const nextAvailability = currentAvailability === "available" ? "sold" : "available";
    await productsApi.update(productId, {
      availability: nextAvailability,
      sold_price: nextAvailability === "sold" ? soldPrice ?? null : null,
      sold_date: nextAvailability === "sold" ? soldDate ?? null : null,
    });
    await load(filters);
  }
```

- [ ] **Step 3: Commit**

```bash
git add admin-panel/components/inventory/InventoryTable.tsx admin-panel/app/\(auth\)/inventory/page.tsx
git commit -m "feat(inventory): integrate SellModal; show sold_price; dim sold rows; remove nav spinner"
```

---

## Task 11: Skeleton loading para ficha de producto

**Files:**
- Create: `admin-panel/app/(auth)/inventory/[id]/loading.tsx`

- [ ] **Step 1: Crear el skeleton**

```typescript
// Skeleton de carga de la ficha de producto — renderizado por Next.js 14 durante navegación
export default function ProductDetailLoading() {
  return (
    <div className="flex flex-col animate-pulse">
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-border px-6">
        <div className="space-y-2">
          <div className="h-5 w-52 rounded-md bg-bg-elevated" />
          <div className="h-3 w-28 rounded-md bg-bg-elevated" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-8 rounded-lg bg-bg-elevated" />
          <div className="h-8 w-36 rounded-lg bg-bg-elevated" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Columna izquierda */}
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-xl border border-border bg-bg-card p-5 space-y-5">
              <div className="flex items-center justify-between">
                <div className="h-4 w-20 rounded bg-bg-elevated" />
                <div className="flex gap-2">
                  <div className="h-6 w-16 rounded-full bg-bg-elevated" />
                  <div className="h-6 w-20 rounded-full bg-bg-elevated" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="h-3 w-16 rounded bg-bg-elevated" />
                    <div className="h-4 w-24 rounded bg-bg-elevated" />
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-bg-card p-5">
              <div className="h-4 w-44 rounded bg-bg-elevated mb-4" />
              <div className="h-56 rounded-lg bg-bg-elevated" />
            </div>
          </div>

          {/* Columna derecha */}
          <div className="space-y-6">
            <div className="rounded-xl border border-border bg-bg-card p-5">
              <div className="h-4 w-20 rounded bg-bg-elevated mb-3" />
              <div className="h-32 rounded-lg bg-bg-elevated" />
            </div>
            <div className="rounded-xl border border-border bg-bg-card p-5">
              <div className="h-4 w-36 rounded bg-bg-elevated mb-3" />
              <div className="h-8 w-32 rounded bg-bg-elevated mb-2" />
              <div className="h-12 rounded-lg bg-bg-elevated" />
            </div>
            <div className="rounded-xl border border-border bg-bg-card p-5">
              <div className="h-4 w-28 rounded bg-bg-elevated mb-3" />
              <div className="h-20 rounded-lg bg-bg-elevated" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "admin-panel/app/(auth)/inventory/[id]/loading.tsx"
git commit -m "feat(ux): add product detail skeleton — replaces inline row spinner"
```

---

## Task 12: PriceHistory — marcador de venta

**Files:**
- Modify: `admin-panel/components/product/PriceHistory.tsx`

- [ ] **Step 1: Actualizar el componente**

```typescript
// Gráfico de evolución de precios de un producto con marcador de fecha de venta
"use client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { MarketPrice } from "@/types";

interface PriceHistoryProps {
  prices: MarketPrice[];
  soldDate?: string | null;
  soldPrice?: number | null;
}

const SOURCE_COLORS: Record<string, string> = {
  bricklink: "#F59E0B",
  brickeconomy: "#3B82F6",
  ebay: "#10B981",
};

export function PriceHistory({ prices, soldDate, soldPrice }: PriceHistoryProps) {
  const sources = Array.from(new Set(prices.map((p) => p.source)));
  const byDate = prices.reduce<Record<string, Record<string, number>>>(
    (acc, p) => {
      const date = p.fetched_at.split("T")[0];
      acc[date] = acc[date] ?? {};
      acc[date][p.source] = p.price_new ?? p.price_used ?? 0;
      return acc;
    },
    {}
  );

  const chartData = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({ date, ...values }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-text-muted">
        Sin historial de precios disponible.
      </div>
    );
  }

  // Determina la posición X del marcador de venta: fecha ISO truncada a YYYY-MM-DD
  const soldDateKey = soldDate ? soldDate.split("T")[0] : null;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={chartData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2D" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          tick={{ fill: "#71717A", fontSize: 11 }}
          axisLine={{ stroke: "#2A2A2D" }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${v}€`}
          tick={{ fill: "#71717A", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={50}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#141416",
            border: "1px solid #2A2A2D",
            borderRadius: 8,
          }}
          labelStyle={{ color: "#A1A1AA", fontSize: 12 }}
          formatter={(value: number) => [formatCurrency(value), ""]}
          labelFormatter={formatDate}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          formatter={(value) => <span style={{ color: "#A1A1AA" }}>{value}</span>}
        />

        {sources.map((source) => (
          <Line
            key={source}
            type="monotone"
            dataKey={source}
            stroke={SOURCE_COLORS[source] ?? "#A1A1AA"}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}

        {/* Marcador de fecha de venta */}
        {soldDateKey && (
          <ReferenceLine
            x={soldDateKey}
            stroke="#F59E0B"
            strokeDasharray="4 4"
            strokeWidth={2}
            label={{
              value: soldPrice != null ? `Vendido ${formatCurrency(soldPrice)}` : "Vendido",
              position: "insideTopRight",
              fill: "#F59E0B",
              fontSize: 11,
            }}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add admin-panel/components/product/PriceHistory.tsx
git commit -m "feat(chart): add sold date reference line to PriceHistory component"
```

---

## Task 13: Ficha de producto — toggle unificado + campos vendido + alertas legibles

**Files:**
- Modify: `admin-panel/app/(auth)/inventory/[id]/page.tsx`

- [ ] **Step 1: Reemplazar el fichero completo**

```typescript
// Ficha de producto — galería, datos, historial de precios y alertas
"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Edit, Trash2, Tag, BellPlus } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RefreshPricesButton } from "@/components/ui/RefreshPricesButton";
import { Badge } from "@/components/ui/Badge";
import { SellModal } from "@/components/ui/SellModal";
import { PriceHistory } from "@/components/product/PriceHistory";
import { ImageUpload } from "@/components/product/ImageUpload";
import { productsApi, pricesApi, alertsApi } from "@/lib/api-client";
import {
  formatCurrency,
  formatDate,
  conditionLabel,
  calcMarginPct,
  formatPct,
} from "@/lib/utils";
import type { AlertType, Product, MarketPrice, PriceAlert } from "@/types";

const ALERT_LABELS: Record<AlertType, (threshold: number) => string> = {
  PRICE_BELOW: (t) => `Avisar si precio < ${formatCurrency(t)}`,
  PRICE_ABOVE: (t) => `Avisar si precio > ${formatCurrency(t)}`,
  PRICE_CHANGE_PCT: (t) => `Avisar si cambio > ${t}%`,
};

interface Props {
  params: { id: string };
}

export default function ProductDetailPage({ params }: Props) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [scraping, setScraping] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [creatingAlert, setCreatingAlert] = useState(false);
  const [alertType, setAlertType] = useState<AlertType>("PRICE_BELOW");
  const [alertThreshold, setAlertThreshold] = useState<string>("");
  const [sellModalOpen, setSellModalOpen] = useState(false);

  const load = useCallback(async () => {
    const [p, pr, al] = await Promise.all([
      productsApi.get(params.id),
      pricesApi.history(params.id),
      alertsApi.list(),
    ]);
    setProduct(p);
    setPrices(pr);
    setAlerts(al.filter((a) => a.product_id === params.id));
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  async function handleScrape() {
    setScraping(true);
    try {
      await pricesApi.scrape(params.id);
      await load();
    } finally {
      setScraping(false);
    }
  }

  async function handleDelete() {
    if (!confirm("¿Eliminar este producto? Esta acción no se puede deshacer fácilmente.")) return;
    setDeleting(true);
    try {
      await productsApi.delete(params.id);
      router.push("/inventory");
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggleAvailability() {
    if (!product) return;
    if (product.availability === "available") {
      // Abrir modal para capturar precio y fecha de venta
      setSellModalOpen(true);
    } else {
      // Volver a disponible: limpiar sold fields
      const updated = await productsApi.update(params.id, {
        availability: "available",
        sold_price: null,
        sold_date: null,
      });
      setProduct(updated);
    }
  }

  async function handleSellConfirm(soldPrice: number, soldDate: string) {
    if (!product) return;
    const updated = await productsApi.update(params.id, {
      availability: "sold",
      sold_price: soldPrice,
      sold_date: soldDate,
    });
    setProduct(updated);
    setSellModalOpen(false);
  }

  async function handleCreateAlert() {
    if (!alertThreshold) return;
    setCreatingAlert(true);
    try {
      await alertsApi.create({
        product_id: params.id,
        alert_type: alertType,
        threshold_value: Number(alertThreshold),
      });
      setAlertThreshold("");
      await load();
    } finally {
      setCreatingAlert(false);
    }
  }

  if (!product) return null; // loading.tsx lo cubre

  const isSold = product.availability === "sold";
  const latestPrice = prices.find((p) => p.source === "bricklink") ?? prices[0] ?? null;

  // Para vendidos: usar sold_price como precio de referencia
  const refPrice = isSold
    ? product.sold_price
    : (latestPrice?.price_new ?? latestPrice?.price_used ?? null);

  const marginPct = calcMarginPct(product.purchase_price, refPrice);

  return (
    <div className="flex flex-col">
      <Header
        title={product.name}
        description={product.set_number ? `Set ${product.set_number}` : undefined}
        actions={
          <div className="flex gap-2">
            <Link href="/inventory">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            {!isSold && <RefreshPricesButton loading={scraping} onClick={handleScrape} />}
          </div>
        }
      />

      <div className="flex-1 space-y-6 p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Columna izquierda */}
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Detalles</CardTitle>
                {/* Acciones y toggle unificados en el header */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={isSold ? "error" : "success"}>
                    <Tag className="mr-1 h-3 w-3" />
                    {isSold ? "Vendido" : "Disponible"}
                  </Badge>
                  {product.condition && (
                    <Badge variant="neutral">{conditionLabel(product.condition)}</Badge>
                  )}
                  <button
                    type="button"
                    onClick={handleToggleAvailability}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      isSold ? "bg-status-error" : "bg-status-success"
                    }`}
                    title={isSold ? "Marcar como disponible" : "Marcar como vendido"}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        isSold ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                  <Link href={`/inventory/${params.id}/edit`}>
                    <Button variant="secondary" size="sm">
                      <Edit className="h-4 w-4" />
                      Editar
                    </Button>
                  </Link>
                  <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </Button>
                </div>
              </CardHeader>

              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
                {[
                  { label: "Tema", value: product.theme },
                  { label: "Año", value: product.year_released },
                  { label: "Cantidad", value: product.quantity },
                  { label: "Precio compra", value: formatCurrency(product.purchase_price) },
                  { label: "Fecha compra", value: formatDate(product.purchase_date) },
                  { label: "Fuente compra", value: product.purchase_source },
                  // Mostrar fecha vendido solo si está vendido; ocultar "Añadido" siempre
                  ...(isSold
                    ? [{ label: "Fecha vendido", value: formatDate(product.sold_date) }]
                    : []),
                ].map(({ label, value }) => (
                  <div key={label}>
                    <dt className="text-text-muted">{label}</dt>
                    <dd className="mt-0.5 text-text-primary">{value ?? "—"}</dd>
                  </div>
                ))}
              </dl>

              {product.notes && (
                <div className="mt-4 border-t border-border pt-4">
                  <p className="text-sm text-text-secondary">{product.notes}</p>
                </div>
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Historial de precios de mercado</CardTitle>
              </CardHeader>
              <PriceHistory
                prices={prices}
                soldDate={product.sold_date}
                soldPrice={product.sold_price}
              />
            </Card>
          </div>

          {/* Columna derecha */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Imágenes</CardTitle>
              </CardHeader>
              <ImageUpload
                productId={product.id}
                images={product.images}
                onUpdate={(imgs) => setProduct({ ...product, images: imgs })}
              />
            </Card>

            <Card>
              <CardTitle className="mb-4">
                {isSold ? "Precio de venta" : "Precio de mercado"}
              </CardTitle>
              <div className="space-y-3">
                {refPrice != null ? (
                  <>
                    <div>
                      <p className="text-3xl font-bold text-text-primary">
                        {formatCurrency(refPrice)}
                      </p>
                      {!isSold && latestPrice && (
                        <p className="mt-1 text-xs text-text-muted">
                          Fuente: {latestPrice.source} — {formatDate(latestPrice.fetched_at)}
                        </p>
                      )}
                      {isSold && product.sold_date && (
                        <p className="mt-1 text-xs text-text-muted">
                          Vendido el {formatDate(product.sold_date)}
                        </p>
                      )}
                    </div>
                    {marginPct !== null && (
                      <div className="rounded-lg bg-bg-elevated px-3 py-2">
                        <p className="text-xs text-text-muted">
                          {isSold ? "Beneficio real" : "Margen potencial"}
                        </p>
                        <p
                          className={`text-lg font-semibold ${
                            marginPct >= 0 ? "text-status-success" : "text-status-error"
                          }`}
                        >
                          {formatPct(marginPct)}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-text-muted">
                    {isSold ? "Precio de venta no registrado." : "Sin datos de mercado todavía."}
                  </p>
                )}
              </div>
            </Card>

            <Card>
              <CardTitle className="mb-4">Alertas ({alerts.length})</CardTitle>
              {!isSold && (
                <div className="mb-4 space-y-2 rounded-lg border border-border bg-bg-elevated p-3">
                  <p className="text-xs font-medium text-text-secondary">Crear alerta rápida</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <select
                      value={alertType}
                      onChange={(e) => setAlertType(e.target.value as AlertType)}
                      className="rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary"
                    >
                      <option value="PRICE_BELOW">Precio por debajo de</option>
                      <option value="PRICE_ABOVE">Precio por encima de</option>
                      <option value="PRICE_CHANGE_PCT">Cambio de precio (%)</option>
                    </select>
                    <input
                      type="number"
                      value={alertThreshold}
                      onChange={(e) => setAlertThreshold(e.target.value)}
                      placeholder={alertType === "PRICE_CHANGE_PCT" ? "Umbral %" : "Umbral €"}
                      className="rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCreateAlert}
                      loading={creatingAlert}
                      disabled={!alertThreshold}
                    >
                      <BellPlus className="h-4 w-4" />
                      Añadir
                    </Button>
                  </div>
                </div>
              )}
              {alerts.length === 0 ? (
                <p className="text-sm text-text-muted">Sin alertas configuradas.</p>
              ) : (
                <ul className="space-y-2">
                  {alerts.map((alert) => (
                    <li
                      key={alert.id}
                      className="flex items-center justify-between rounded-lg bg-bg-elevated px-3 py-2 text-sm"
                    >
                      <span className="text-text-secondary">
                        {ALERT_LABELS[alert.alert_type]?.(alert.threshold_value) ?? alert.alert_type}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>

      <SellModal
        open={sellModalOpen}
        productName={product.name}
        suggestedPrice={
          latestPrice?.price_new ?? latestPrice?.price_used ?? null
        }
        onConfirm={handleSellConfirm}
        onCancel={() => setSellModalOpen(false)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "admin-panel/app/(auth)/inventory/[id]/page.tsx"
git commit -m "feat(product-detail): unified toggle, sold fields, sell modal, readable alert labels"
```

---

## Task 14: Dashboard — sección Beneficios Reales

**Files:**
- Modify: `admin-panel/app/(auth)/dashboard/page.tsx`

- [ ] **Step 1: Actualizar el fichero**

```typescript
// Página Dashboard — KPIs, gráfico de tendencias, beneficios reales y top por margen
"use client";
import { useEffect, useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { PriceChart } from "@/components/dashboard/PriceChart";
import { AlertFeed } from "@/components/dashboard/AlertFeed";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RefreshPricesButton } from "@/components/ui/RefreshPricesButton";
import { dashboardApi, alertsApi } from "@/lib/api-client";
import { formatCurrency, formatPct } from "@/lib/utils";
import type {
  DashboardSummary,
  TopMarginProduct,
  PriceTrendPoint,
  PriceAlert,
  RealProfitSummary,
} from "@/types";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [realProfits, setRealProfits] = useState<RealProfitSummary | null>(null);
  const [topMargin, setTopMargin] = useState<TopMarginProduct[]>([]);
  const [trends, setTrends] = useState<PriceTrendPoint[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, rp, t, tr, al] = await Promise.all([
        dashboardApi.summary(),
        dashboardApi.realProfits(),
        dashboardApi.topMargin(),
        dashboardApi.priceTrends(),
        alertsApi.list(),
      ]);
      setSummary(s);
      setRealProfits(rp);
      setTopMargin(t);
      setTrends(tr);
      setAlerts(al);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleTriggerScraper() {
    setScraping(true);
    try {
      await dashboardApi.triggerScraper();
      await load();
    } finally {
      setScraping(false);
    }
  }

  return (
    <div className="flex flex-col">
      <Header
        title="Dashboard"
        description="Resumen de inventario y mercado"
        actions={
          <RefreshPricesButton loading={scraping} onClick={handleTriggerScraper} />
        }
      />

      <div className="flex-1 space-y-6 p-6">
        {loading && (
          <div className="rounded-lg border border-accent-lego/30 bg-accent-lego/10 px-4 py-3 text-sm text-accent-lego">
            Cargando métricas y tendencias del dashboard…
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
            {error}
          </div>
        )}

        {/* KPIs — cartera disponible */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            title="Artículos en stock"
            value={loading ? "…" : String(summary?.total_items ?? 0)}
          />
          <KpiCard
            title="Valor de compra"
            value={loading ? "…" : formatCurrency(summary?.total_purchase_value ?? 0)}
          />
          <KpiCard
            title="Valor de mercado"
            value={loading ? "…" : formatCurrency(summary?.total_market_value ?? 0)}
          />
          <KpiCard
            title="Margen potencial"
            value={loading ? "…" : formatCurrency(summary?.potential_margin ?? 0)}
            delta={summary?.avg_margin_pct ?? null}
          />
        </div>

        {/* Beneficios reales — solo si hay productos vendidos */}
        {!loading && realProfits != null && realProfits.total_sold_items > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-text-secondary uppercase tracking-wider">
              Beneficios reales
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <KpiCard
                title="Sets vendidos"
                value={String(realProfits.total_sold_items)}
              />
              <KpiCard
                title="Recaudado"
                value={formatCurrency(realProfits.total_sold_revenue)}
              />
              <KpiCard
                title="Ganancia neta"
                value={formatCurrency(realProfits.total_real_profit)}
                delta={
                  realProfits.total_sold_revenue > 0
                    ? (realProfits.total_real_profit / realProfits.total_sold_revenue) * 100
                    : null
                }
              />
            </div>
          </div>
        )}

        {/* Gráfico + Top margen */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Evolución: dinero invertido vs valor de mercado</CardTitle>
              <Button variant="ghost" size="sm" onClick={load}>
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </CardHeader>
            <PriceChart data={trends} />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top 5 por margen</CardTitle>
            </CardHeader>
            {topMargin.length === 0 ? (
              <p className="text-sm text-text-muted">Sin datos disponibles.</p>
            ) : (
              <ol className="space-y-3">
                {topMargin.slice(0, 5).map((p, i) => (
                  <li key={p.id} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-text-muted w-4">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm text-text-primary">{p.name}</p>
                      <p className="text-xs text-text-muted">{p.set_number ?? "—"}</p>
                    </div>
                    <span className="text-sm font-semibold text-status-success">
                      {formatPct(p.margin_pct)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        {/* Alertas */}
        <Card>
          <CardHeader>
            <CardTitle>Alertas activas ({alerts.filter((a) => a.is_active).length})</CardTitle>
          </CardHeader>
          <AlertFeed alerts={alerts.filter((a) => a.is_active)} />
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "admin-panel/app/(auth)/dashboard/page.tsx"
git commit -m "feat(dashboard): add real profits section; KPIs now filter available products only"
```

---

## Task 15: Página de Precios — filtrar disponibles + rediseño visual de tabla

**Files:**
- Modify: `admin-panel/app/(auth)/prices/page.tsx`

- [ ] **Step 1: Reemplazar el fichero completo**

El rediseño visual incluye:
- Filas coloreadas por rentabilidad (verde/ámbar/rojo sutil)
- Set ID como chip monoespaciado con fondo
- Columna condición con badges de color específico por tipo
- Columna beneficio con barra de progreso proporcional al máximo del listado
- Leyenda en español ("Nuevo"/"Usado")

```typescript
// Página de precios — solo productos disponibles, con rediseño visual de tabla
"use client";
import { useEffect, useState, useCallback } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RefreshPricesButton } from "@/components/ui/RefreshPricesButton";
import { dashboardApi, pricesApi, productsApi } from "@/lib/api-client";
import { conditionLabel, formatCurrency, formatDate } from "@/lib/utils";
import type { Condition, PriceInsightProduct, PriceTrendPoint, ProductPriceHistoryPoint } from "@/types";

// Clase de fondo de fila según rentabilidad
function rowBgClass(profitEur: number | null, purchasePrice: number | null): string {
  if (profitEur === null || purchasePrice === null || purchasePrice === 0) return "";
  const pct = (profitEur / purchasePrice) * 100;
  if (pct >= 20) return "bg-emerald-500/10";
  if (pct >= 5)  return "bg-emerald-500/5";
  if (pct >= 0)  return "bg-amber-500/5";
  return "bg-red-500/5";
}

// Badge de condición con colores distintos
const CONDITION_CHIP: Record<string, string> = {
  SEALED:         "bg-amber-500/15 text-amber-400 border border-amber-500/25",
  OPEN_COMPLETE:  "bg-blue-500/15 text-blue-400 border border-blue-500/25",
  OPEN_INCOMPLETE:"bg-purple-500/15 text-purple-400 border border-purple-500/25",
};

function ConditionBadge({ condition }: { condition: Condition | null }) {
  if (!condition) return <span className="text-text-muted text-xs">—</span>;
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${CONDITION_CHIP[condition] ?? "bg-bg-elevated text-text-muted"}`}>
      {conditionLabel(condition)}
    </span>
  );
}

export default function PricesPage() {
  const [insights, setInsights] = useState<PriceInsightProduct[]>([]);
  const [globalTrends, setGlobalTrends] = useState<PriceTrendPoint[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedProductName, setSelectedProductName] = useState<string>("");
  const [selectedCondition, setSelectedCondition] = useState<Condition | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<ProductPriceHistoryPoint[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingAll, setRefreshingAll] = useState(false);

  const loadFallback = useCallback(async () => {
    const [products, trends] = await Promise.all([
      productsApi.list({ size: 200, availability: "available" }),
      dashboardApi.priceTrends(),
    ]);

    const fallbackInsights: PriceInsightProduct[] = products.items
      .map((product) => {
        const currentPrice =
          product.latest_market_price?.price_new ??
          product.latest_market_price?.price_used ??
          null;
        const purchasePrice = product.purchase_price ?? null;
        const profit =
          currentPrice !== null && purchasePrice !== null
            ? Number((currentPrice - purchasePrice).toFixed(2))
            : null;

        return {
          id: product.id,
          name: product.name,
          set_number: product.set_number,
          condition: product.condition,
          purchase_price: purchasePrice,
          current_market_price: currentPrice,
          min_market_price: null,
          max_market_price: null,
          avg_market_price: currentPrice,
          profit_eur: profit,
        };
      })
      .sort((a, b) => (b.profit_eur ?? -999999) - (a.profit_eur ?? -999999));

    setInsights(fallbackInsights);
    setGlobalTrends(trends);
    setErrorMsg(null);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextInsights, nextTrends] = await Promise.all([
        dashboardApi.priceInsights(),
        dashboardApi.priceTrends(),
      ]);
      setInsights(nextInsights);
      setGlobalTrends(nextTrends);
      setErrorMsg(null);
    } catch {
      try {
        await loadFallback();
      } catch (fallbackError) {
        const message =
          fallbackError instanceof Error
            ? fallbackError.message
            : "No se pudieron cargar los datos de precios";
        setErrorMsg(message);
        setInsights([]);
        setGlobalTrends([]);
      }
    } finally {
      setLoading(false);
    }
  }, [loadFallback]);

  useEffect(() => { load(); }, [load]);

  async function handleRefreshAllPrices() {
    setRefreshingAll(true);
    try {
      await dashboardApi.triggerScraper();
      await load();
    } finally {
      setRefreshingAll(false);
    }
  }

  async function handleSelectProduct(product: PriceInsightProduct) {
    setSelectedProductId(product.id);
    setSelectedProductName(product.name);
    setSelectedCondition(product.condition);
    try {
      const trend = await pricesApi.trend(product.id, 6, "sold");
      setSelectedHistory(trend.points);
    } catch {
      setSelectedHistory([]);
    }
  }

  const sortedGlobalTrends = [...globalTrends].sort((a, b) => a.date.localeCompare(b.date));
  const sortedSelectedHistory = [...selectedHistory].sort((a, b) => a.date.localeCompare(b.date));
  const highlightNew = selectedCondition === "SEALED";

  const yMaxGlobal = sortedGlobalTrends.reduce((max, point) => {
    return Math.max(max, Number(point.invested_value ?? 0), Number(point.market_value ?? 0));
  }, 0);
  const yMaxSelected = sortedSelectedHistory.reduce((max, point) => {
    return Math.max(max, Number(point.price_new ?? 0), Number(point.price_used ?? 0));
  }, 0);
  const currentMax = selectedProductId ? yMaxSelected : yMaxGlobal;
  const yMax = currentMax > 0 ? Math.ceil(currentMax * 1.08) : 100;

  // Para la barra de beneficio proporcional
  const maxAbsProfit = insights.reduce((m, p) => Math.max(m, Math.abs(p.profit_eur ?? 0)), 1);

  return (
    <div className="flex flex-col">
      <Header
        title="Precios de mercado"
        description="Solo artículos disponibles · Fuente: BrickLink"
        actions={
          <RefreshPricesButton loading={refreshingAll} onClick={handleRefreshAllPrices} />
        }
      />

      <div className="flex-1 p-6">
        {loading ? (
          <div className="space-y-4 py-2">
            <div className="h-12 animate-pulse rounded-xl border border-border bg-bg-card" />
            <div className="h-72 animate-pulse rounded-xl border border-border bg-bg-card" />
            <div className="h-96 animate-pulse rounded-xl border border-border bg-bg-card" />
          </div>
        ) : (
          <div className="space-y-6">
            {errorMsg && (
              <Card>
                <p className="text-sm text-status-error">{errorMsg}</p>
              </Card>
            )}

            {/* Gráfica */}
            <Card>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    {selectedProductId
                      ? `Histórico 6 meses · ${selectedProductName}`
                      : "Tendencia global de cartera"}
                  </h3>
                  <p className="text-xs text-text-muted">
                    {selectedProductId
                      ? `Guide type: sold · Línea destacada según estado (${conditionLabel(selectedCondition)})`
                      : "Invertido y valor de mercado del stock disponible"}
                  </p>
                </div>
                {selectedProductId && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setSelectedProductId(null);
                      setSelectedProductName("");
                      setSelectedCondition(null);
                      setSelectedHistory([]);
                    }}
                  >
                    Ver gráfica global
                  </Button>
                )}
              </div>

              {!selectedProductId && sortedGlobalTrends.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-muted">Sin datos suficientes.</p>
              ) : selectedProductId && sortedSelectedHistory.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-muted">Sin histórico disponible para este producto.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart
                    data={selectedProductId ? sortedSelectedHistory : sortedGlobalTrends}
                    margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2D" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => formatDate(v)}
                      tick={{ fill: "#71717A", fontSize: 11 }}
                      axisLine={{ stroke: "#2A2A2D" }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, yMax]}
                      tickFormatter={(v) => `${v}€`}
                      tick={{ fill: "#71717A", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label) => formatDate(label)}
                    />
                    <Legend />

                    {selectedProductId ? (
                      <>
                        <Line
                          type="monotone"
                          dataKey="price_new"
                          name="Nuevo"
                          stroke="#F59E0B"
                          strokeWidth={highlightNew ? 3 : 1.5}
                          strokeDasharray={highlightNew ? "0" : "4 4"}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="price_used"
                          name="Usado"
                          stroke="#3B82F6"
                          strokeWidth={highlightNew ? 1.5 : 3}
                          strokeDasharray={highlightNew ? "4 4" : "0"}
                          dot={false}
                        />
                      </>
                    ) : (
                      <>
                        <Line type="monotone" dataKey="invested_value" name="Invertido" stroke="#F59E0B" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="market_value" name="Valor de mercado" stroke="#3B82F6" strokeWidth={2} dot={false} />
                      </>
                    )}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>

            {/* Tabla con rediseño visual */}
            <Card padded={false}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-gradient-to-r from-bg-elevated to-bg-card text-left text-xs text-text-muted uppercase tracking-wider">
                    <th className="px-4 py-3 w-28">Set ID</th>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Condición</th>
                    <th className="px-4 py-3 text-right">Compra</th>
                    <th className="px-4 py-3 text-right">Actual</th>
                    <th className="px-4 py-3 text-right">Mínimo</th>
                    <th className="px-4 py-3 text-right">Máximo</th>
                    <th className="px-4 py-3 w-52">Beneficio €</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {insights.map((p) => {
                    const isPositive = (p.profit_eur ?? 0) >= 0;
                    const barWidth =
                      p.profit_eur != null
                        ? Math.round((Math.abs(p.profit_eur) / maxAbsProfit) * 100)
                        : 0;
                    const isSelected = selectedProductId === p.id;

                    return (
                      <tr
                        key={p.id}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-accent-lego/10"
                            : rowBgClass(p.profit_eur, p.purchase_price)
                        } hover:brightness-110`}
                        onClick={() => handleSelectProduct(p)}
                      >
                        {/* Set ID chip */}
                        <td className="px-4 py-3">
                          <span className="inline-block rounded-md bg-bg-elevated px-2 py-0.5 font-mono text-xs text-text-secondary border border-border">
                            {p.set_number ?? "—"}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-text-primary max-w-48 truncate font-medium">
                          {p.name}
                        </td>

                        {/* Condition badge con color */}
                        <td className="px-4 py-3">
                          <ConditionBadge condition={p.condition} />
                        </td>

                        <td className="px-4 py-3 text-right text-text-secondary">
                          {formatCurrency(p.purchase_price)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-text-primary">
                          {formatCurrency(p.current_market_price)}
                        </td>
                        <td className="px-4 py-3 text-right text-text-muted text-xs">
                          {formatCurrency(p.min_market_price)}
                        </td>
                        <td className="px-4 py-3 text-right text-text-muted text-xs">
                          {formatCurrency(p.max_market_price)}
                        </td>

                        {/* Beneficio con barra proporcional */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-bg-elevated overflow-hidden min-w-12">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  isPositive ? "bg-status-success" : "bg-status-error"
                                }`}
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                            <span
                              className={`text-sm font-semibold tabular-nums ${
                                isPositive ? "text-status-success" : "text-status-error"
                              }`}
                            >
                              {formatCurrency(p.profit_eur)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {insights.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-text-muted">
                        Sin productos disponibles en inventario.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "admin-panel/app/(auth)/prices/page.tsx"
git commit -m "feat(prices): filter available only; visual table redesign with profit bars and condition colors"
```

---

## Task 16: Fase de revisión visual post-implementación

Una vez que todas las tareas anteriores estén implementadas y la aplicación esté arrancada:

- [ ] **Step 1: Arrancar la aplicación**

```bash
cd scripts && ./restart-dev.ps1
# o manualmente:
cd api && uvicorn app.main:app --port 8011 --reload &
cd admin-panel && NEXT_PUBLIC_API_URL=http://localhost:8011 npm run dev
```

- [ ] **Step 2: Tomar capturas de las pantallas principales**

Usa una herramienta de captura (navegador, `screenshot` de Playwright/Puppeteer, o `screencapture` del SO) y guarda capturas de:
1. `/dashboard` — con y sin sección de beneficios reales
2. `/inventory` — con filas disponibles y vendidas
3. `/inventory/[id]` de un producto disponible
4. `/inventory/[id]` de un producto vendido
5. `/prices` — tabla con barras de beneficio y badges de condición

- [ ] **Step 3: Análisis crítico de cada captura**

Para cada pantalla, evaluar:
- **Jerarquía visual**: ¿El ojo va al dato más importante primero?
- **Legibilidad**: ¿Los textos y números son fáciles de leer?
- **Densidad**: ¿Hay información redundante o falta algo clave?
- **Coherencia**: ¿Los colores, tamaños y espaciados son consistentes?
- **Contraste**: ¿Los elementos interactivos son visualmente identificables?

- [ ] **Step 4: Proponer e implementar mejoras derivadas del análisis**

Documentar las mejoras identificadas y aplicarlas directamente. Commitar cada mejora por separado.

- [ ] **Step 5: Verificación final**

```bash
npx tsc --noEmit          # sin errores TypeScript
npm run build             # build de producción limpio
```

- [ ] **Step 6: Actualizar README_CONTEXT.md**

Actualizar `.Claude/README_CONTEXT.md` con los nuevos ficheros creados y los cambios más relevantes.

- [ ] **Step 7: Commit final**

```bash
git add .Claude/README_CONTEXT.md
git commit -m "docs: update context after UI/UX improvements v2"
```

---

---

## Amendments — Problemas adicionales detectados

Las siguientes correcciones se aplican **sobre las tareas ya descritas**. Los subagentes deben incorporarlas al ejecutar cada tarea afectada.

---

### Amendment A: condition_notes — eliminación completa

**Motivo:** La columna `condition_notes` nunca se rellena desde la UI ni se consume en ninguna vista. Es deuda estructural.

**Impacto en Task 1 (migración 002):** Añadir al `upgrade()`:
```python
op.drop_column("products", "condition_notes")
```
Y al `downgrade()`:
```python
op.add_column("products", sa.Column("condition_notes", sa.Text(), nullable=True))
```

**Impacto en Task 2 (model):** Eliminar la línea `condition_notes = Column(Text)` del modelo.

**Impacto en Task 3 (schemas):** Eliminar `condition_notes: Optional[str] = None` de `ProductBase`.

**Impacto en Task 9 (ProductForm):** Eliminar el bloque del textarea "Notas de condición":
```tsx
{/* ELIMINAR este bloque completo: */}
<div className="flex flex-col gap-1.5">
  <label className="text-sm text-text-secondary">Notas de condición</label>
  <textarea rows={2} ... {...register("condition_notes")} />
</div>
```
Y eliminar `condition_notes` del schema Zod y del objeto `defaultValues`.

---

### Amendment B: portfolio_daily_snapshots — análisis y decisión

**Decisión: CONSERVAR** la tabla. Justificación:
- Sin ella, `get_price_trends()` requeriría un join O(n·m) (N productos × M días) en cada petición del gráfico.
- Los snapshots históricos son semánticamente correctos: registran el valor real de la cartera en cada día, incluyendo productos que luego se vendieron.

**Bug a corregir (Task 4):** `_compute_current_totals()` no filtra `availability='available'`, por lo que el snapshot de HOY (`_upsert_today_snapshot`) incluye productos vendidos, inflando el valor de mercado actual en el gráfico.

**Corrección en `_compute_current_totals()`:**
```python
def _compute_current_totals(self, db: Session) -> tuple[Decimal, Decimal, Decimal]:
    """Recalcula el total actual solo de productos disponibles en cartera."""
    products = db.query(Product).filter(
        Product.deleted_at.is_(None),
        Product.availability == "available",  # AÑADIR ESTE FILTRO
    ).all()
    # resto del método sin cambios
```

---

### Amendment C: PriceHistory — gráfico simplificado + Y-axis correcto

**Motivo:** El gráfico actual muestra una línea por fuente (bricklink/brickeconomy/ebay) cuando en realidad la fuente oficial es BrickLink y solo importa el precio relevante para la condición del set. Los campos `source` y `currency` son ruido en la visualización.

**Bug Y-axis:** El dominio vertical no cubre picos intermedios porque se mezclan valores `null` sustituidos por `0` en la agregación (`price_new ?? price_used ?? 0`). Si un punto tiene ambos nulls, introduce un `0` que estrecha el dominio visual sin representar dato real.

**Cambio completo en Task 12 (PriceHistory):** Reemplaza la implementación anterior del Task 12 con esta:

```typescript
// Gráfico de evolución del precio relevante según condición del producto
"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";
import { formatDate, formatCurrency, conditionLabel } from "@/lib/utils";
import type { MarketPrice } from "@/types";

interface PriceHistoryProps {
  prices: MarketPrice[];
  condition?: string | null;
  soldDate?: string | null;
  soldPrice?: number | null;
}

/** Selecciona el precio adecuado según condición, sin sustituir nulls por 0 */
function selectPrice(
  condition: string | null | undefined,
  priceNew: number | null,
  priceUsed: number | null
): number | null {
  if (condition === "SEALED") return priceNew ?? priceUsed ?? null;
  if (condition === "OPEN_COMPLETE" || condition === "OPEN_INCOMPLETE")
    return priceUsed ?? priceNew ?? null;
  return priceUsed ?? priceNew ?? null;
}

export function PriceHistory({ prices, condition, soldDate, soldPrice }: PriceHistoryProps) {
  // Agrega por fecha usando solo el precio relevante para la condición
  const byDate: Record<string, number | null> = {};
  for (const p of prices) {
    const date = p.fetched_at.split("T")[0];
    const val = selectPrice(condition, p.price_new, p.price_used);
    if (val !== null) byDate[date] = val; // solo sobrescribe si tiene dato real
  }

  const chartData = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, price]) => ({ date, price }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-text-muted">
        Sin historial de precios disponible.
      </div>
    );
  }

  // Dominio Y: max real de todos los puntos con un 10% de margen superior
  const maxVal = chartData.reduce((m, d) => Math.max(m, d.price ?? 0), 0);
  const yMax = maxVal > 0 ? Math.ceil(maxVal * 1.1) : 100;

  const soldDateKey = soldDate ? soldDate.split("T")[0] : null;
  const lineLabel = condition ? conditionLabel(condition) : "Precio";

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={chartData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2D" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          tick={{ fill: "#71717A", fontSize: 11 }}
          axisLine={{ stroke: "#2A2A2D" }}
          tickLine={false}
        />
        <YAxis
          domain={[0, yMax]}
          tickFormatter={(v) => `${v}€`}
          tick={{ fill: "#71717A", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={55}
        />
        <Tooltip
          contentStyle={{ backgroundColor: "#141416", border: "1px solid #2A2A2D", borderRadius: 8 }}
          labelStyle={{ color: "#A1A1AA", fontSize: 12 }}
          formatter={(value: number) => [formatCurrency(value), lineLabel]}
          labelFormatter={formatDate}
        />
        <Line
          type="monotone"
          dataKey="price"
          name={lineLabel}
          stroke="#F59E0B"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          connectNulls={false}
        />
        {soldDateKey && (
          <ReferenceLine
            x={soldDateKey}
            stroke="#F59E0B"
            strokeDasharray="4 4"
            strokeWidth={2}
            label={{
              value: soldPrice != null ? `Vendido ${formatCurrency(soldPrice)}` : "Vendido",
              position: "insideTopRight",
              fill: "#F59E0B",
              fontSize: 11,
            }}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
```

**Cambio en Task 13 (product detail):** Añadir la prop `condition` al uso del componente `<PriceHistory>`:
```tsx
<PriceHistory
  prices={prices}
  condition={product.condition}
  soldDate={product.sold_date}
  soldPrice={product.sold_price}
/>
```

---

### Amendment D: Otros problemas de interfaz detectados

| # | Pantalla | Problema | Corrección |
|---|---|---|---|
| D1 | Edit product page | Estado "Cargando…" plain text sin skeleton | Añadir `loading.tsx` a `[id]/edit/` igual que en `[id]/` |
| D2 | Inventario — edit page | `ProductForm` tiene `availability` como selector (puede cambiar estado sin modal) | Eliminar el selector `availability` del `ProductForm` — el estado de venta siempre va por el modal |
| D3 | Dashboard | `_compute_current_totals` incluye vendidos en snapshot diario (cubierto en Amendment B) | Ver Amendment B |
| D4 | PriceHistory | Tooltip muestra nombre de fuente (bricklink) en vez de etiqueta legible | Cubierto en Amendment C |

**D1 — loading.tsx para edit page:** Crear `admin-panel/app/(auth)/inventory/[id]/edit/loading.tsx`:

```typescript
// Skeleton de carga para el formulario de edición de producto
export default function EditProductLoading() {
  return (
    <div className="flex flex-col animate-pulse">
      <div className="flex h-16 items-center justify-between border-b border-border px-6">
        <div className="space-y-2">
          <div className="h-5 w-36 rounded-md bg-bg-elevated" />
          <div className="h-3 w-48 rounded-md bg-bg-elevated" />
        </div>
        <div className="h-8 w-24 rounded-lg bg-bg-elevated" />
      </div>
      <div className="flex-1 p-6">
        <div className="max-w-3xl rounded-xl border border-border bg-bg-card p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 w-24 rounded bg-bg-elevated" />
                <div className="h-9 rounded-lg bg-bg-elevated" />
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-28 rounded bg-bg-elevated" />
            <div className="h-16 rounded-lg bg-bg-elevated" />
          </div>
          <div className="h-9 w-32 rounded-lg bg-bg-elevated" />
        </div>
      </div>
    </div>
  );
}
```

**D2 — Eliminar selector `availability` de ProductForm:** El estado de disponibilidad solo debe cambiarse mediante el toggle/modal, no desde el formulario de edición general. En `ProductForm.tsx`, eliminar el bloque:
```tsx
{/* ELIMINAR: */}
<div className="flex flex-col gap-1.5">
  <label className="text-sm text-text-secondary">Disponibilidad</label>
  <select className={selectClass} {...register("availability")}>
    <option value="available">Disponible</option>
    <option value="sold">Vendido</option>
  </select>
</div>
```
Y del schema Zod eliminar `availability: z.enum(["available", "sold"]).default("available")` y del tipo `ProductFormData`.

---

## Self-review — cobertura del spec

| Sección spec | Tarea del plan |
|---|---|
| §1 Condition labels (Completo/Incompleto/USED eliminado) | Task 3 (schema), Task 7 (types/utils), Task 9 (FilterBar/ProductForm) |
| §2.1 Backend sold_date + sold_price | Task 1 (migración), Task 2 (modelo), Task 3 (schemas) |
| §2.3 SellModal | Task 8 |
| §2.4 Tabla: sold_price en columna Mercado, opacity sold rows | Task 10 |
| §2.5 Toggle unificado en CardHeader, sold_date en ficha | Task 13 |
| §3 PriceHistory con ReferenceLine de venta | Task 12 |
| §4 /dashboard/real-profits + sección en dashboard | Task 4 (service), Task 5 (router), Task 14 (página) |
| §5 Skeleton loading / eliminar spinner inline | Task 11 |
| §6 F1 Toggle duplicado | Task 13 |
| §6 F2 Alertas ilegibles | Task 13 |
| §6 F3 Sold products en página precios | Task 4 (service filter), Task 15 |
| §6 F4 KPI incluye vendidos | Task 4 (get_summary filter) |
| §6 F5 Leyenda New/Used en inglés | Task 15 |
| Scraper omite vendidos | Task 6 |
| Precios tabla visual facelift | Task 15 |
| Revisión visual post-implementación | Task 16 |
