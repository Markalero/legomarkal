# Sistema de extracción de datos (scraper) — diseño, funcionamiento y hallazgos

Fecha: 2026-04-14

Resumen
-------

Este documento explica en detalle cómo funciona el sistema de extracción de precios (scrapers), qué hace cada componente, cuándo se ejecuta y los riesgos / fallos detectados durante la revisión del código.

Componentes principales
-----------------------

- Runner y scheduling
  - `api/app/scraper/runner.py` — orquesta consultas a los scrapers y persistencia en BD.
  - `api/app/scheduler.py` — registra un job Cron (por defecto `settings.scraper_schedule_hour`, minuto 0) para ejecutar `scrape_all_products` cada noche.
  - `api/app/main.py` — lifecycle: aplica migraciones, limpia fechas futuras y lanza un `startup scrape` si hoy no hay datos.

- Scrapers
  - `api/app/scraper/base_scraper.py` — cliente HTTP `httpx.AsyncClient`, reintentos (`tenacity`), normalización de números y tokenización.
  - `api/app/scraper/bricklink_scraper.py` — fuente principal; extrae `monthly_history` del Price Guide y precios actuales.
  - `api/app/scraper/brickeconomy_scraper.py` — fuente complementaria, parsea texto libre.
  - `api/app/scraper/ebay_scraper.py` — verificación por ventas completadas (eBay).

- Lógica de negocio / persistencia
  - `api/app/services/price_service.py` — funciones para `save_price`, `save_monthly_history_points`, agregaciones diarias, backfills y endpoints de consulta.
  - `api/app/models/price.py` — modelo `MarketPrice` (columna `fetched_at` es `TIMESTAMP` sin timezone).

Cómo funciona (flujo básico)
---------------------------

1. Scheduler nocturno ejecuta `scrape_all_products` (o el admin puede dispararlo manualmente).
2. `runner._run_scrapers_for_product` instancia el scraper y guarda snapshot diario actual con `price_service.save_price`.
3. En alta/importación de producto (`product_service`), se guarda histórico mensual de 6 meses completos previos (sin mes actual) a cierre de mes.
4. Si el scraper no devuelve suficientes meses históricos, se completa la base de 6 meses con seed mensual para que la gráfica no nazca vacía.
5. Al finalizar refrescos globales, se recalcula la serie agregada de cartera (`portfolio_daily_snapshots`).

Alineación con la especificación solicitada (2026-04-14)
--------------------------------------------------------

Objetivo pedido:

1. Alta/importación: histórico mensual de últimos 6 meses (sin actual), guardado como cierre de mes.
2. Diario 03:00: snapshot actual de todos los productos.
3. Manual "Actualizar precios": mismo flujo diario + recálculo de gráfica global y sobreescritura del día actual.

Estado actual tras ajustes:

- Punto 1: **cumplido**.
   - Se filtra `monthly_history` a los 6 meses completos previos.
   - Si faltan meses, se completa el contexto con seed mensual para mantener 6 puntos de base.
- Punto 2: **cumplido**.
   - `scheduler` diario a las 03:00 y `scrape_all_products` ahora recorre todos los productos con `set_number` (no solo `available`).
- Punto 3: **cumplido**.
   - El botón manual (`/scraper/refresh-all`) ejecuta refresco completo, upsert del día actual y reconstrucción de `portfolio_daily_snapshots`.

Desviación previa detectada y corregida:

- Antes, el scraping nocturno filtraba por `availability == "available"`.
- Ahora se eliminó ese filtro para cumplir "todos los productos".

Endpoints y herramientas operativas
---------------------------------

- `POST /scraper/trigger` — lanza `scrape_all_products` en background.
- `POST /scraper/refresh-all` — ejecuta el refresco síncrono completo (y rebuild de snapshots diarios).
- `POST /scraper/backfill-daily` — (añadido) genera filas diarias interpoladas desde puntos mensuales (útil para enriquecer gráficas).

Hallazgos y posibles fallos detectados
-------------------------------------

1. Mezcla de timezones / aware vs naive (riesgo alto)
   - `MarketPrice.fetched_at` es `TIMESTAMP` (sin timezone). Algunas rutas de escritura persisten fechas naive en hora local de España (`save_price` usa `now_spain.replace(tzinfo=None)`), mientras que otras (p. ej. puntos mensuales en `bricklink_scraper`) generan `datetime(..., tzinfo=timezone.utc)` y se guardan tal cual.
   - Esta mezcla puede provocar que:
     - Las comparaciones por fecha (`cast(MarketPrice.fetched_at, Date) == today_spain`) devuelvan resultados incorrectos (puntos atribuídos al día siguiente o anterior según conversión), lo que explica casos de datos “futuros” o ausentes en el día esperado.
     - `_clean_future_market_prices` elimine filas inesperadas si el timezone hace que una marca UTC caiga en una fecha futura en calendario España.

   Recomendación crítica:
   - Normalizar una única convención: preferible almacenar siempre UTC (aware) o almacenar siempre naive en UTC. Mejor aún: convertir la columna a `TIMESTAMP WITH TIME ZONE` y guardar datetimes en UTC.
   - Ajustar todas las escrituras (`save_price`, `save_monthly_history_points`, backfills) para convertir a UTC antes de persistir; unificar las consultas que comparan por fecha usando funciones de zona horaria para obtener la fecha local de España cuando sea necesario.

2. Fragilidad del parser HTML (riesgo medio)
   - `bricklink_scraper._parse_price_guide` identifica bloques HTML buscando textos concretos y estructura de tablas; cambios menores en BrickLink pueden romper la extracción y dejar `monthly_history` vacío.
   - `brickeconomy_scraper` toma cualquier número razonable del DOM; puede recoger valores erróneos si la página cambia o contiene números irrelevantes.

   Recomendación:
   - Añadir tests unitarios que incluyan HTML de ejemplo (fixtures) para detectar roturas en parsing.
   - Implementar múltiples reglas/fallbacks y logs más verbosos en modo debug para triage rápido.

3. Uso de `tenacity` con función async (riesgo bajo/medio)
   - `BaseScraper.fetch_with_retry` está decorada con `@retry` de `tenacity` sobre una coroutine `async def`. Dependiendo de la versión de `tenacity`, su decorator síncrono puede no soportar correctamente funciones async o perder contexto de excepciones.

   Recomendación:
   - Verificar que la versión instalada de `tenacity` soporta `async` decorators; si no, usar `tenacity.AsyncRetrying` o implementar el retry manualmente con un pequeño bucle `for attempt in range(...)`.

4. Consistencia numérica y tipos (riesgo bajo)
   - En `ebay_scraper` se usa `round(avg, 2)` mezclando `Decimal`/`float` — preferir operaciones con `Decimal` y `quantize(Decimal('0.01'))` para evitar cambios de tipo.

5. Rendimiento y paralelismo (riesgo medio)
   - El runner procesa productos de forma secuencial (espera cada `await _run_scrapers_for_product`), lo que puede alargar el scraping a muchas horas si hay cientos de productos.

   Recomendación:
   - Introducir concurrencia controlada: ejecutar scrapers con un semáforo asíncrono (`asyncio.Semaphore`) y `asyncio.gather` por lotes (p. ej. 10-20 workers). Esto mejora throughput y mantiene control sobre rate limits.

6. Dedupe y backfills (riesgo bajo)
   - La lógica actual intenta mantener una única fila por día (`cast(..., Date)`), y el nuevo backfill que se añadió interpola días. Hay riesgo de que backfill cree filas que luego `save_monthly_history_points` o `save_price` actualicen/eliminen si las reglas de poda (`prune_missing_months`) cambian.

   Recomendación:
   - Documentar claramente la prioridad de fuentes (daily scraper > backfill > monthly history) y establecer pruebas de integridad: al ejecutar backfill, marcar las filas sintéticas con `source='bricklink'` y metadatos si procede, o usar un flag `synthetic=True` (añadir campo si se decide).

Checklist de cambios recomendados (ordenados por prioridad)
-------------------------------------------------------

1. (Crítico) Unificar manejo de zonas horarias: elegir UTC storage o `TIMESTAMP WITH TIME ZONE`; adaptar `save_price`, `save_monthly_history_points`, consultas y `_clean_future_market_prices`.
2. (Alto) Añadir tests unitarios de parsing para BrickLink/BrickEconomy/eBay con HTML de ejemplo.
3. (Alto) Revisar/asegurar uso correcto de `tenacity` con async o reemplazar por retry manual.
4. (Medio) Paralelizar el runner con concurrencia limitada (semáforo) para reducir tiempo total de scraping.
5. (Medio) Corregir uso de `round()` con `Decimal` (usar `quantize`).
6. (Bajo) Añadir flag `synthetic` o `source` explícito para distinguir filas backfilled de filas reales.

Pruebas recomendadas manuales y scripts
--------------------------------------

- Fixture unit test: guardar muestras de HTML de BrickLink price guide y verificar que `_parse_price_guide` retorna `monthly_history` con fechas esperadas.
- Test de integración: ejecutar `scrape_by_set` para un set conocido y revisar las filas creadas en `market_prices`.
- Test timezone: simular un punto mensual con `tzinfo=UTC` y comprobar que `cast(..., Date)` en consultas produce la fecha esperada para España (`Europe/Madrid`).

Operaciones de mantenimiento y alertas a vigilar
----------------------------------------------

- Logs: aumentar nivel DEBUG temporalmente en `bricklink_scraper` y en `price_service.save_monthly_history_points` cuando se detecten anomalías.
- Monitorizar discrepancias entre `cast(fetched_at, Date)` y la fecha esperada en España en un dashboard de salud (p. ej. número de filas "futuras" eliminadas en `_clean_future_market_prices`).

Cómo y cuándo actúa el sistema
-------------------------------

- Ejecución diaria automática: `scheduler` lanza scraping nocturno a la hora configurada (`settings.scraper_schedule_hour`).
- Startup: si al arrancar no hay precios para la fecha actual se ejecuta un scrape en background para garantizar datos del día actual.
- Manual: admin puede forzar `POST /scraper/trigger` o `POST /scraper/refresh-all` desde el panel.
- Backfill histórico: `POST /scraper/backfill-daily` (endpoint añadido) para rellenar días intermedios a partir de `monthly_history`.

Archivo con cambios relacionados
-------------------------------

- Código revisado durante el análisis:
  - `api/app/scraper/runner.py`
  - `api/app/scraper/bricklink_scraper.py`
  - `api/app/scraper/base_scraper.py`
  - `api/app/services/price_service.py` (añadido backfill daily)
  - `api/app/routers/dashboard.py` (endpoint `backfill-daily` añadido)

Conclusión rápida
-----------------

El sistema ya captura `monthly_history` y snapshots diarios, pero la mezcla de timezones y algunos manejos frágiles de parsing son las causas probables de los problemas observados en las gráficas (solo puntos mensuales + día actual). Recomiendo empezar por unificiar el manejo de timezones y añadir tests de parsing; después se puede paralelizar el runner y endurecer las reglas de persistencia para evitar que backfills o monthly snapshots sobrescriban datos reales.

¿Qué quieres que haga a continuación?

- Puedo aplicar la normalización UTC mínima (convertir todos los `fetched_at` a UTC antes de persistir) y añadir tests de parsing básicos.
- O ejecutar ahora un `POST /scraper/backfill-daily?months=6` en tu entorno para generar las filas de ejemplo (necesitaré credenciales/admin JWT si el servidor está protegido).

Fin del documento.
