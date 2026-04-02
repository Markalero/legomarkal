@copilot

# Plan: tareas a completar antes de comenzar V2

## Objetivo
Preparar el proyecto para lanzar la Versión 2 (tienda propia / sincronización de venta) garantizando estabilidad, seguridad y la infraestructura mínima necesaria para integrar pagos, fichas públicas y sincronización de stock.

## Resumen ejecutivo (1 frase)
Asegurar que V1 es estable, observable y testeado; definir API pública y contratos de sincronización; preparar infra de almacenamiento y pagos; y crear pruebas E2E y checklist de despliegue.

## Checklist priorizada (orden y motivo)
- 1) Tests y CI (prioridad alta):
  - Añadir tests unitarios e integración para: auth, products CRUD, importación masiva, endpoints públicos (`GET /shop/products`, `POST /orders`).
  - Crear un pipeline CI (GitHub Actions) que ejecute linters y tests en cada PR.
- 2) Backups y datos seed (alta):
  - Validar scripts de seed (`api/scripts/seed_example_data.py`, `reset_and_seed_real_sets.py`).
  - Añadir procedimientos de backup y restauración para la BD (dump automatizado en staging).
- 3) Observabilidad y alertas (alta):
  - Añadir logging estructurado en backend y endpoints de health/metrics.
  - Monitorizar scheduler/scraper y crear alertas (email/Slack) para fallos o bloqueos por rate-limit.
- 4) Hardening de seguridad (alta):
  - Revisar manejo de JWT (migrar a httpOnly cookie si se prevé multi-usuario) y rotación de secretos.
  - Revisar políticas CORS y límites de tamaño de upload. Auditar endpoints de imágenes.
- 5) Infraestructura de imágenes (media):
  - Preparar integración con S3/Cloudinary para producción y migración de `/uploads` locales.
  - Añadir CDN/optimización de imágenes y versionado de URLs.
- 6) Preparación de la API pública de tienda (alta):
  - Definir y documentar contratos OpenAPI para: `GET /shop/products`, `GET /shop/products/{id}`, `POST /orders`, webhooks de pago, y callback de envío.
  - Asegurar paginación, filtros, y campos públicos (sin datos sensibles: purchase_price, purchase_source deben ocultarse).
- 7) Pagos y facturación (alta/medio):
  - Crear cuenta Stripe (modo test) y flujo de integración (`POST /orders/{id}/payment`).
  - Diseñar flujo de pedidos: creación, reserva de stock (lock short-time), pago, confirmación y despublicación.
  - Evaluar proveedor de facturación (Holded/Billin) para V3–V5 y anotar requisitos legales locales.
- 8) Channel model & availability (alta):
  - Revisar y ajustar modelo de disponibilidad: `availability` vs `is_listed` y añadir tabla `channel_listings` si se prevé multicanal inmediato.
  - Definir transacción atómica para reserva/descuentos de stock durante checkout.
- 9) Webhooks y confirmaciones (media):
  - Implementar webhooks para Stripe y para plataformas externas (cuando se integren). Asegurar reintentos idempotentes.
- 10) Pruebas E2E y staging (alta):
  - Crear entorno de staging con DB seed y storage replicado.
  - Implementar tests E2E: flujo público (ver producto, añadir al carrito, checkout test Stripe, ver venta en admin y despublicación).
- 11) Rendimiento y límites (media):
  - Revisar queries pesadas (dashboard, historial precios) y aplicar paginación server-side, índices DB y cache en Redis si hace falta.
- 12) Documentación y operativa (alta):
  - Actualizar `docs/informe_tecnologico_lego_business.md` y `.Claude/README_CONTEXT.md` con contratos de API y runbook de despliegue.
  - Crear playbook de incidents: cómo restaurar BD, cómo relanzar scraper y cómo regenerar thumbnails.

## Estimaciones rápidas (por bloque)
- Tests + CI: 2–4 días.
- Observabilidad + backups: 1–2 días.
- Seguridad + auth: 1–2 días.
- API pública + contratos: 2 días.
- Stripe + flujo pedidos: 2–4 días.
- Staging + E2E: 2–3 días.
- Total aproximado (iterativo, mínimo): 10–17 días hombre.

## Entregables mínimos antes de V2 (Definition of Ready)
- Suite de tests con cobertura esencial y pipeline CI verde.
- Entorno de staging con seed reproducible.
- API pública documentada (OpenAPI) con endpoints para catálogo y creación de pedidos.
- Integración Stripe en modo test y flujo de reserva de stock implementado.
- Uploads preparados para producción (S3/Cloudinary) y comprobado en staging.
- Runbook operativo para despliegue y rollback.

## Riesgos y mitigaciones rápidas
- Scraper bloqueado → Mitigación: preferir API oficiales y añadir backoff + alertas.
- Overselling durante checkout → Mitigación: implementar lock/transactional reserve y check final al confirmar pago.
- Fuga de secretos → Mitigación: usar secret manager (env prod) y rotación.

## Próximos pasos inmediatos (acciónable ahora)
1. Crear pipeline CI básico que ejecute `pytest` y linters. (Yo puedo crear GitHub Actions si quieres.)
2. Implementar tests mínimos para `auth` y `products` y comprobar en CI.
3. Definir OpenAPI parcial para los endpoints de tienda y revisar en PR.

---

Archivo generado automáticamente para `@copilot` — si quieres, aplico alguno de los puntos ahora (tests/CI/OpenAPI/Stripe).
