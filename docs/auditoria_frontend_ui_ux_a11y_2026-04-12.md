# Auditoria Frontend UI/UX y Accesibilidad (A11Y)

Fecha: 2026-04-12
Proyecto: LegoMarkal admin-panel
Auditor: Copilot (GPT-5.3-Codex)

## 1) Alcance y metodologia

Esta auditoria combina:
- Revision estatica de rutas y componentes del frontend.
- Recorrido de flujos y acciones/botones en ejecucion local (Next.js en localhost:3000).
- Analisis visual de pantallas capturadas: login, dashboard, inventario, modal de configuracion, precios, alertas y alta de producto.

Limitacion detectada durante la prueba:
- El backend no estaba disponible en `http://localhost:8011`, por lo que no se pudieron validar flujos con datos reales (historicos, tablas pobladas, estados de venta con contenido real).
- Aun asi, se pudo auditar estructura, navegacion, estados vacios/error, componentes y experiencia visual.

## 2) Flujos revisados (acciones y botones)

### Autenticacion
- `app/login/page.tsx`
- Acciones: email, password, submit "Iniciar sesion".

### Shell autenticado y navegacion
- `app/(auth)/layout.tsx`, `components/layout/Sidebar.tsx`, `components/layout/Header.tsx`
- Acciones: links de menu, logout, botones de accion por pantalla.

### Dashboard
- `app/(auth)/dashboard/page.tsx`
- Acciones: "Actualizar precios", refresco grafico interno, lectura KPI, alert feed.

### Inventario (listado)
- `app/(auth)/inventory/page.tsx`
- `components/inventory/FilterBar.tsx`
- `components/inventory/InventoryTable.tsx`
- Acciones: buscar, filtrar, paginar, abrir detalle por fila, cambiar disponibilidad, abrir modal de ajustes, export/import, alta nueva.

### Inventario (alta rapida)
- `app/(auth)/inventory/new/page.tsx`
- Acciones: formulario completo y submit.

### Inventario (detalle y edicion)
- `app/(auth)/inventory/[id]/page.tsx`
- `app/(auth)/inventory/[id]/edit/page.tsx`
- `components/product/ProductForm.tsx`, `components/product/ImageUpload.tsx`, `components/product/PriceHistory.tsx`, `components/product/SaleReceiptList.tsx`, `components/inventory/SaleModal.tsx`
- Acciones: editar, eliminar, toggle disponibilidad, crear alerta, refrescar precio, subir imagenes, abrir lightbox, descargar/borrar recibos.

### Precios
- `app/(auth)/prices/page.tsx`
- `components/ui/ChartRangeSelector.tsx`
- Acciones: actualizar precios, cambiar rango de grafica, seleccionar producto en tabla.

### Alertas
- `app/(auth)/alerts/page.tsx`
- Acciones: crear alerta rapida, borrar alerta, lectura de estado.

### Componentes base UI
- `components/ui/Button.tsx`, `Input.tsx`, `Modal.tsx`, `ConfirmModal.tsx`, `Lightbox.tsx`, `RefreshProgressOverlay.tsx`

## 3) Hallazgos priorizados

## P0 - Critico (A11Y y uso con teclado/screen reader)

1. Modales sin semantica completa de dialog y sin gestion robusta de foco
- Evidencia:
  - `components/ui/Modal.tsx:16` (no `role="dialog"`, no `aria-modal`, no `aria-labelledby`)
  - `components/ui/Modal.tsx:46` (boton de cierre icon-only sin nombre accesible)
- Impacto: usuarios con lector de pantalla o teclado pueden perder contexto dentro del modal.
- Cambio propuesto:
  - Añadir `role="dialog"`, `aria-modal="true"`, `aria-labelledby` enlazado al titulo.
  - Trap de foco dentro del modal.
  - Devolver foco al trigger al cerrar.
  - `aria-label="Cerrar modal"` en boton iconico.

2. Inputs sin asociacion accesible de error (`aria-invalid`, `aria-describedby`)
- Evidencia: `components/ui/Input.tsx:41` muestra texto de error, pero sin enlazarlo al input.
- Impacto: lector de pantalla no anuncia errores de forma fiable.
- Cambio propuesto:
  - Si hay error: `aria-invalid="true"` y `aria-describedby` al id del mensaje.
  - Añadir id estable para texto de error.

3. Filas clicables en tabla no navegables con teclado
- Evidencia:
  - `components/inventory/InventoryTable.tsx:141` (`onClick` en `tr`)
  - `app/(auth)/prices/page.tsx:712` (`onClick` en `tr`)
- Impacto: no se puede activar seleccion/entrada por teclado (tab solo llega a elementos interactivos).
- Cambio propuesto:
  - Mover accion a un boton/link explicito "Ver detalle" o
  - Implementar `tabIndex=0` + `onKeyDown` (Enter/Espacio) y rol adecuado.

4. Toggle de disponibilidad sin semantica de switch
- Evidencia: `app/(auth)/inventory/[id]/page.tsx:219` y `:223`.
- Impacto: el control se percibe visualmente como switch, pero no expone `aria-checked`/`role="switch"`.
- Cambio propuesto:
  - Usar `role="switch"`, `aria-checked`, `aria-label` dinamico.

5. Nesting interactivo invalido (`Link` + `Button`)
- Evidencia: `app/(auth)/inventory/page.tsx:159-160`.
- Impacto: comportamiento inconsistente en lectores/teclado y validacion HTML.
- Cambio propuesto:
  - Usar un solo elemento interactivo (link estilizado como boton, o boton con `router.push`).

## P1 - Alto (UX, robustez, consistencia)

6. Errores de API no manejados de forma uniforme (aparecen errores runtime)
- Evidencia:
  - `app/(auth)/alerts/page.tsx:24-29` (try/finally sin catch en `load`)
  - `app/(auth)/inventory/page.tsx:33-41` (mismo patron)
- Impacto: overlays de error en runtime y experiencia inestable.
- Cambio propuesto:
  - Captura de error en `load` + estado `error` visible y accion de reintento.

7. Mensajes de error muy tecnicos para usuario final
- Evidencia visual: banners con URL interna (`http://localhost:8011`).
- Impacto: ruido tecnico y menor confianza.
- Cambio propuesto:
  - Mensaje amigable + detalle tecnico en bloque colapsable.
  - CTA directo: "Reintentar" y "Abrir estado del sistema".

8. Acciones destructivas inconsistentes (modal custom vs `confirm()` nativo)
- Evidencia: `components/product/SaleReceiptList.tsx:31`.
- Impacto: experiencia inconsistente y menos control de copy/estilo/a11y.
- Cambio propuesto:
  - Sustituir por `ConfirmModal` reutilizable.

9. Selector de rango de grafica sin estado ARIA
- Evidencia: `components/ui/ChartRangeSelector.tsx:23`.
- Impacto: usuario SR no sabe opcion activa.
- Cambio propuesto:
  - `aria-pressed` por boton o `role="radiogroup"` + `role="radio"`.

10. Sin patron mobile para sidebar (layout fijo)
- Evidencia:
  - `app/(auth)/layout.tsx:32` (`flex h-screen overflow-hidden`)
  - `components/layout/Sidebar.tsx:40` (`w-56` fija)
- Impacto: riesgo de viewport estrecho inutilizable, especialmente en mobile.
- Cambio propuesto:
  - Sidebar colapsable/off-canvas en `< lg` con boton hamburguesa.

## P2 - Medio (calidad visual y legibilidad)

11. Contraste de texto "muted" insuficiente para texto pequeno
- Evidencia de tokens:
  - `text-muted #71717A` sobre `bg-card #141416`: contraste aprox 3.81:1.
  - `text-muted #71717A` sobre `bg-elevated #1C1C1F`: contraste aprox 3.52:1.
- Impacto: incumple AA para cuerpo pequeno (objetivo 4.5:1).
- Cambio propuesto:
  - Subir luminancia de `text-muted` (ejemplo objetivo >= 4.5:1).

12. Tablas sin `caption` ni `scope` en headers
- Evidencia:
  - `components/inventory/InventoryTable.tsx:98-110`
  - `app/(auth)/prices/page.tsx:690-700`
  - `app/(auth)/alerts/page.tsx:162-170`
- Impacto: navegacion SR menos clara.
- Cambio propuesto:
  - Añadir `caption` descriptivo y `scope="col"` en `th`.

13. Falta de "skip link" al contenido principal
- Evidencia: no existe atajo visible en layout.
- Impacto: navegacion con teclado mas lenta en todas las pantallas.
- Cambio propuesto:
  - Incluir "Saltar al contenido" al inicio del documento.

## 4) Observaciones visuales (basadas en capturas)

1. Login
- Fortalezas: jerarquia clara, CTA principal visible, card compacta.
- Mejora: feedback de error deberia ser `aria-live` para anuncio inmediato.

2. Dashboard
- Fortalezas: layout limpio y consistente con branding.
- Mejora: en estado vacio/error quedan grandes bloques oscuros sin accion directa; incluir CTA de reintento y guia contextual.

3. Inventario
- Fortalezas: toolbar clara, filtros visibles, acciones principales ubicadas arriba.
- Mejora: estado de carga con poco contexto ("Cargando..."); proponer skeleton de tabla y placeholder de filas.

4. Modal de configuracion
- Fortalezas: buen contraste y estructura por secciones.
- Mejora: semantica dialog/foco y nombre accesible del cierre.

5. Precios
- Fortalezas: separacion grafica/tabla correcta.
- Mejora: botones de rango deben indicar estado activo para SR y teclado con semantica completa.

6. Alertas
- Fortalezas: formulario rapido muy directo.
- Mejora: dropdowns e input numerico necesitan labels explicitos para lectura secuencial y errores.

7. Alta de producto
- Fortalezas: formulario ordenado en grid y buen espaciado.
- Mejora: estandarizar formato de fecha/locale visual y ayuda contextual por campo obligatorio.

## 5) Propuesta de mejoras por sprint

## Sprint 1 (Quick wins, 2-4 dias)
- Modal accesible (role/aria/foco).
- Input accesible (aria-invalid/aria-describedby).
- Unificar confirmaciones destructivas con `ConfirmModal`.
- Captura de errores consistente en `load()` de paginas.
- Ajuste de token de color `text-muted` para AA.

## Sprint 2 (Navegacion y tablas, 3-5 dias)
- Filas clicables -> accion explicita accesible.
- `caption` + `scope` en tablas.
- `ChartRangeSelector` con estado ARIA.
- Skip link global.

## Sprint 3 (Responsive y refinamiento UX, 4-7 dias)
- Sidebar responsive (off-canvas mobile).
- Estados vacios/carga con placeholders utiles y CTAs.
- Mensajeria de error orientada a usuario (menos tecnica).

## 6) Checklist de aceptacion A11Y (objetivo minimo)

- Todo modal abre con foco interno y devuelve foco al cerrar.
- Todo input con error expone `aria-invalid=true` y descripcion enlazada.
- Toda accion principal es operable con teclado (Tab + Enter/Espacio).
- Toda tabla tiene caption y cabeceras con scope.
- Contraste de texto normal >= 4.5:1.
- Controles icon-only tienen `aria-label`.

## 7) Nota final

El frontend tiene buena base visual y coherencia de diseno. Las mejoras propuestas se concentran en:
- Accesibilidad semantica (screen reader/teclado).
- Robustez de estados de error y carga.
- Consistencia UX en acciones criticas.
- Preparacion responsive real para mobile.
