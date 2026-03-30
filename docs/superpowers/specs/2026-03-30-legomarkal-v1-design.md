# LegoMarkal V1 — MVP Design Spec
**Fecha:** 2026-03-30
**Estado:** Aprobado
**Alcance:** V1 únicamente — Inventario + Precios de mercado + Panel de gestión interno

---

## 1. Visión General

Sistema de gestión para un negocio de reventa de LEGO de coleccionista. La V1 entrega:
- Base de datos de inventario completa con modelo relacional robusto
- Scraper automático de precios de mercado (BrickLink, BrickEconomy, eBay)
- Panel de administración interno (solo el fundador) con dashboard KPI, listado de inventario, ficha de producto y formulario de alta/edición

El resultado es control total sobre el stock y su valor de mercado actualizado diariamente.

---

## 2. Arquitectura

### Enfoque: FastAPI + Supabase PostgreSQL + Next.js (API-first)

```
┌─────────────────────────────────┐
│   ADMIN PANEL (Next.js 14)       │  Puerto 3000
│   Dashboard / Inventario / etc.  │
└────────────────┬────────────────┘
                 │ HTTP REST (JSON)
┌────────────────▼────────────────┐
│   API CENTRAL (FastAPI Python)   │  Puerto 8000
│   Routers / Services / Scraper   │
│   APScheduler (tareas 3:00 AM)   │
└────────────────┬────────────────┘
                 │ SQLAlchemy (psycopg2)
┌────────────────▼────────────────┐
│   SUPABASE PostgreSQL            │
│   + Supabase Storage (imágenes)  │
└─────────────────────────────────┘
```

**Principio:** El frontend nunca toca la base de datos directamente. Todo pasa por la API. Supabase es infraestructura (no SDK en el frontend para V1).

### Decisiones clave
- **Auth V1:** Un único usuario administrador. Autenticación básica JWT en FastAPI (email+password). Sin NextAuth por ahora; el token se almacena en cookie httpOnly en el panel.
- **Scraper:** APScheduler integrado en el proceso FastAPI. Sin Redis/Celery en V1 (innecesario para volumen bajo). Upgradeable a Celery en V3/V4.
- **Imágenes:** Subida a Supabase Storage desde la API. Las URLs se guardan en `products.images` (JSONB).
- **ORM:** SQLAlchemy Core + Alembic para migraciones. No Prisma (el stack es Python).

---

## 3. Estructura del Repositorio

```
LegoMarkal/
├── api/                          # Backend FastAPI (Python 3.11+)
│   ├── app/
│   │   ├── models/               # Modelos SQLAlchemy
│   │   │   ├── __init__.py
│   │   │   ├── product.py        # Product, Category
│   │   │   ├── price.py          # MarketPrice, PriceAlert
│   │   │   └── base.py           # Base declarativa SQLAlchemy
│   │   ├── schemas/              # Pydantic schemas (request/response)
│   │   │   ├── product.py
│   │   │   └── price.py
│   │   ├── routers/              # Endpoints REST
│   │   │   ├── products.py
│   │   │   ├── categories.py
│   │   │   ├── prices.py
│   │   │   ├── alerts.py
│   │   │   ├── dashboard.py
│   │   │   └── auth.py
│   │   ├── services/             # Lógica de negocio desacoplada
│   │   │   ├── product_service.py
│   │   │   ├── price_service.py
│   │   │   └── import_service.py # Bulk import CSV/Excel
│   │   ├── scraper/              # Módulo de scraping
│   │   │   ├── base_scraper.py
│   │   │   ├── bricklink_scraper.py
│   │   │   ├── brickeconomy_scraper.py
│   │   │   └── ebay_scraper.py
│   │   ├── scheduler.py          # APScheduler — cron 3:00 AM
│   │   ├── database.py           # Engine SQLAlchemy → Supabase
│   │   ├── config.py             # Settings (Pydantic BaseSettings)
│   │   ├── auth.py               # JWT helpers
│   │   └── main.py               # FastAPI app entry point
│   ├── alembic/                  # Migraciones Alembic
│   │   └── versions/
│   ├── tests/
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
│
├── admin-panel/                  # Frontend Next.js 14 App Router
│   ├── app/
│   │   ├── (auth)/               # Rutas protegidas (layout con auth check)
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx      # Dashboard KPI + gráfico + alertas
│   │   │   ├── inventory/
│   │   │   │   ├── page.tsx      # Listado inventario (tabla densa)
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx  # Formulario alta producto
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx  # Ficha producto
│   │   │   │       └── edit/
│   │   │   │           └── page.tsx
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                   # Componentes base reutilizables
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Badge.tsx         # Status badges (Success/Warning/Error)
│   │   │   ├── Card.tsx
│   │   │   ├── Table.tsx         # Tabla base
│   │   │   └── Modal.tsx
│   │   ├── dashboard/
│   │   │   ├── KpiCard.tsx       # Tarjeta KPI con delta-indicator
│   │   │   ├── PriceChart.tsx    # Recharts línea de evolución precios
│   │   │   └── AlertFeed.tsx     # Feed de alertas activas
│   │   ├── inventory/
│   │   │   ├── InventoryTable.tsx # Tabla densa con filtros inline
│   │   │   ├── FilterBar.tsx
│   │   │   └── BulkImport.tsx    # Upload CSV/Excel
│   │   ├── product/
│   │   │   ├── ProductForm.tsx   # Formulario alta/edición
│   │   │   ├── PriceHistory.tsx  # Gráfico histórico del producto
│   │   │   └── ImageUpload.tsx
│   │   └── layout/
│   │       ├── Sidebar.tsx
│   │       └── Header.tsx
│   ├── lib/
│   │   ├── api-client.ts         # Wrapper fetch → FastAPI
│   │   ├── auth.ts               # Auth helpers (token storage)
│   │   └── utils.ts              # Formatters moneda, fecha, etc.
│   ├── types/
│   │   └── index.ts              # TypeScript interfaces
│   ├── brand-guidelines.md       # Guía de estilo completa LegoMarkal
│   ├── tailwind.config.ts
│   ├── next.config.ts
│   └── package.json
│
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-03-30-legomarkal-v1-design.md
│
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## 4. Base de Datos (Supabase PostgreSQL)

### Conexión
- **Host:** `db.vzsqbdrwevtmwlbtjnnv.supabase.co`
- **Puerto:** 5432
- **Database:** postgres
- **User:** postgres
- **Password:** (variable de entorno `DB_PASSWORD`)
- **Pooler (runtime):** `postgresql://postgres.vzsqbdrwevtmwlbtjnnv:[PWD]@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true`
- **Direct (migraciones):** `postgresql://postgres:[PWD]@db.vzsqbdrwevtmwlbtjnnv.supabase.co:5432/postgres`

### Schema — 4 tablas V1

#### `categories`
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
name          VARCHAR(100) NOT NULL UNIQUE
description   TEXT
created_at    TIMESTAMP DEFAULT now()
```
Seed inicial: `Set sellado`, `Set abierto`, `Minifigura`, `Pieza suelta`, `Lote`

#### `products`
```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
category_id      UUID REFERENCES categories(id)
set_number       VARCHAR(20)
name             VARCHAR(255) NOT NULL
theme            VARCHAR(100)
year_released    INTEGER
condition        VARCHAR(20) CHECK (condition IN ('SEALED','OPEN_COMPLETE','OPEN_INCOMPLETE','USED'))
condition_notes  TEXT
purchase_price   NUMERIC(10,2)
purchase_date    DATE
purchase_source  VARCHAR(255)
storage_location VARCHAR(100)
quantity         INTEGER DEFAULT 1
images           JSONB DEFAULT '[]'
notes            TEXT
is_listed        BOOLEAN DEFAULT false
deleted_at       TIMESTAMP  -- soft delete
created_at       TIMESTAMP DEFAULT now()
updated_at       TIMESTAMP DEFAULT now()
```

#### `market_prices`
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
product_id  UUID REFERENCES products(id)
source      VARCHAR(50) CHECK (source IN ('bricklink','brickeconomy','ebay'))
price_new   NUMERIC(10,2)
price_used  NUMERIC(10,2)
min_price   NUMERIC(10,2)
max_price   NUMERIC(10,2)
currency    VARCHAR(3) DEFAULT 'EUR'
fetched_at  TIMESTAMP DEFAULT now()
```

#### `price_alerts`
```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
product_id       UUID REFERENCES products(id)
alert_type       VARCHAR(20) CHECK (alert_type IN ('PRICE_ABOVE','PRICE_BELOW','PRICE_CHANGE_PCT'))
threshold_value  NUMERIC(10,2) NOT NULL
is_active        BOOLEAN DEFAULT true
last_triggered   TIMESTAMP
created_at       TIMESTAMP DEFAULT now()
```

---

## 5. API FastAPI — Endpoints V1

### Auth
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/auth/login` | Login → devuelve JWT |
| POST | `/auth/refresh` | Renovar token |

### Products
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/products` | Listado con filtros: `category`, `theme`, `condition`, `is_listed`, `search`, paginación `page`/`size` |
| POST | `/products` | Crear producto |
| GET | `/products/{id}` | Detalle + últimos precios de mercado |
| PUT | `/products/{id}` | Editar producto |
| DELETE | `/products/{id}` | Soft delete |
| POST | `/products/bulk-import` | Importar CSV/Excel (multipart) |
| GET | `/products/export` | Exportar CSV |

### Categories
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/categories` | Listar todas |
| POST | `/categories` | Crear categoría |

### Market Prices
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/market-prices/{product_id}` | Historial de precios de un producto |
| POST | `/market-prices/scrape/{product_id}` | Forzar scraping de un producto concreto |

### Price Alerts
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/price-alerts` | Alertas activas |
| POST | `/price-alerts` | Crear alerta |
| DELETE | `/price-alerts/{id}` | Eliminar alerta |

### Dashboard
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/dashboard/summary` | KPIs: total artículos, valor compra, valor mercado, margen potencial |
| GET | `/dashboard/top-margin` | Top 10 productos por margen |
| GET | `/dashboard/price-trends` | Datos para el gráfico de línea (por tema) |
| POST | `/scraper/trigger` | Forzar ejecución completa del scraper (admin) |

### Respuestas estándar
- `200 OK` con payload
- `201 Created` para POST
- `422 Unprocessable Entity` para errores de validación Pydantic
- `401 Unauthorized` si token inválido o expirado
- `404 Not Found` para recursos inexistentes

---

## 6. Scraper de Precios

### Arquitectura
- Clase base `BaseScraper` con interfaz común: `fetch_price(set_number: str) -> PriceData`
- Un scraper por fuente (hereda de `BaseScraper`)
- Rate limiting: `asyncio.sleep(2)` entre requests (2s entre llamadas por fuente)
- Reintentos: máximo 3 intentos con backoff exponencial
- APScheduler: cron job a las 03:00 AM, itera todos los productos con `deleted_at IS NULL`

### Prioridad de fuentes
1. **BrickLink** — fuente principal (usar API oficial v2 si disponible, scraping como fallback)
2. **BrickEconomy** — tendencias y valoración histórica
3. **eBay** — verificación secundaria (ventas completadas)

### Lógica de alertas post-scraping
Tras guardar precios, el scheduler comprueba `price_alerts` activas y, si se cumple la condición, registra el disparo en `last_triggered`.

---

## 7. Frontend — Panel de Administración

### Pantallas V1

#### Dashboard (`/dashboard`)
- 4 tarjetas KPI en fila: Valor total inventario, Margen medio (%), ROI, N.º artículos en stock
- Cada KPI con delta-indicator (flecha + % de cambio vs semana anterior)
- Gráfico de línea (Recharts): evolución del valor de mercado agrupado por tema LEGO
- Tabla mini "Top 5 por margen" con link a ficha de producto
- Feed de alertas activas (precio objetivo alcanzado)

#### Listado inventario (`/inventory`)
- Tabla densa con columnas: Set ID, Nombre, Tema, Precio Compra, Precio Mercado, Margen%, Estado, Ubicación
- Filtros inline en cabecera: búsqueda texto, dropdowns tema/categoría/condición
- Checkbox multi-selección para acciones en lote (marcar en venta / eliminar)
- Botón exportar CSV
- Paginación server-side

#### Ficha producto (`/inventory/[id]`)
- Galería de imágenes
- Todos los datos del producto
- Gráfico Recharts: evolución precio de mercado por fuente a lo largo del tiempo
- Panel de alertas del producto
- Botones: Editar / Marcar en venta / Eliminar

#### Formulario alta/edición (`/inventory/new`, `/inventory/[id]/edit`)
- Formulario con validación client-side (react-hook-form + zod)
- Autocompletado nombre/tema al escribir número de set (llamada a **Rebrickable API** — gratuita, bien documentada, cubre todos los sets LEGO)
- Upload múltiple de imágenes → Supabase Storage vía API
- Import CSV como tab alternativa

### Stack frontend
- Next.js 14 App Router (TypeScript)
- Tailwind CSS con tokens de color personalizados
- Recharts para gráficos
- react-hook-form + zod para formularios
- tanstack/table para la tabla de inventario
- lucide-react para iconos

---

## 8. Guía de Marca (Brand Guidelines)

Almacenada en `admin-panel/brand-guidelines.md`. Ver ese archivo para detalle completo.

### Resumen ejecutivo
| Token | Valor | Uso |
|-------|-------|-----|
| `bg-primary` | `#0A0A0B` | Fondo principal |
| `bg-card` | `#141416` | Tarjetas y contenedores |
| `accent-lego` | `#F59E0B` | CTA, elementos destacados |
| `accent-info` | `#3B82F6` | Tooltips, info |
| `status-success` | `#10B981` | ROI positivo, in-stock |
| `status-warning` | `#F97316` | Stock bajo, fluctuación |
| `status-error` | `#EF4444` | Fuera de stock, pérdidas |
| Tipografía | Inter | Tablas densas y métricas |

---

## 9. Infraestructura Local (Docker Compose)

```yaml
services:
  api:
    build: ./api
    ports: ["8000:8000"]
    environment:
      DB_PASSWORD: ${DB_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
  admin-panel:
    build: ./admin-panel
    ports: ["3000:3000"]
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000
```

La base de datos ya está en Supabase (no se levanta PostgreSQL local). El docker-compose es solo para los dos servicios propios.

---

## 10. Variables de Entorno

### `api/.env`
```
DATABASE_URL=postgresql://postgres.vzsqbdrwevtmwlbtjnnv:[PWD]@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:[PWD]@db.vzsqbdrwevtmwlbtjnnv.supabase.co:5432/postgres
SUPABASE_URL=https://vzsqbdrwevtmwlbtjnnv.supabase.co
SUPABASE_ANON_KEY=sb_publishable_vGb8TQ1G0Yarnwz3cGuYow_k6bfqi36
JWT_SECRET=<generar con secrets.token_hex(32)>
ADMIN_EMAIL=admin@legomarkal.com
ADMIN_PASSWORD=<hash bcrypt>
SCRAPER_SCHEDULE_HOUR=3
REBRICKABLE_API_KEY=<obtener gratis en rebrickable.com/api>
```

### `admin-panel/.env.local`
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 11. Fuera de Alcance en V1

- Tienda web pública (V2)
- Integración BrickLink API / eBay API para ventas (V3)
- Analítica avanzada / Pandas (V4)
- Facturación / Envíos / CRM (V5)
- ML / Predicción (V6)
- App móvil
- Multi-usuario / roles
- Stripe / pagos

---

## 12. Criterios de Éxito V1

1. El fundador puede añadir productos al inventario (manual y por CSV)
2. Los precios de mercado se actualizan automáticamente cada noche
3. El dashboard muestra KPIs actualizados (valor inventario, margen, ROI)
4. El panel es accesible con login seguro desde cualquier navegador
5. Las imágenes de productos se suben y visualizan correctamente
6. El sistema funciona de forma estable en Docker Compose (dev) y en un VPS (prod)
