# Spec: Corrección de fechas futuras + Recibos PDF de venta

**Fecha**: 2026-04-12  
**Estado**: Aprobado

---

## 1. Problema 1 — Contaminación por fechas futuras en `market_prices`

### Causa raíz

Los checks de fecha futura en `_parse_price_guide` y `save_monthly_history_points` previenen
inserción de nuevas filas futuras, pero **no limpian filas ya existentes** (insertadas antes
de que los checks existieran). El `prune_missing_months` solo elimina filas con
`fetched_at < today`; filas con `fetched_at > today` (ej. 30/04) nunca se tocan.
Además, las queries de lectura no filtran fechas futuras, por lo que un registro fantasma
de 30/04 aparece como el dato "más reciente" y corrompe toda la UI.

### Correcciones

#### 1a. Limpieza inicial al arrancar (one-shot, `main.py`)

Antes de lanzar el auto-scrape de startup, ejecutar `clean_future_market_prices(db)`:
elimina todas las filas de `market_prices` con `fetched_at > today_spain`.
Se ejecuta siempre que el servidor arranca; es idempotente.

#### 1b. Prune de futuros en escritura (`price_service.py`)

En `save_monthly_history_points`, extender la fase `prune_missing_months` para borrar
también filas con `cast(fetched_at, Date) > today_spain`, además de las ya cubiertas
`< today_spain` fuera de `keep_dates`.

#### 1c. Filtro `<= today` en lectura (`price_service.py`)

Añadir `cast(MarketPrice.fetched_at, SADate) <= today_spain` a:
- `_latest_price_for_set` 
- Query de historial dentro de `get_price_insights`
- `get_price_detail_trends`

(`_bootstrap_daily_snapshots_from_market_history` ya lo tiene.)

---

## 2. Feature — PDFs de recibo al marcar como vendido

### Supabase Storage (configurado por el usuario)

- Bucket: `receipts` (privado)
- Acceso desde backend con **Service Role Key** (`SUPABASE_SERVICE_KEY` en `.env`)
- Las URLs de descarga son **signed URLs** con TTL de 1 hora, generadas en el momento
  de la petición de descarga (no al subir). Nunca se expone la URL pública permanente.

### Modelo de datos

Nuevo campo en `products`:

```sql
sale_receipts JSONB DEFAULT '[]'
```

Cada elemento del array:

```json
{
  "id": "<uuid>",
  "filename": "factura_ebay.pdf",
  "storage_path": "receipts/{product_id}/{uuid}_{filename}",
  "uploaded_at": "2026-04-12T10:00:00Z"
}
```

No se guarda la URL pública (es privada); la URL firmada se genera al descargar.

### Migración Alembic

Nueva revisión `002_add_sale_receipts.py`:
```python
op.add_column("products", sa.Column("sale_receipts", JSONB, nullable=True, server_default="[]"))
```

### Backend — nueva dependencia

Añadir `supabase` a `requirements.txt`. El cliente se inicializa con:
```python
from supabase import create_client
client = create_client(settings.supabase_url, settings.supabase_service_key)
```

### Backend — `StorageService` (nuevo, `services/storage_service.py`)

```
upload_receipt(product_id, file_bytes, filename, content_type) -> dict
  → sube a receipts/{product_id}/{uuid}_{filename}
  → devuelve { id, filename, storage_path, uploaded_at }

delete_receipt(storage_path) -> None
  → borra el objeto del bucket

get_signed_url(storage_path, expires_in=3600) -> str
  → genera URL firmada válida 1h
```

### Backend — endpoints nuevos en `routers/products.py`

```
POST   /products/{id}/sale-receipts
  Body: multipart/form-data, campo "files" (lista de UploadFile, solo PDF)
  → sube cada fichero, añade entrada a sale_receipts del producto
  → responde con el producto actualizado

DELETE /products/{id}/sale-receipts/{receipt_id}
  → busca receipt por id en sale_receipts, borra fichero en Supabase,
    elimina entrada del array, guarda
  → 204 No Content

GET    /products/{id}/sale-receipts/{receipt_id}/download
  → genera URL firmada (1h) y redirige (302) o devuelve { url }
```

### Backend — `config.py`

Añadir campo:
```python
supabase_service_key: str = ""
```

### Frontend — `SaleModal.tsx` (nuevo componente)

Modal que se abre al pulsar "Marcar como vendido":
- Campo fecha de venta (`sold_date`, date input)
- Campo precio de venta (`sold_price`, number input en EUR)
- Dropzone múltiple filtrado a `.pdf` (visual similar a `ImageUpload.tsx`)
- Botón "Confirmar venta":
  1. `PATCH /products/{id}` con `{ availability: "sold", sold_date, sold_price }`
  2. Si hay ficheros: `POST /products/{id}/sale-receipts` con los PDFs
  3. Refresca producto en UI

### Frontend — cambios en UI existente

- `InventoryTable.tsx`: el toggle de disponibilidad abre `SaleModal` en lugar de hacer
  PATCH directo cuando el destino es "sold". Para "available" (re-activar) sigue igual.
- `app/(auth)/inventory/[id]/page.tsx`: si `availability === "sold"`, mostrar bloque
  "Recibos de venta" con lista de recibos (icono PDF + nombre), botón descarga y
  botón borrado.
- `lib/api-client.ts`: añadir `uploadSaleReceipts(id, files)`,
  `deleteSaleReceipt(id, receiptId)`, `getSaleReceiptDownloadUrl(id, receiptId)`.

### Esquema de ficheros nuevos/modificados

```
api/
  app/
    config.py                        ← +supabase_service_key
    services/
      storage_service.py             ← NUEVO
    routers/
      products.py                    ← +sale-receipts endpoints
    schemas/
      product.py                     ← +sale_receipts field en schemas
  alembic/versions/
    002_add_sale_receipts.py         ← NUEVO
  requirements.txt                   ← +supabase

admin-panel/
  components/
    inventory/
      SaleModal.tsx                  ← NUEVO
    product/
      SaleReceiptList.tsx            ← NUEVO
  lib/
    api-client.ts                    ← +3 métodos
  app/(auth)/
    inventory/
      page.tsx                       ← toggle → SaleModal
      [id]/page.tsx                  ← +bloque recibos
```

---

## 3. Fuera de alcance

- Previsualización de PDF en el navegador (solo descarga)
- Notificaciones / emails de venta
- Migración de imágenes de producto a Supabase Storage (sería un proyecto separado)
