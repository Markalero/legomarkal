# README_CONTEXT
 
Fecha de actualización: 2026-04-12 (sistema de notificaciones flotantes toast: ToastContext/ToastProvider/useToast/useToastState en lib/toast-context.tsx, Toast.tsx y ToastContainer.tsx en components/ui; corrección bug exportación backup (anchor sin DOM + revokeObjectURL síncrono); progreso predictivo por fases para descarga desde Supabase; toasts de éxito/error en alertas, productos, importación y reset)

---

## Últimos cambios detectados

- **Fecha**: 2026-04-12 — resumen de cambios frontend recientes.
- **Fixes aplicados (auditoria UI/A11Y)**: mejoras transversales en `Modal` (role dialog, aria-modal, trap de foco, restauracion de foco y cierre accesible), `Input` (aria-invalid + aria-describedby), `ChartRangeSelector` (radiogroup + estado ARIA), tablas con `caption/scope`, filas clicables accesibles por teclado en inventario/precios, reemplazo de `confirm()` nativo en recibos por `ConfirmModal`, `skip-link` global, mensajes de error mas amigables con detalle tecnico opcional y sidebar responsive con drawer movil.
- **Componentes añadidos**: admin-panel/components/ui/ConfirmModal.tsx (modal de confirmación) y admin-panel/components/ui/RefreshProgressOverlay.tsx (overlay de progreso).
- **Hook añadido**: admin-panel/lib/useRefreshProgress.ts — centraliza lógica de progreso predictivo y control de estado de refresco.
- **Páginas actualizadas**: admin-panel/app/(auth)/dashboard/page.tsx, admin-panel/app/(auth)/inventory/page.tsx, admin-panel/app/(auth)/prices/page.tsx, admin-panel/app/(auth)/inventory/[id]/page.tsx, admin-panel/app/(auth)/inventory/new/page.tsx, admin-panel/app/(auth)/alerts/page.tsx — migradas a `useRefreshProgress` y `RefreshProgressOverlay`.
- **Refactor UX**: Reemplazo de `confirm()` por `ConfirmModal`, adición de `backHref/backLabel` en `Header`, lightbox de imagen en `InventoryTable`, auto-guardado de fuentes de compra en nuevo producto.
- **Estética / Animaciones**: admin-panel/tailwind.config.ts añade keyframes y clases `fade-in`, `slide-up-fade`, `zoom-in-fade`; múltiples páginas usan `animate-slide-up-fade`.
- **Visor de imágenes mejorado**: nuevo componente reutilizable `admin-panel/components/ui/Lightbox.tsx` aplicado en inventario y subida de imágenes (`ImageUpload`) con controles centrados, teclado, miniaturas y cierre integrado en contenedor.
- **Lightbox a ancho completo**: `admin-panel/components/ui/Lightbox.tsx` elimina el límite de ancho fijo y ocupa todo el viewport disponible para la imagen principal.
- **Backup global de datos (JSON)**: backend añade `GET /products/export-all` y `POST /products/import-all` para exportar/importar la totalidad de tablas de negocio (`products`, `market_prices`, `price_alerts`, `portfolio_daily_snapshots`) en formato `legomarkal-backup-v1`.
- **Reset total de datos**: backend añade `POST /products/reset-all`; frontend incorpora botón dedicado con advertencia, espera obligatoria de 10s y barra de progreso antes de permitir confirmar.
- **Configuración de inventario**: botones de datos migrados de CSV/Excel a backup JSON completo (exportar/importar) para mantener consistencia de todas las tablas.
- **Gráficas individuales más robustas (datos diarios)**: `admin-panel/app/(auth)/prices/page.tsx` combina `/market-prices/{id}/trend` con `/market-prices/{id}` para no perder muestras diarias existentes si el endpoint de tendencia llega incompleto.
- **Bandas min/max curvas**: en `admin-panel/app/(auth)/prices/page.tsx` la zona sombreada y límites de variabilidad pasan de `linear` a `monotone`, alineándose con la curva de precios y evitando salidas visuales de umbral.

Se recomienda revisar las nuevas piezas UI y el hook `useRefreshProgress` para integrarlas en futuras vistas que requieran feedback de operaciones largas.

## 1) Resumen general rápido

### Estado del proyecto
- Backend FastAPI V1 completo y funcional.
- Modelo de datos y migración inicial creados.
- Endpoints REST implementados y protegidos con JWT.
- Scraping de precios operativo (manual y schedulado).
- Backend endurecido en despliegue: al arrancar ejecuta `alembic upgrade head` automáticamente antes de exponer la API.
- Parsing de precios robusto en scrapers (soporte para EUR/USD/GBP y formatos decimales ES/EN).
- Login/frontend endurecido ante fallos de red (sin runtime crash por fetch) y guard de rutas auth antes de renderizar páginas protegidas.
- Tests de integración parametrizables con `TEST_BASE_URL` para evitar dependencia rígida del puerto 8000.
- Scraper BrickLink con fallback a Price Guide (`catalogPG.asp`) para extraer precios cuando la ficha no incluye tabla de guía.
- API de productos ahora devuelve `latest_market_price`, corrigiendo que la vista de "Precios de mercado" mostrase guiones pese a existir historial.
- Runner de scraping configurado para usar BrickLink como fuente oficial de precios.
- Endpoint de imágenes funcional: `POST /products/{id}/images` con almacenamiento local y servido estático en `/uploads/**`.
- Configuración de imágenes en Next.js ampliada para aceptar `localhost` y `127.0.0.1` en cualquier puerto para `/uploads/**`.
- Dashboard actualizado con comparativa temporal de dinero invertido vs valor de mercado (incluye beneficio potencial).
- Módulo de precios ampliado con gráfica temporal detallada (mínimo/media/máximo diario) y ranking de sets por beneficio en euros.
- API de productos ampliada con alta rápida: `POST /products/quick-add` (set_number + datos mínimos), autocompletando nombre/tema/año/imagen principal desde BrickLink.
- Al crear/importar productos con `set_number`, backend precarga histórico en `market_prices`: 6 meses previos (sin mes actual) guardados a fin de mes + snapshot actual, para que la gráfica tenga contexto desde el primer momento.
- Parser de metadatos BrickLink endurecido: fallback de nombre desde `h1`/`title` cuando falta `og:title`, evitando falsos negativos al validar sets reales como `7965`.
- Parser de precios BrickLink ajustado para priorizar importes `EUR` cuando la celda incluye múltiples monedas y persistencia final normalizada siempre a `EUR` en `market_prices`.
- Parser de precios BrickLink endurecido para Price Guide por moneda (`cID=N`): usa dataset EUR+USD convertido a EUR, ignora RON/ROL y soporta tokens con espacios no separables (`US\u00A0$`).
- Extracción de precio BrickLink prioriza `catalogPG.asp` (Price Guide por moneda) y deja la ficha de catálogo como fallback secundario para evitar sesgos por moneda de sesión en la página principal.
- `market_prices` ampliada con rangos por estado y nomenclatura explícita: `min_price_new/max_price_new` (nuevo) y `min_price_used/max_price_used` (usado), para no mezclar métricas de condiciones distintas.
- Limpieza operativa aplicada tras migración de rangos: vaciado de `market_prices` y `portfolio_daily_snapshots` para regenerar histórico consistente con el nuevo esquema.
- API de precios ampliada con histórico por producto: `GET /market-prices/{product_id}/trend?months=6&guide_type=sold`.
- Históricos mensuales por producto ahora se rellenan con datos reales del Price Guide de BrickLink (meses disponibles), sin interpolación/siembra artificial; si falta un mes, se omite.
- Historial de precios sin backfill sintético: solo snapshots reales guardados desde scraper/importación.
- Cálculo de valor de mercado ajustado por estado: `SEALED => price_new`, `OPEN_COMPLETE/OPEN_INCOMPLETE => price_used`.
- Dashboard alineado con inventario al seleccionar siempre el último snapshot válido por condición (`SEALED` requiere `price_new`, abierto requiere `price_used`), evitando excluir sets con precio parcial en el último scrape.
- Evolución del dashboard endurecida: reconstrucción completa de `portfolio_daily_snapshots` en la consulta de tendencias para corregir históricos heredados por lógica anterior.
- Inventario simplificado: sin categorías ni ubicaciones en UI/API/BBDD.
- UX de imágenes mejorada: confirmación al borrar y visor fullscreen con navegación (flechas, teclado y miniaturas).
- Sección "Consulta por código LEGO" eliminada de la vista de precios.
- Gráfica global corregida para evitar inflación por snapshots duplicados en agregaciones históricas.
- Evolución global ahora se persiste en `portfolio_daily_snapshots` y el día actual se recalcula completo en cada consulta (`invertido` y `valor de mercado`).
- Línea de "Beneficio potencial" eliminada en gráficas globales (dashboard y módulo de precios).
- Alertas más accesibles con creación rápida en la pantalla de alertas y en la ficha de producto.
- Gráfica "Evolución: dinero invertido vs valor de mercado" ajustada con dominio dinámico en eje Y para mantener el máximo dentro del área visible.
- Navegación lateral con feedback visual de carga al cambiar de sección.
- Sección de precios rediseñada visualmente (cabecera, filas alternas, realce de beneficio) y botón global "Actualizar precios" en la parte superior derecha.
- Gráficas frontend (dashboard, precios y ficha de producto) con selector de rango temporal (`1m`, `3m`, `6m`, `all`) y valor por defecto en `6m`.
- Gráfica de precios por producto renombrada en UI de "Histórico 6 meses" a "Histórico de precios".
- Gráfica de histórico por producto (módulo precios) ahora muestra puntos visibles en líneas `Nuevo/Usado` para que meses aislados sin continuidad no desaparezcan visualmente.
- Gráfica de histórico por producto: banda de variabilidad min/max ajustada para dibujarse como zona sombreada exacta entre límites (base=min, altura=max-min) con trazado lineal para evitar sobreoscilaciones.
- Módulo de precios (histórico de producto): variabilidad rehacida por estado (`Nuevo` y `Usado`) con líneas min/max invisibles y sombreado entre límites de cada estado; la variabilidad no aparece en la leyenda.
- Módulo de precios (histórico de producto): el eje Y incluye min/max de bandas para que la variabilidad completa quede dentro de la gráfica; tooltip simplificado a `Nuevo` y `Usado`, mostrando en la serie principal `(+distancia a max/-distancia a min)`.
- Alertas muestran nombre de producto desde inventario (en vez de enseñar solo el ID cuando no viene expandido en respuesta API).
- Ficha de producto: bloque "Crear alerta rápida" remaquetado en dos líneas (tipo de alerta arriba, umbral + botón abajo) para mejorar legibilidad y alineación responsive.
- Script operativo de relanzado completo en `scripts/restart-dev.ps1`:
	- libera puertos historicos (3000/8000/8010/8011/8020),
	- limpia `.next`,
	- levanta backend en `8011` con `uvicorn --reload` y frontend en `3000` apuntando a `8011`,
	- valida `GET /health` y `GET /dashboard`.
	- probado 3 ejecuciones consecutivas con `health=200` y `dashboard=200` en todas.
- Alta rápida endurecida en backend/frontend:
	- no se permite crear producto si el set no se valida con metadata real y precio de mercado.
	- `set_number` validado por patrón numérico LEGO, y compra (fecha/fuente/precio) obligatoria.
- Estado de inventario unificado:
	- se elimina `is_listed` y se sustituye por `availability` (`available` | `sold`) en modelo, API y frontend.
	- en inventario se fusionan columnas de compra/estado en una sola columna **Disponibilidad** con botón toggle visual.
- Seed de datos reales reproducible en `api/scripts/reset_and_seed_real_sets.py`:
	- limpieza total de tablas de negocio,
	- inserta catálogo fijo de sets reales (sin dependencia de scraping durante el seed),
	- genera histórico mensual de `market_prices` hasta `2026-03-30`,
	- garantiza `currency='EUR'` y ausencia de datos del día actual en snapshots/market_prices.
- Scripts operativos de datos demo:
	- `api/scripts/clear_database.py`: limpia por completo `products`, `market_prices`, `price_alerts` y `portfolio_daily_snapshots`.
	- `api/scripts/seed_example_data.py`: puebla datos de ejemplo y genera histórico autoajustado con último punto en **ayer** (nunca en hoy).
- Consistencia UX en acciones de refresco de precios:
	- nuevo componente reutilizable `admin-panel/components/ui/RefreshPricesButton.tsx` aplicado en dashboard, precios y ficha de producto.
	- botón global "Actualizar precios" ahora ejecuta flujo en dos pasos en dashboard y precios: refresco inmediato desde BBDD, scraping síncrono completo y refresco final de UI.
	- backend añade endpoint `POST /scraper/refresh-all` con resumen (`total_products`, `missing_after_first`, `missing_after_second`, `spain_today`).
	- runner de scraping añade segunda pasada automática para productos sin snapshot del día actual (comparación por fecha local España).
	- refresco global ahora sincroniza también `portfolio_daily_snapshots`: upsert diario (fecha España) al finalizar `scrape_all_products` y `refresh_all_products_prices_for_today`.
	- `refresh-all` ahora reconstruye completo `portfolio_daily_snapshots` desde `market_prices` (no solo hoy), garantizando consistencia histórica tras actualizar precios.
	- texto e iconografía unificados en la acción "Actualizar precios".
	- botón "Actualizar precios" (dashboard y precios) muestra progreso por fases con barra y porcentaje durante la operación.
	- progreso de refresco mejorado con predicción dinámica basada en número de modelos (`~ operaciones`) para una barra más estable durante procesos largos.
- Feedback de navegación en inventario:
	- al seleccionar una fila de producto se muestra estado "Abriendo…" con spinner en la misma fila hasta completar navegación.
	- tabla de inventario ampliada con columna **Cantidad** visible junto a condición y compra.
- Persistencia de precios ajustada en backend:
	- `market_prices` guarda **una sola fila por producto y día** (upsert diario en `price_service.save_price`).
	- si ya existe fila del día, se sobreescribe y se eliminan duplicados del mismo día.
	- para sets repetidos en inventario, `market_prices` se consolida por `set_number` usando un `product_id` canónico (evita duplicados por copias del mismo set).
	- lecturas de historial/tendencias y `latest_market_price` consultan por `set_number` compartido, no por id individual.
	- `currency` se normaliza siempre a `EUR` al guardar.
	- limpieza BD aplicada: deduplicación histórica por `product_id + fecha`, conversión masiva de moneda a `EUR`, borrado de registros de hoy en `market_prices` y `portfolio_daily_snapshots`.
- **Frontend Next.js 14 App Router completamente implementado (V1).**
  - Login con JWT, layout protegido, dashboard con KPIs + gráfico, inventario con filtros/paginación, ficha de producto con historial de precios, formularios alta/edición, importación CSV/Excel, alertas, vista de precios.

### Esquema global de directorios y ficheros

```text
LegoMarkal/
├─ .gitignore
├─ docker-compose.yml
├─ .Claude/
│  └─ README_CONTEXT.md
├─ admin-panel/
│  ├─ Dockerfile
│  ├─ package.json
│  ├─ next.config.ts
│  ├─ tailwind.config.ts
│  ├─ tsconfig.json
│  ├─ postcss.config.js
│  ├─ .env.local.example
│  ├─ app/
│  │  ├─ layout.tsx              # Root layout (fuente, meta, globals.css)
│  │  ├─ page.tsx                # Redirect → /dashboard
│  │  ├─ globals.css             # Tailwind + Inter + scrollbar
│  │  ├─ login/
│  │  │  └─ page.tsx             # Login email/contraseña → JWT
│  │  └─ (auth)/
│  │     ├─ layout.tsx           # Guard auth: redirige a /login si no hay token
│  │     ├─ dashboard/page.tsx   # KPIs, gráfico inversión vs mercado, top margen, alertas
│  │     ├─ inventory/
│  │     │  ├─ page.tsx          # Tabla inventario + filtros + export/import + configuración
│  │     │  ├─ new/page.tsx      # Formulario alta producto
│  │     │  └─ [id]/
│  │     │     ├─ page.tsx       # Ficha producto + galería + precios + alertas
│  │     │     └─ edit/page.tsx  # Formulario edición producto
│  │     ├─ prices/page.tsx      # Vista precios BrickLink: global tipo dashboard + histórico por producto seleccionado
│  │     └─ alerts/page.tsx      # Listado, creación rápida y eliminación de alertas activas
│  ├─ components/
│  │  ├─ ui/
│  │  │  ├─ Button.tsx           # Botón con variantes: primary, secondary, ghost, danger
│  │  │  ├─ Input.tsx            # Input con label, error y adorno izquierdo
│  │  │  ├─ Badge.tsx            # Badges de estado: success, warning, error, info, neutral
│  │  │  ├─ Card.tsx             # Contenedor card con CardHeader y CardTitle
│  │  │  ├─ ChartRangeSelector.tsx # Selector de rango temporal para gráficas (1m/3m/6m/all)
│  │  │  ├─ Modal.tsx            # Modal con overlay, cierre Escape/click
│  │  │  ├─ Toast.tsx            # Componente individual de notificación flotante (success/error/info/warning/progress)
│  │  │  └─ ToastContainer.tsx   # Contenedor fixed bottom-right que renderiza la cola de toasts
│  │  ├─ layout/
│  │  │  ├─ Sidebar.tsx          # Navegación principal + logout
│  │  │  └─ Header.tsx           # Cabecera de página con título y acciones
│  │  ├─ dashboard/
│  │  │  ├─ KpiCard.tsx          # Tarjeta KPI con delta-indicator
│  │  │  ├─ PriceChart.tsx       # Recharts: línea evolución por tema
│  │  │  └─ AlertFeed.tsx        # Feed de alertas activas
│  │  ├─ inventory/
│  │  │  ├─ InventoryTable.tsx   # Tabla densa con paginación server-side
│  │  │  ├─ FilterBar.tsx        # Filtros: búsqueda, tema, condición, estado
│  │  │  └─ BulkImport.tsx       # Drag & drop CSV/Excel → importación masiva
│  │  └─ product/
│  │     ├─ ProductForm.tsx      # Formulario alta/edición con sugerencias de tema/fuente de compra
│  │     ├─ PriceHistory.tsx     # Recharts: historial precio por fuente
│  │     └─ ImageUpload.tsx      # Subida múltiple de imágenes con persistencia backend
│  ├─ lib/
│  │  ├─ api-client.ts           # Wrapper fetch → FastAPI (auth, products, prices, alerts, dashboard)
│  │  ├─ auth.ts                 # Token JWT en localStorage + verificación expiración
│  │  ├─ toast-context.tsx       # ToastContext, ToastProvider, useToast (disparar), useToastState (leer)
│  │  └─ utils.ts                # formatCurrency, formatPct, formatDate, conditionLabel, calcMarginPct, cn
│  ├─ types/
│  │  └─ index.ts                # Interfaces TypeScript: Product, MarketPrice, PriceAlert, Dashboard...
│  └─ public/
├─ api/
│  ├─ .env.example
│  ├─ alembic.ini
│  ├─ Dockerfile
│  ├─ requirements.txt
│  ├─ alembic/
│  │  ├─ env.py
│  │  ├─ script.py.mako
│  │  └─ versions/
│  │     └─ 001_initial_schema.py
│  └─ app/
│     ├─ __init__.py
│     ├─ auth.py
│     ├─ config.py
│     ├─ database.py
│     ├─ main.py
│     ├─ scheduler.py
│     ├─ models/
│     │  ├─ __init__.py
│     │  ├─ base.py
│     │  ├─ price.py
│     │  └─ product.py
│     ├─ routers/
│     │  ├─ __init__.py
│     │  ├─ alerts.py
│     │  ├─ auth.py
│     │  ├─ dashboard.py
│     │  ├─ prices.py
│     │  └─ products.py
│     ├─ schemas/
│     │  ├─ __init__.py
│     │  ├─ auth.py
│     │  ├─ price.py
│     │  └─ product.py
│     ├─ scraper/
│     │  ├─ __init__.py
│     │  ├─ base_scraper.py
│     │  ├─ brickeconomy_scraper.py
│     │  ├─ bricklink_scraper.py
│     │  ├─ ebay_scraper.py
│     │  └─ runner.py
│     └─ services/
│        ├─ __init__.py
│        ├─ import_service.py
│        ├─ price_service.py
│        └─ product_service.py
├─ docs/
│  ├─ informe_tecnologico_lego_business.md
│  ├─ copilot/
│  │  └─ 2026-03-31-guia-lanzamiento-y-uso.md
│  └─ superpowers/
│     └─ specs/
│        └─ 2026-03-30-legomarkal-v1-design.md
└─ supabase_prompts/
	 ├─ Framework.txt
	 ├─ MCP.txt
	 ├─ ORM.txt
	 └─ direct.txt
```

---

## 2) Análisis por directorio, subdirectorio y fichero

## 2.1) Raíz del repositorio

### .gitignore
- Finalidad: excluir artefactos locales (entornos Python, node_modules, builds, ficheros de IDE y secretos locales).
- Qué cubre: Python, Alembic bytecode, Node/Next, builds, IDE, ficheros de SO.
- Resultado: reduce ruido en control de versiones y evita fugas accidentales de entorno.
- Observación: correcto para stack mixto Python + Next.

### docker-compose.yml
- Finalidad: levantar entorno local con API y panel admin.
- Qué hace:
	- Servicio api: build desde api/, expone 8000, monta volumen para desarrollo, arranca uvicorn en modo reload.
	- Servicio admin-panel: build desde admin-panel/, expone 3000, monta volúmenes de app y cache de Next, depende de api.
- Resultado: base de orquestación lista para desarrollo local.
- Observación: el frontend está implementado y disponible en `admin-panel/`.

### docs/informe_tecnologico_lego_business.md
- Finalidad: documento estratégico/arquitectónico de alto nivel del negocio y roadmap tecnológico multi-versión.
- Qué aporta:
	- visión por fases (MVP a escalado),
	- decisiones de stack,
	- descripción extensa del dominio y flujo.
- Resultado: guía macro para alineación de producto y tecnología.

### .Claude/README_CONTEXT.md
- Finalidad: mapa técnico operativo y actualizado del repositorio para trabajo asistido.
- Qué aporta: contexto inmediato sin necesidad de re-escanear todo el proyecto.
- Resultado: reduce coste de entrada y errores por falta de contexto.

---

## 2.2) Directorio admin-panel/

Estado actual: **implementación V1 completa en Next.js 14 App Router**.

### admin-panel/app/
- layout.tsx: Root layout con metadata y globals.css (Inter, Tailwind, scrollbar oscuro).
- page.tsx: Redirect raíz → /dashboard.
- globals.css: Tailwind base + Import Inter + scrollbar temático.
- login/page.tsx: Formulario de login con react-hook-form + zod, obtiene JWT y lo guarda en localStorage.
- (auth)/layout.tsx: Guard de autenticación — redirige a /login si el token está ausente o expirado.
- (auth)/dashboard/page.tsx: KPIs (4 tarjetas), gráfico Recharts de inversión vs mercado, top 5 margen, feed de alertas, botón trigger scraper.
- (auth)/inventory/page.tsx: Tabla paginada con FilterBar (búsqueda, tema, condición, estado), exportación CSV, importación masiva y configuración de inventario.
- (auth)/inventory/new/page.tsx: Alta rápida por código LEGO + estado/compra; metadatos resueltos desde BrickLink.
- (auth)/inventory/[id]/page.tsx: Ficha completa — galería imágenes, datos, historial precios (Recharts con filtro temporal), alertas del producto (formulario en dos filas), botones editar/eliminar/scrape.
- (auth)/inventory/[id]/edit/page.tsx: Formulario de edición con valores precargados.
- (auth)/prices/page.tsx: Vista tabular con gráfica global (igual dashboard) y cambio a histórico por producto seleccionado; ambas vistas con filtro temporal `1m/3m/6m/all` (default `6m`).
- (auth)/alerts/page.tsx: Listado, creación rápida y eliminación de alertas activas.

### admin-panel/components/
Ver árbol detallado en sección 1. Componentes UI base (Button, Input, Badge, Card, ChartRangeSelector, Modal), layout (Sidebar, Header), dashboard (KpiCard, PriceChart, AlertFeed), inventory (InventoryTable, FilterBar, BulkImport), product (ProductForm, PriceHistory, ImageUpload).

- Nota UX reciente:
	- UI: `RefreshPricesButton.tsx` centraliza estilo/comportamiento del CTA de actualización de precios.
	- UI: `ChartRangeSelector.tsx` unifica el filtro temporal de gráficas (`1m`, `3m`, `6m`, `all`) en dashboard, módulo de precios y ficha de producto.
	- InventoryTable integra `SellModal` para capturar precio/fecha real de venta al marcar "sold". Filas vendidas muestran `sold_price` con badge "venta" y `opacity-60`. Spinner de navegación por fila eliminado; la navegación usa `router.push` directo.
	- `handleToggleAvailability` en `inventory/page.tsx` actualizado para propagar `sold_price` y `sold_date` al endpoint de edición.
	- Ficha de producto: formulario "Crear alerta rápida" ajustado para separar selector de tipo y acción de alta en dos filas, mejorando el encaje visual en desktop y móvil.

### admin-panel/lib/
- api-client.ts: Cliente HTTP con Bearer token automático, gestión de 401 y redirección a login.
- auth.ts: Almacenamiento JWT en localStorage con verificación de expiración por payload.
- utils.ts: formatCurrency, formatPct, formatDate, conditionLabel, calcMarginPct, cn (tailwind-merge).

### admin-panel/types/
- index.ts: Interfaces TypeScript que replican los schemas Pydantic del backend.

### admin-panel/public/
- Sin activos estáticos por ahora.

Conclusión de admin-panel:
- Panel de administración V1 completamente implementado y listo para ejecutar con `npm run dev` o Docker.

---

## 2.3) Directorio api/

## 2.3.1) Ficheros de primer nivel en api/

### api/.env.example
- Finalidad: plantilla de variables de entorno para backend.
- Variables principales:
	- DATABASE_URL (runtime con pooler Supabase),
	- DIRECT_URL (migraciones),
	- SUPABASE_URL y SUPABASE_ANON_KEY,
	- JWT_SECRET,
	- ADMIN_EMAIL y ADMIN_PASSWORD,
	- SCRAPER_SCHEDULE_HOUR,
	- REBRICKABLE_API_KEY.
- Resultado: arranque reproducible de entorno si se completa correctamente.
- Riesgo a vigilar: ADMIN_PASSWORD debe guardarse en hash bcrypt real, no texto plano.

### api/alembic.ini
- Finalidad: configuración de Alembic.
- Qué hace: define ubicación de scripts y logging; la URL real se inyecta desde env.py con DIRECT_URL.
- Resultado: migraciones desacopladas de valores hardcodeados.

### api/Dockerfile
- Finalidad: imagen de backend para ejecución containerizada.
- Qué hace:
	- base python:3.11-slim,
	- instala dependencias de sistema (libpq, gcc, lxml/xslt),
	- instala requirements,
	- copia código y arranca uvicorn.
- Resultado: empaquetado listo para desarrollo/despliegue simple.

### api/requirements.txt
- Finalidad: dependencias Python del backend.
- Paquetes clave:
	- API: fastapi, uvicorn,
	- datos: sqlalchemy, alembic, psycopg2,
	- validación: pydantic, pydantic-settings,
	- auth: python-jose, passlib,
	- scraping: httpx, beautifulsoup4, lxml, tenacity,
	- scheduler: apscheduler,
	- importación: openpyxl, python-multipart,
	- integración: supabase.
- Resultado: stack completo de V1 backend definido y fijado por versión.

---

## 2.3.2) api/alembic/

### api/alembic/env.py
- Finalidad: runtime de Alembic para ejecutar migraciones.
- Qué hace:
	- carga metadata SQLAlchemy desde app.models,
	- usa DIRECT_URL para conexión directa,
	- soporta modos online/offline.
- Resultado: migraciones fiables sobre Supabase sin depender del pooler de runtime.

### api/alembic/script.py.mako
- Finalidad: plantilla base para futuras migraciones Alembic.
- Qué hace: define estructura estándar con upgrade/downgrade y metadatos de revisión.
- Resultado: consistencia en nuevas revisiones.

### api/alembic/versions/001_initial_schema.py
- Finalidad: migración inicial V1.
- Qué crea:
	- tablas categories, products, market_prices, price_alerts,
	- constraints de dominio,
	- índices frecuentes,
	- seed inicial de categorías.
- Resultado: esquema mínimo funcional para inventario, precios y alertas.
- Observación: la columna source usa check para bricklink/brickeconomy/ebay.

---

## 2.3.3) api/app/

### api/app/__init__.py
- Estado: vacío.
- Finalidad implícita: marcar paquete Python.

### api/app/config.py
- Finalidad: configuración central tipada con BaseSettings.
- Qué hace:
	- define parámetros de BD, auth, Supabase y scheduler,
	- carga desde .env,
	- ignora extras no declarados.
- Resultado: configuración robusta y tipada para toda la app.

### api/app/database.py
- Finalidad: inicialización de engine SQLAlchemy y factoría de sesiones.
- Qué hace:
	- create_engine con pool_pre_ping,
	- SessionLocal,
	- dependencia get_db para ciclo por request.
- Resultado: capa de acceso a BD estable para routers y servicios.

### api/app/auth.py
- Finalidad: utilidades de autenticación y autorización.
- Qué hace:
	- hash y verificación de contraseñas (bcrypt),
	- creación de JWT con expiración,
	- dependencia get_current_user para validar token.
- Resultado: protección de endpoints sensibles.

### api/app/main.py
- Finalidad: punto de entrada FastAPI.
- Qué hace:
	- inicializa app con metadata,
	- configura CORS (localhost:3000),
	- registra routers,
	- controla lifecycle para arrancar/parar scheduler,
	- expone health check.
- Resultado: API ejecutable con arranque limpio y tareas periódicas integradas.

### api/app/scheduler.py
- Finalidad: programación automática de scraping.
- Qué hace:
	- define BackgroundScheduler,
	- crea job cron diario (hora configurable),
	- arranque/parada del scheduler.
- Resultado: actualización automática de precios sin intervención manual.

---

## 2.3.4) api/app/models/

### api/app/models/base.py
- Finalidad: clase base declarativa común de SQLAlchemy.
- Resultado: centraliza metadata para ORM y Alembic.

### api/app/models/product.py
- Finalidad: entidades de inventario.
- Modelos:
	- Category: catálogo de categorías,
	- Product: entidad principal de stock con metadatos de compra/estado.
- Relaciones:
	- Product -> Category,
	- Product -> MarketPrice,
	- Product -> PriceAlert.
- Resultado: núcleo de dominio de inventario definido.

### api/app/models/price.py
- Finalidad: entidades de mercado y alertas.
- Modelos:
	- MarketPrice: snapshots de precio por fuente y fecha,
	- PriceAlert: umbrales configurables por producto.
- Resultado: trazabilidad histórica de mercado y disparo de alertas.

### api/app/models/__init__.py
- Finalidad: exportación agregada de modelos para import único.
- Qué habilita: descubrimiento de metadata por Alembic autogenerate.

---

## 2.3.5) api/app/schemas/

### api/app/schemas/auth.py
- Finalidad: contratos Pydantic de autenticación.
- Contiene:
	- LoginRequest,
	- TokenOut.
- Resultado: validación explícita de payload auth.

### api/app/schemas/product.py
- Finalidad: contratos de categorías y productos.
- Contiene:
	- CategoryCreate/Out,
	- ProductCreate/Update/Out,
	- ProductListOut para paginación.
- Resultado: validación robusta en CRUD y listados.

### api/app/schemas/price.py
- Finalidad: contratos de precios, alertas y dashboard.
- Contiene:
	- MarketPriceOut,
	- PriceAlertCreate/Out,
	- DashboardSummary,
	- TopMarginProduct,
	- PriceTrendPoint.
- Resultado: respuestas tipadas para vistas analíticas.

### api/app/schemas/__init__.py
- Finalidad: exportación central de schemas.
- Resultado: importaciones más simples en otras capas.

---

## 2.3.6) api/app/services/

### api/app/services/__init__.py
- Estado: vacío.
- Finalidad implícita: marcar paquete.

### api/app/services/product_service.py
- Finalidad: lógica de negocio de inventario y categorías.
- Qué hace:
	- listado paginado con filtros,
	- CRUD de productos,
	- soft delete,
	- gestión básica de categorías.
- Resultado: routers desacoplados de consultas ORM complejas.

### api/app/services/price_service.py
- Finalidad: negocio de precios, alertas y KPIs.
- Qué hace:
	- consulta histórico,
	- guarda snapshots,
	- evalúa alertas,
	- calcula resumen dashboard,
	- calcula top de margen.
- Resultado: capa analítica y de monitorización de valor en backend.

### api/app/services/import_service.py
- Finalidad: importación masiva desde CSV/Excel.
- Qué hace:
	- parseo por formato,
	- mapeo flexible de columnas ES/EN,
	- inserción de productos,
	- retorno de errores por fila.
- Resultado: onboarding de inventario inicial acelerado.

---

## 2.3.7) api/app/scraper/

### api/app/scraper/__init__.py
- Estado: vacío.
- Finalidad implícita: marcar paquete.

### api/app/scraper/base_scraper.py
- Finalidad: contrato base y utilidades compartidas de scraping.
- Qué hace:
	- define dataclass PriceData,
	- cliente HTTP asíncrono,
	- reintentos con tenacity,
	- rate limit común.
- Resultado: base consistente para múltiples fuentes.

### api/app/scraper/bricklink_scraper.py
- Finalidad: scraping de BrickLink.
- Qué obtiene: precio nuevo/usado (cuando disponible).
- Resultado: fuente principal de mercado integrada.

### api/app/scraper/brickeconomy_scraper.py
- Finalidad: scraping de BrickEconomy.
- Qué obtiene: precios detectados en página y rango min/max.
- Resultado: segunda fuente para enriquecimiento de señal de mercado.

### api/app/scraper/ebay_scraper.py
- Finalidad: scraping de eBay ventas completadas.
- Qué obtiene: media de precios de resultados vendidos y rango.
- Resultado: validación complementaria de precio real transaccionado.

### api/app/scraper/runner.py
- Finalidad: orquestación de scraping por producto y global.
- Qué hace:
	- recorre productos activos,
	- ejecuta scrapers por prioridad,
	- persiste snapshots,
	- verifica alertas tras cada producto.
- Resultado: pipeline operacional de captura de mercado.

---

## 2.3.8) api/app/routers/

### api/app/routers/__init__.py
- Estado: vacío.
- Finalidad implícita: marcar paquete.

### api/app/routers/auth.py
- Finalidad: endpoints de autenticación.
- Endpoints:
	- POST /auth/login,
	- POST /auth/refresh.
- Resultado: acceso controlado al panel/API.

### api/app/routers/products.py
- Finalidad: endpoints de inventario.
- Endpoints:
	- listado con filtros/paginación,
	- alta, detalle, edición, borrado lógico,
	- export CSV,
	- importación masiva CSV/Excel.
- Resultado: gestión de inventario completa para V1.

### api/app/routers/categories.py
- Finalidad: endpoints de categorías.
- Endpoints: listado y creación.
- Resultado: taxonomía básica de producto operativa.

### api/app/routers/prices.py
- Finalidad: histórico y scraping manual por producto.
- Endpoints:
	- GET historial,
	- POST trigger scraping en background.
- Resultado: control manual cuando se requiere actualización inmediata.

### api/app/routers/alerts.py
- Finalidad: CRUD básico de alertas activas.
- Endpoints: listar, crear, eliminar.
- Resultado: monitorización por umbrales ya disponible.

### api/app/routers/dashboard.py
- Finalidad: endpoints analíticos para panel.
- Endpoints:
	- summary,
	- top-margin,
	- trigger de scraping completo.
- Resultado: base de KPIs de negocio para toma de decisiones.

---

## 2.4) Directorio docs/

### docs/informe_tecnologico_lego_business.md
- Finalidad: plan maestro tecnológico del negocio por versiones (V1-V6).
- Contenido principal:
	- objetivos por fase,
	- arquitectura global,
	- roadmap de infraestructura y operaciones.
- Resultado: alineación entre estrategia de negocio y ejecución técnica.

### docs/copilot/2026-03-31-guia-lanzamiento-y-uso.md
- Finalidad: manual operativo para desplegar y usar la V1.
- Contenido principal:
	- requisitos,
	- configuración `.env`,
	- arranque Docker/manual,
	- primer uso y troubleshooting.
- Resultado: onboarding técnico rápido para arranque y uso diario.

### docs/superpowers/specs/2026-03-30-legomarkal-v1-design.md
- Finalidad: especificación de diseño de la V1 (arquitectura objetivo y alcance).
- Contenido principal:
	- stack y decisiones,
	- estructura objetivo,
	- diseño de BD,
	- endpoints esperados,
	- definición de UI de panel.
- Resultado: documento de referencia funcional/técnica para implementación.

---

## 2.5) Directorio supabase_prompts/

### supabase_prompts/direct.txt
- Finalidad: guía rápida de conexión directa a BD Supabase.
- Uso: utilitario para asistentes/herramientas durante setup.

### supabase_prompts/Framework.txt
- Finalidad: guía de integración Supabase con framework frontend (ejemplo Next).
- Uso: referencia de boilerplate para cliente server/browser/middleware.

### supabase_prompts/MCP.txt
- Finalidad: instrucciones de alta de servidor MCP de Supabase.
- Uso: facilitar operaciones asistidas por herramientas AI.

### supabase_prompts/ORM.txt
- Finalidad: guía de conexión con ORM (enfoque Prisma).
- Observación: no está alineada con backend actual (SQLAlchemy), sirve más como referencia alternativa.

---

## 3) Información general transversal (no ligada a un único fichero)

## 3.1) Arquitectura funcional actual
- Patrón principal: API-first.
- Frontend previsto consume backend vía HTTP JSON.
- Persistencia en PostgreSQL (Supabase) con SQLAlchemy y migraciones Alembic.
- Seguridad V1: único usuario admin con JWT.

## 3.2) Flujo principal de datos
1. Login admin y obtención de token.
2. Operaciones de inventario vía endpoints protegidos.
3. Scraping manual o automático por scheduler.
4. Persistencia en market_prices.
5. Evaluación de alertas y actualización de last_triggered.
6. Cálculo de KPIs de dashboard a partir de inventario + último precio conocido.

## 3.3) Entidades de dominio clave
- Category: clasificación funcional de artículos.
- Product: unidad inventariable con datos de compra y estado.
- MarketPrice: snapshot temporal por fuente.
- PriceAlert: regla de monitorización por umbral.

## 3.4) Endpoints operativos disponibles
- Auth: login, refresh.
- Inventory: CRUD + filtros + import/export.
- Pricing: histórico + scrape puntual.
- Alerts: alta/listado/baja.
- Dashboard: summary, top-margin, trigger global.

## 3.5) Dependencias externas y puntos de integración
- Supabase PostgreSQL para almacenamiento principal.
- Supabase Storage previsto para imágenes (según diseño, aún no visible en routers de subida).
- Fuentes de mercado: BrickLink, BrickEconomy, eBay.

## 3.6) Ejecución local y operación
- Comando API (contenedor): uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
- Orquestación local: docker-compose (api + admin-panel).
- Scheduler: se arranca en lifecycle de FastAPI automáticamente.

## 3.7) Riesgos y deuda técnica observada
- Auth en localStorage en V1: suficiente para un único usuario admin, pero upgradar a httpOnly cookie en V2 si se abre a más usuarios.
- Endpoint auth refresh: requiere revisión si se añaden refresh tokens explícitos.
- Scraping por HTML: puede romperse ante cambios de marcado en fuentes externas.
- Sin tests en api/tests actualmente.
- ImageUpload asume endpoint `/products/{id}/images` que puede no existir en el router actual (añadir si se necesita gestión de imágenes).
- El Sidebar incluye rutas /prices y /alerts que no estaban en la spec inicial pero se añadieron como páginas de apoyo.

## 3.8) Recomendaciones inmediatas de siguiente iteración
- Arrancar en local: `cd admin-panel && npm install && npm run dev` (requiere API en :8000).
- Crear .env.local desde .env.local.example con la URL del backend.
- Añadir tests mínimos en api/tests: auth, products CRUD, dashboard summary.
- Añadir observabilidad: logs estructurados, métricas scraping.
- Endurecer seguridad: rotación de secretos, cookie httpOnly para token.

## 3.9) Criterios de “V1 utilizable” — Estado actual
- [x] Login admin estable (implementado).
- [x] CRUD de inventario completo (implementado).
- [x] Importación CSV/Excel funcional (implementado).
- [x] Scraping diario funcionando sin intervención (backend implementado).
- [x] Dashboard con KPIs consistentes (implementado).
- [x] Migraciones reproducibles en limpio (Alembic implementado).
- [ ] Validación E2E completa con BD real y scraping en vivo (pendiente de despliegue).
