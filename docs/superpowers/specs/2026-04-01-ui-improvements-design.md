# Spec: Mejoras UI/UX LegoMarkal — Venta, Condiciones, Historial y Diseño
**Fecha:** 2026-04-01
**Enfoque elegido:** B — Funcional + visual (cambios explícitos + correcciones de bugs funcionales)

---

## 1. Taxonomía de condición

### Cambios de etiquetas
| Valor interno | Antes | Después |
|---|---|---|
| `SEALED` | Sellado | Sellado *(sin cambio)* |
| `OPEN_COMPLETE` | Abierto completo | **Completo** |
| `OPEN_INCOMPLETE` | Abierto incompleto | **Incompleto** |
| `USED` | Usado | **Eliminado totalmente** |

### Ficheros afectados
- `admin-panel/lib/utils.ts` — `conditionLabel()`
- `admin-panel/components/inventory/FilterBar.tsx` — array `CONDITIONS`
- `admin-panel/components/product/ProductForm.tsx` — selector de condición
- `admin-panel/types/index.ts` — `ProductQuickCreate.condition` (quitar USED)
- `admin-panel/app/(auth)/inventory/new/page.tsx` — si tiene condición hardcodeada

### Invariantes
- El tipo `Condition` ya no conserva `"USED"`.
- No se crea ninguna migración de BD: los valores existentes que usen `"USED"` quedan eliminados.

---

## 2. Flujo de venta — sold_date + sold_price

### 2.1 Backend

**Nuevas columnas en `products`:**
```sql
sold_date  DATE          NULL
sold_price NUMERIC(10,2) NULL
```

**Migración:** `api/alembic/versions/002_add_sold_fields.py`

**Schema `ProductOut`** añade:
```python
sold_date:  Optional[date]    = None
sold_price: Optional[Decimal] = None
```

**Schema `ProductUpdate`** añade los mismos campos como opcionales.

**Scraper runner (`api/app/scraper/runner.py`):** filtrar productos con `availability == 'sold'` antes de iterar — no tiene sentido scrapear sets ya vendidos.

### 2.2 Frontend — Tipo TypeScript

`admin-panel/types/index.ts` — interfaz `Product`:
```typescript
sold_date?:  string | null;
sold_price?: number | null;
```
`ProductUpdate` igual.

### 2.3 Frontend — Modal de venta

**Componente nuevo:** `admin-panel/components/ui/SellModal.tsx`

Props:
```typescript
interface SellModalProps {
  open: boolean;
  productName: string;
  suggestedPrice: number | null;  // último precio de mercado
  onConfirm: (soldPrice: number, soldDate: string) => void;
  onCancel: () => void;
}
```

Comportamiento:
- Campo "Precio de venta real" — pre-rellenado con `suggestedPrice`, editable.
- Campo "Fecha de venta" — pre-rellenado con fecha de hoy, editable.
- Botón "Confirmar" llama a `productsApi.update(id, { availability: 'sold', sold_price, sold_date })`.
- Botón "Cancelar" / tecla Escape cierra sin cambiar estado.
- Si se re-marca como "Disponible", se limpian `sold_date` y `sold_price` (se envían como `null`).

**Integración del modal en:**
- `admin-panel/components/inventory/InventoryTable.tsx` — reemplaza el `onToggleAvailability` directo por apertura de modal cuando `nextAvailability === 'sold'`.
- `admin-panel/app/(auth)/inventory/[id]/page.tsx` — el toggle de disponibilidad abre el modal.

### 2.4 Tabla de inventario — productos vendidos

- Columna "Mercado": para `availability === 'sold'`, muestra `sold_price` con badge pequeño "venta" en vez del precio de scraping.
- Columna "Margen": para vendidos, calcula con `sold_price`; el `calcMarginPct` recibe el precio correcto.
- Fila visual: `opacity-60` en filas vendidas para diferenciarlas de disponibles.

### 2.5 Ficha de producto — sold_date y toggle unificado

**Campo "Añadido" → eliminado.** Sustituido por campo "Vendido" que aparece únicamente cuando `availability === 'sold'`, mostrando `sold_date`.

**Toggle de disponibilidad:** actualmente está duplicado (if notes / else no-notes). Se unifica: el toggle vive siempre en el `CardHeader`, junto a los badges de estado y los botones de editar/eliminar. El bloque `if/else` de notas desaparece.

**Sección "Precio de mercado":** para productos vendidos, el título cambia a "Precio de venta" y muestra `sold_price`. El label "Margen potencial" cambia a "Beneficio real".

---

## 3. Historial de precios — marcador de venta

**Componente `PriceHistory`** recibe dos nuevas props opcionales:
```typescript
soldDate?:  string;   // ISO date
soldPrice?: number;
```

Cuando están presentes, se añade al gráfico:
- **Línea vertical de referencia** (`ReferenceLine` de Recharts) en `x = soldDate`, punteada, color accent-lego.
- **Label sobre la línea** con el texto `sold_price` formateado como moneda.

El historial no se trunca artificialmente — simplemente el scraper ya no añade puntos nuevos, así que la gráfica se queda congelada en el tiempo de forma natural.

---

## 4. Dashboard — Beneficios reales

### 4.1 Backend

**Nuevo endpoint:** `GET /dashboard/real-profits`

Respuesta:
```json
{
  "total_sold_items": 3,
  "total_sold_revenue": 280.00,
  "total_real_profit": 95.00,
  "avg_profit_per_item": 31.67
}
```

Cálculo:
- `total_sold_items` = `COUNT(*)` donde `availability='sold'` y `deleted_at IS NULL`
- `total_sold_revenue` = `SUM(sold_price * quantity)` para los mismos
- `total_real_profit` = `SUM((sold_price - purchase_price) * quantity)`
- `avg_profit_per_item` = `total_real_profit / total_sold_items`

Schema Pydantic: `RealProfitSummary` en `api/app/schemas/price.py`.

**Ficheros backend afectados:**
- `api/app/routers/dashboard.py` — nuevo endpoint
- `api/app/services/price_service.py` — nueva función `get_real_profit_summary()`
- `api/app/schemas/price.py` — nuevo schema `RealProfitSummary`

### 4.2 Frontend

**`api-client.ts`:** nuevo método `dashboardApi.realProfits()`.

**`types/index.ts`:** nueva interfaz `RealProfitSummary`.

**`dashboard/page.tsx`:** nueva sección "Beneficios reales" entre los KPIs y el gráfico. Solo se renderiza si `total_sold_items > 0`.

```
┌──────────────────────────────────────────────────────────┐
│  Beneficios reales                                       │
│  [Sets vendidos: 3] [Recaudado: 280 €] [Ganancia: +95 €] │
└──────────────────────────────────────────────────────────┘
```

Tres `KpiCard` en una fila de 3 columnas.

---

## 5. Feedback de navegación — skeleton de página

**Eliminar:** estado `pendingProductId`, lógica de spinner inline y el `window.setTimeout` de 5000ms de `InventoryTable.tsx`.

**Añadir:** `admin-panel/app/(auth)/inventory/[id]/loading.tsx` — skeleton animado con la estructura de la ficha:
- Cabecera con bloque de título
- Grid 2/3 + 1/3: bloque izquierdo (card detalles + card historial), bloque derecho (card imágenes + card precio + card alertas)
- Animación `animate-pulse` de Tailwind

Este es el patrón nativo de Next.js 14 App Router. El framework lo muestra automáticamente durante la transición de ruta sin ningún estado manual.

---

## 6. Correcciones funcionales

| # | Pantalla | Bug | Corrección |
|---|---|---|---|
| F1 | Ficha producto | Toggle disponibilidad duplicado (if/else notas) | Unificado en CardHeader (incluido en Sección 2.5) |
| F2 | Ficha producto | Tipos de alerta como texto técnico crudo (`PRICE_BELOW`) | Mapa legible: "Avisar si precio < X €", "Avisar si precio > X €", "Avisar si cambio > X%" |
| F3 | Página de precios | Incluye productos vendidos en la tabla de insights | Filtrar `availability='available'` en el endpoint backend (`/dashboard/price-insights`) |
| F4 | Dashboard KPI | "Artículos en stock" incluye vendidos | `price_service.get_dashboard_summary()` filtra por `availability='available'` |
| F5 | Página de precios | Leyenda "New"/"Used" en inglés | Renombrar a "Nuevo"/"Usado" |

---

## 7. Revisión visual post-implementación

Una vez completada la implementación y verificado que todo funciona:

1. **Tomar capturas** de las interfaces principales: Dashboard, Inventario (lista), Ficha de producto (disponible), Ficha de producto (vendido), Página de precios.
2. **Análisis crítico** de cada captura: jerarquía visual, legibilidad, densidad de información, coherencia de color, espaciado.
3. **Proponer mejoras concretas** derivadas del análisis.
4. **Implementar** las mejoras propuestas.
5. **Verificar** tomando nuevas capturas y confirmando que los cambios son correctos.

---

## Ficheros a crear / modificar

### Backend
| Acción | Fichero |
|---|---|
| CREAR | `api/alembic/versions/002_add_sold_fields.py` |
| MODIFICAR | `api/app/models/product.py` |
| MODIFICAR | `api/app/schemas/product.py` |
| MODIFICAR | `api/app/schemas/price.py` |
| MODIFICAR | `api/app/routers/dashboard.py` |
| MODIFICAR | `api/app/services/price_service.py` |
| MODIFICAR | `api/app/scraper/runner.py` |

### Frontend
| Acción | Fichero |
|---|---|
| CREAR | `admin-panel/components/ui/SellModal.tsx` |
| CREAR | `admin-panel/app/(auth)/inventory/[id]/loading.tsx` |
| MODIFICAR | `admin-panel/lib/utils.ts` |
| MODIFICAR | `admin-panel/types/index.ts` |
| MODIFICAR | `admin-panel/lib/api-client.ts` |
| MODIFICAR | `admin-panel/components/inventory/FilterBar.tsx` |
| MODIFICAR | `admin-panel/components/inventory/InventoryTable.tsx` |
| MODIFICAR | `admin-panel/components/product/PriceHistory.tsx` |
| MODIFICAR | `admin-panel/app/(auth)/inventory/[id]/page.tsx` |
| MODIFICAR | `admin-panel/app/(auth)/inventory/page.tsx` |
| MODIFICAR | `admin-panel/app/(auth)/dashboard/page.tsx` |
| MODIFICAR | `admin-panel/app/(auth)/prices/page.tsx` |

### Opcionales (si existe el formulario de alta/edición)
| Acción | Fichero |
|---|---|
| MODIFICAR | `admin-panel/components/product/ProductForm.tsx` |
| MODIFICAR | `admin-panel/app/(auth)/inventory/new/page.tsx` |
