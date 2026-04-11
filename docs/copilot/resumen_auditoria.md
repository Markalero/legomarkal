# Resumen de auditoría — LegoMarkal

Fecha: 2026-04-11

Propósito: recoger todo el análisis, pruebas y hallazgos realizados durante la auditoría del scraping, scheduler, persistencia histórica y su repercusión en frontend/backend.

---

## 1. Resumen de la conversación

- Objetivo principal: diagnosticar por qué faltan snapshots diarios entre 2026-04-03 y 2026-04-11 y por qué existe un punto con fecha futura el 2026-04-30; auditar scraping, scheduler, base de datos y sincronización entre Render, Supabase y Vercel.
- Acciones realizadas: revisión de código y documentación, ejecución de pruebas unitarias, llamadas a la API de producción, consultas SQL directas contra la base de datos, ejecución local de scrapers, arranque del backend local, inspección del frontend desplegado y comprobación visual en la UI.
- Resultado: recopilación de evidencia concreta (filas en BD, salidas de scraper, logs del scheduler, fallos de tests) y creación de recomendaciones priorizadas.

## 2. Fundamento técnico

- Backend: FastAPI con `uvicorn`. Scheduler implementado con APScheduler en proceso (BackgroundScheduler) arrancado en el lifespan de la app.
- Base de datos: PostgreSQL en Supabase. Algunos accesos directos eliminaron el parámetro `pgbouncer=true` para conexiones directas.
- Scraper: parser de BrickLink (price guide + fallback a tablas) que genera `monthly_history` poniendo `fetched_at` al último segundo del mes (`YYYY-MM-DD 23:59:59`).
- Frontend: Next.js (Vercel). Admin panel consume la API (Render) y muestra las series de precios con la máxima fecha encontrada en los datos.
- Tests: suite `pytest` para scrapers; se detectaron 3 tests fallando en parsing/casos de moneda (RON/EUR).

## 3. Estado del código relevante

- `api/app/scraper/bricklink_scraper.py`:
  - Función principal `_parse_price_guide(...)` produce `monthly_history` con entradas con `fetched_at` = último día/23:59:59.
  - No hay validación explícita para rechazar puntos con fecha futura respecto a la fecha de ejecución.

- `api/app/scheduler.py` y `api/app/main.py`:
  - Scheduler en memoria arrancado por el proceso web; job programado con `CronTrigger(hour=settings.scraper_schedule_hour, minute=0)`.
  - `misfire_grace_time=3600` (1h). En PaaS con reinicios, esto es frágil.

- `api/app/services/price_service.py`:
  - `save_monthly_history_points(...)` inserta/upsertea puntos; no valida fechas futuras.
  - `rebuild_daily_snapshots_from_market_history()` se llama en lectura (p. ej. al pedir tendencias) y rehace snapshots, lo cual provoca trabajo pesado y efectos secundarios en consultas GET.

- Admin panel (Next.js): `PriceChart.tsx` y componentes consumen la serie tal cual; si existe un punto futuro se muestra en la UI.

## 4. Problemas detectados

- Falta de snapshots diarios entre 2026-04-03 y 2026-04-11 en `market_prices`.
- Una fila con fecha futura: `fetched_at = 2026-04-30 23:59:59` para el set `9495-1` (producto asociado), que también provocó un `portfolio_daily_snapshot` con fecha 2026-04-30.
- Scheduler en memoria: susceptible a reinicios del servicio (Render) y a pérdidas de las ejecuciones programadas.
- El parser genera puntos mensuales que pueden corresponder a un mes posterior (o mal etiquetado) y se insertan sin validación, permitiendo introducir fechas fuera de rango (p. ej. final de mes futuro).
- No existe un CHECK a nivel de BD que impida insertar fechas futuras.
- Rebuild de snapshots en lectura: provoca re-cómputos y efectos colaterales cuando se consulta la API.

## 5. Evidencias y pasos reproducibles (resumen de operaciones realizadas)

- Lectura de `.env`: `SCRAPER_SCHEDULE_HOUR=3`.
- Consultas SQL contra producción (ejemplos):
  - `market_prices`: total=37, min_ts=2025-06-30 23:59:59, max_ts=2026-04-30 23:59:59, future_rows=1.
  - Abril 2026: entradas solo en 2026-04-02 y 2026-04-30.
  - `portfolio_daily_snapshots`: filas en abril para 2026-04-02, 2026-04-11 y 2026-04-30.
  - Días faltantes detectados: 2026-04-03 → 2026-04-11 (ambos inclusive).

- Identificación de la fila futura: producto con `set_number = '9495-1'`, `fetched_at = 2026-04-30 23:59:59`, `price_used = 33.58`.

- Llamadas a la API de producción:
  - `/health` → ok.
  - `/auth/login` → token válido.
  - `/market-prices/{product}` y `/dashboard/price-trends` → devuelven historiales que incluyen 2026-04-30.

- Ejecución local del scraper sobre `9495-1`: devuelve `monthly_history` con punto 2026-04-30 (mes de abril presente). Los valores provinieron del bloque USD en el Price Guide.

- Ejecución de `pytest`: mayoría de tests pasan; 3 tests fallan relacionados con parsing de BrickLink y manejo de RON/EUR.

- Inspección UI (Vercel): el dashboard y la página de producto muestran el punto 30/4/2026.

## 6. Causas raíz (hipótesis verificadas)

- Runs del scheduler perdidos o no ejecutados para los días 2026-04-03 → 2026-04-11 (scheduler en proceso con posibilidad de reinicios).
- Parser produce puntos mensuales que pueden corresponder a un mes posterior (o mal etiquetado) y se insertan sin validación, permitiendo introducir fechas fuera de rango.
- Ausencia de validación a nivel servicio y de restricciones a nivel BD para evitar fechas futuras.

## 7. Recomendaciones priorizadas

1. Bloquear inmediatamente la inserción de puntos con fecha futura:
   - Añadir validación en `_parse_price_guide()` / `save_monthly_history_points()` para ignorar/filtrar entradas con `fetched_at.date() > hoy` (tomando zona horaria España si procede).
   - Añadir una restricción a nivel BD: `CHECK (fetched_at::date <= CURRENT_DATE)` o equivalente, tras coordinar ventana de despliegue.

2. Remediación de datos en producción (inmediato o planificado):
   - Eliminar filas futuras identificadas (ej. la fila 2026-04-30) y forzar rebuild seguro de snapshots.
   - Alternativa segura: marcar filas futuras como `ignored_by_audit=true` y re-evaluar.

3. Robustecer el scheduler:
   - Usar jobstore persistente (DB-backed APScheduler) o migrar a scheduler externo (cron manager en la plataforma, Cloud Scheduler, o worker cron en segundo proceso).
   - Añadir monitoreo/alertas si un job programado no se ejecuta.

4. Evitar rebuild-on-read:
   - No rehacer snapshots en la capa de lectura; mover a jobs programados o a actualizaciones incrementales tras insertar nuevos `market_prices`.

5. Tests y parser:
   - Corregir los 3 tests fallidos de parsing (RON/EUR) y ampliar cobertura para casos mixtos de moneda y bloques de Price Guide.

6. Observabilidad y seguridad:
   - Añadir logs, métricas y alertas para scrapers fallidos.
   - Revisar secretos en repositorio/tests y rotarlos si es necesario.

## 8. Progreso y estado actual

- Hecho:
  - Mapeo del código y componentes relevantes.
  - Consultas y pruebas en producción y local para reproducir el problema.
  - Ejecución del scraper que reprodujo el punto 2026-04-30.
  - Ejecución de `pytest` (3 tests fallando identificados).
  - Generación de recomendaciones priorizadas.

- Pendiente:
  - Aplicar cambios de código para evitar puntos futuros.
  - Ejecutar limpieza de datos en producción (eliminar/ajustar filas futuras y reconstruir snapshots).
  - Migración o endurecimiento del scheduler.

## 9. Plan de continuación sugerido (pasos concretos)

1. Implementar la validación de fecha en el ingest (parser/service) y cubrirlo con tests.
2. Desplegar la validación a staging; ejecutar el scraper sobre sets problemáticos para garantizar que no re-ingesta filas futuras.
3. Ejecutar la limpieza controlada en producción (DELETE filas futuras) y lanzar un job para reconstruir snapshots desde `market_prices` válidos.
4. Migrar scheduler a jobstore persistente o externalizar la programación; añadir alertas si una ejecución falla.
5. Corregir y endurecer tests de parsing.

---

Si necesitas, puedo:

- Preparar el patch de código para filtrar entradas con fecha futura (PR listo para revisión).
- Generar el SQL seguro para eliminar las filas futuras y el script para rehacer snapshots.
- Proponer y aplicar una configuración DB-backed para APScheduler o un plan para mover la programación fuera del proceso web.

---

Archivo generado desde la auditoría automática y las ejecuciones en local/producción. Para cualquier acción de escritura en producción, confirmar ventana de mantenimiento y respaldos.
