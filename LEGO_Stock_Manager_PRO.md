Aquí tienes el documento completamente reestructurado y reescrito. He eliminado las contradicciones que quedaban de versiones anteriores (como mencionar Render para la BD o MinIO para local) y he centralizado el diseño en la **arquitectura "Zero-Cost"** real, explicando claramente *por qué* se toman estas decisiones para evitar las trampas de los planes gratuitos.

---

# Documento de Arquitectura: LEGO Stock Manager PRO

**Estado:** Propuesta Refinada
**Objetivo:** Convertir LegoMarkal en una aplicación profesional, modular y tolerante a fallos, manteniendo el coste operativo en **0€ a largo plazo**.

---

## 1. Resumen Ejecutivo

El objetivo es evolucionar el core funcional actual (gestión de inventario de LEGO, scraping de precios europeos, y registro de ventas con recibos/métricas) hacia una arquitectura de microservicios ligeros.

Dado que el proyecto operará bajo restricciones de presupuesto (capas gratuitas o *free-tiers*), la arquitectura se ha diseñado específicamente para sortear limitaciones comunes de estos planes, tales como:

* **Falta de RAM (OOM):** Evitando ejecutar navegadores (Playwright) en servidores con memoria limitada.
* **Caducidad de Datos:** Evitando bases de datos gratuitas temporales (ej. Render DB que expira a los 90 días).
* **Pérdida de Archivos:** Implementando almacenamiento en la nube S3-compatible en lugar de discos efímeros locales.

---

## 2. Decisiones de Diseño (Requisitos del Proyecto)

Basado en el análisis de necesidades, la arquitectura responde a los siguientes parámetros:

* **Volumen:** Operación inicial de 30 a 200 sets. Crecimiento futuro hacia cientos.
* **Frecuencia de actualización:** Scraping de precios automatizado 1 vez al día.
* **Persistencia:** Riesgo cero de pérdida de recibos de ventas. Requiere almacenamiento persistente en la nube.
* **Usuarios:** Aplicación single-tenant (un solo administrador) con potencial de vistas públicas en el futuro.
* **Presupuesto:** 100% gratuito.

---

## 3. Arquitectura "Zero-Cost" Definita (El Stack)

Para garantizar resiliencia sin costes, el sistema se divide en servicios desacoplados alojados en plataformas especializadas:

| Componente | Tecnología | Proveedor (Free-Tier) | Justificación Arquitectónica |
| --- | --- | --- | --- |
| **Frontend / UI** | Next.js 14, Tailwind, Shadcn UI | **Vercel** | Rendimiento óptimo, despliegue continuo sin fricción y capa gratuita sobrada para el tráfico esperado. |
| **Backend / API** | FastAPI, SQLAlchemy, Pydantic | **Render** (Web Service) | Gestión de la lógica de negocio. *(Nota: Sufrirá "cold starts" tras 15 min de inactividad, aceptable para uso personal).* |
| **Base de Datos** | PostgreSQL (Serverless) | **Supabase** (o Neon) | Integridad relacional. La capa gratuita **no caduca**, a diferencia de la de Render. |
| **Storage (Recibos)** | Object Storage (API S3) | **Supabase Storage** (o R2) | Almacenamiento persistente y seguro para PDFs/imágenes. Evita la complejidad de autohospedar MinIO. |
| **Scraper Worker** | Playwright (Python/JS) | **GitHub Actions** (Cron) | Aislar el scraper del backend evita que Playwright colapse el servidor de Render por falta de RAM (OOM). |

---

## 4. Diseño Detallado por Módulos

### 4.1. Core API (Backend)

El backend actual mezcla scraping, cron jobs y lógica de negocio. Se refactorizará para ser una API REST pura y *stateless*.

* **Responsabilidades:** Autenticación básica, CRUD de inventario, registro de ventas, cálculo de métricas y generación de presigned-URLs para almacenamiento de archivos.
* **Estandarización:** Uso estricto de Pydantic para validación de datos.
* **Abstracción de Storage:** Creación de un módulo genérico de almacenamiento (app/services/storage.py) usando boto3 (o el SDK de Supabase) para que la lógica de negocio no dependa del proveedor final.

### 4.2. Worker de Scraping (GitHub Actions)

Extraer el scraper de la API es el cambio más crítico para la estabilidad.

* **Flujo:** Un *workflow* de GitHub Actions configurado con un cron se dispara a las 02:00 AM.
* **Ejecución:** Levanta un runner de Ubuntu (con 7GB de RAM gratuitos), ejecuta Playwright, navega, extrae los precios europeos y consolida un JSON.
* **Comunicación:** El runner realiza una petición POST /api/webhooks/sync-prices a la API de Render, enviando el payload con los precios actualizados (protegido por un API Key).

### 4.3. Frontend (UI/UX)

Transición hacia un panel de control corporativo, limpio y robusto.

* **Refactorización:** Migración total a TypeScript estricto. Centralización de llamadas a la API mediante *custom hooks* o *server actions*.
* **Métricas:** Implementación de un Dashboard principal (Valor total de stock, ROI estimado, Sets con mayor rotación, Alertas de precios objetivo).
* **Interacción:** Tablas densas con filtros avanzados para el inventario completo, y vistas de "Ficha de Set" para operaciones rápidas (marcar como vendido, subir recibo).

---

## 5. Plan de Acción y Migración (Fases)

Se propone un enfoque iterativo para no romper la funcionalidad actual en el proceso.

### Fase 0: Limpieza y Preparación (Semana 1)

* **Repositorio:** Mover todos los scripts temporales (take_*.js, tmp_*) a una nueva carpeta tools/.
* **Frontend:** Iniciar migración a TypeScript estricto en los componentes clave.
* **Infraestructura:** Crear el proyecto en Supabase (Base de datos y Storage) y obtener las credenciales.

### Fase 1: Desacoplamiento del Scraper y Storage (Semanas 1-2)

* **Worker:** Extraer la lógica de app/scraper/ a un script independiente. Configurar el *workflow* en .github/workflows/scraper.yml y probar la ejecución aislada.
* **API:** Crear el endpoint protegido (Webhook) para recibir los datos del scraper.
* **Storage:** Implementar el módulo de conexión con Supabase Storage en FastAPI. Eliminar dependencias de almacenamiento local.

### Fase 2: Funcionalidad Core y UI (Semanas 2-3)

* **Ventas:** Implementar el flujo de "Marcar como vendido" con generación/subida de PDF y registro en base de datos.
* **Métricas:** Desarrollar los endpoints de agregación matemática en FastAPI.
* **Dashboard:** Construir las gráficas y KPIs en Next.js.

### Fase 3: Estabilización y CI/CD (Semana 4)

* **Despliegue:** Configurar el CI/CD en GitHub Actions para desplegar automáticamente a Vercel (Frontend) y Render (Backend) al hacer merge en main.
* **Seguridad:** Revisar gestión de variables de entorno y *secrets*.
* **Logs y Alertas:** Configurar logs estructurados y notificaciones básicas por email (vía Resend o capa gratuita de SendGrid) solo para fallos críticos del scraper.

---

## 6. Aplicación práctica al repositorio `LegoMarkal` (plan sin implementación)

Este bloque traduce la propuesta anterior en tareas concretas y priorizadas aplicables directamente sobre el árbol actual del proyecto. Son cambios de arquitectura, refactor y documentación — no incluyen cambios de implementación abajo del capó.

6.1. Repositorio y documentación
- Crear `tools/` o `scripts/dev/` y mover todos los scripts sueltos: `take_*.js`, `debug_login.mjs`, `screenshot.mjs`, `tmp_*`, `__tmp_*`.
- Añadir `docs/README_CONTEXT.md` con: mapa de carpetas, puntos de entrada (`api/app/main.py`, `admin-panel/app`), y cómo ejecutar localmente (venv, .env.example).

6.2. Backend (`api/`)
- Añadir `api/.env.example` con variables clave: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_KEY`, `STORAGE_PROVIDER`, `SCRAPER_API_KEY`.
- Crear `api/app/services/storage.py` con una interfaz documentada (métodos: `save_receipt(file) -> key`, `get_presigned_url(key)`, `delete(key)`) y una implementación stub local (usa `api/uploads/`), documentando que se debe reemplazar por `Supabase Storage` o `R2`.
- Documentar en `docs/scraper.md` el payload esperado por el endpoint `/internal/scraper/import` (ej.: product_id, fetched_at, price_eur, source).
- Añadir endpoint protegido `POST /internal/scraper/import` en `api/app/routers/prices.py` o `api/app/routers/scraper.py` con autenticación por `SCRAPER_API_KEY`.

6.3. Scraper (DevOps)
- Incluir `/.github/workflows/scraper.yml` (documentado en `docs/`) que:
	- Se ejecute en cron diario.
	- Instale dependencias y ejecute el script `api_scraper/run_scraper.py` o `scripts/scraper.js` del repo (separado del backend runtime).
	- Haga POST a `https://<API>/internal/scraper/import` con `SCRAPER_API_KEY` como header.

6.4. Frontend (`admin-panel`)
- Identificar componentes prioritarios para migración a TypeScript: `components/inventory/InventoryTable.tsx`, `components/product/ProductForm.tsx`, `app/login/page.tsx`.
- Añadir `admin-panel/README_DEV.md` con pasos para ejecutar `pnpm dev`, lint y build locales.

6.5. Storage y BD (configuración gratuita)
- Documentar pasos para provisionar un proyecto en Supabase y obtener `SUPABASE_URL`/`SUPABASE_KEY` y `DATABASE_URL`.
- En `docs/deployment.md` incluir pasos para configurar Supabase Storage y política de backups (pg_dump programado con GitHub Actions o script manual).

6.6. CI / Tests
- Añadir plantillas de workflow en `/.github/workflows/`:
	- `backend-tests.yml`: ejecutar `pytest` y terminar con artefactos de cobertura.
	- `frontend-tests.yml`: ejecutar `pnpm install` y `pnpm test` o `pnpm build`.
	- `deploy.yml`: manual/semiautomático para desplegar frontend a Vercel y backend a Render.

6.7. PR / QA checklist (plantilla a incluir en `/.github/PULL_REQUEST_TEMPLATE.md`)
- Título claro.
- Resumen de cambios.
- Lista de archivos movidos/creados.
- Instrucciones para ejecutar localmente los cambios.
- Tests añadidos o pasos manuales de verificación.
- Documentación (`docs/`) actualizada.

6.8. Plan de sprints y entregables (resumen)
- Sprint 0 (2 días): mover scripts, añadir `docs/README_CONTEXT.md`, `api/.env.example`, PR de limpieza.
- Sprint 1 (7–10 días): storage abstraction (stub + docs), endpoint `/internal/scraper/import`, workflow POC de GitHub Actions (scraper).
- Sprint 2 (10–14 días): migración TypeScript de componentes críticos, UI para marcar ventas + subir recibo (front stub), tests básicos.
- Sprint 3 (2 semanas): backups automáticos, tests E2E Playwright (minimales), preparar despliegue producción.

6.9. Riesgos específicos del repo y mitigaciones
- Riesgo: ejecutar Playwright in-host (Render) → Mitigación: GitHub Actions cron.
- Riesgo: datos en DB de Render caducan → Mitigación: usar Supabase/Neon y backups frecuentes.
- Riesgo: archivos en contenedores efímeros → Mitigación: Supabase Storage / R2.

---

Si confirmas, genero ahora el plan de migración detallado (tareas/PRs por sprint) y el `scraper.yml` de ejemplo listo para que lo adaptes (sin secrets). También puedo preparar la PR de limpieza (Sprint 0) que solo mueve archivos y añade docs y `.env.example`.
