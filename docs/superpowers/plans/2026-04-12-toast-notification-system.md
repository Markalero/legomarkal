# Toast Notification System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar un sistema de notificaciones flotantes (toasts) reutilizable y conectarlo a las acciones relevantes de la app, corrigiendo el bug de descarga de backup e incorporando progreso por fases para la exportación.

**Architecture:** `ToastContext` + `useToast()` gestionan la cola de notificaciones; `ToastContainer` renderiza los toasts en posición `fixed bottom-right`; las páginas usan `useToast()` para disparar notificaciones de éxito/error/progreso sin dependencias circulares. El `ToastProvider` se coloca en `app/layout.tsx` para cobertura global.

**Tech Stack:** React Context API, Next.js 14 App Router, Tailwind CSS (tokens ya definidos en tailwind.config.ts), lucide-react

---

## Mapa de archivos

| Operación | Archivo |
|---|---|
| Create | `admin-panel/lib/toast-context.tsx` |
| Create | `admin-panel/components/ui/Toast.tsx` |
| Create | `admin-panel/components/ui/ToastContainer.tsx` |
| Modify | `admin-panel/tailwind.config.ts` |
| Modify | `admin-panel/app/layout.tsx` |
| Modify | `admin-panel/app/(auth)/inventory/page.tsx` |
| Modify | `admin-panel/app/(auth)/alerts/page.tsx` |
| Modify | `admin-panel/app/(auth)/inventory/new/page.tsx` |
| Modify | `admin-panel/app/(auth)/inventory/[id]/edit/page.tsx` |
| Modify | `admin-panel/app/(auth)/inventory/[id]/page.tsx` |

---

## Task 1: Añadir animación `slide-in-right` a Tailwind

**Files:**
- Modify: `admin-panel/tailwind.config.ts`

- [ ] **Step 1: Añadir keyframe y clase de animación**

En `tailwind.config.ts`, dentro de `theme.extend.keyframes` añadir:

```ts
"slide-in-right": {
  from: { opacity: "0", transform: "translateX(20px)" },
  to: { opacity: "1", transform: "translateX(0)" },
},
```

Dentro de `theme.extend.animation` añadir:

```ts
"slide-in-right": "slide-in-right 0.2s ease-out both",
```

- [ ] **Step 2: Commit**

```bash
rtk git add admin-panel/tailwind.config.ts
rtk git commit -m "feat: add slide-in-right animation for toast notifications"
```

---

## Task 2: Crear `toast-context.tsx` — contexto, provider y hooks

**Files:**
- Create: `admin-panel/lib/toast-context.tsx`

- [ ] **Step 1: Crear el archivo con el contexto completo**

```tsx
// Contexto global para el sistema de notificaciones flotantes (toasts)
"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";

export type ToastType = "success" | "error" | "info" | "warning" | "progress";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  phase?: string;       // solo para type "progress"
  progress?: number;    // 0-100, solo para type "progress"
  completed?: boolean;  // true cuando el progress toast ha terminado
  duration?: number;    // ms hasta auto-dismiss; undefined = no auto-dismiss
}

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, "id">) => string;
  updateToast: (id: string, updates: Partial<Omit<ToastItem, "id">>) => void;
  dismissToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

/** Provider global — colocar en app/layout.tsx */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counterRef = useRef(0);

  const addToast = useCallback((toast: Omit<ToastItem, "id">): string => {
    const id = `toast-${++counterRef.current}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    if (toast.duration) {
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), toast.duration);
    }
    return id;
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<Omit<ToastItem, "id">>) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    if (updates.duration) {
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), updates.duration);
    }
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, updateToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  );
}

/**
 * Hook para disparar notificaciones desde cualquier componente cliente.
 * Devuelve métodos tipados para cada variante.
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de ToastProvider");
  const { addToast, updateToast, dismissToast } = ctx;

  return {
    /** Notificación verde, auto-dismiss a los 4s */
    success: (message: string, duration = 4000) =>
      addToast({ type: "success", message, duration }),

    /** Notificación roja, persiste hasta cierre manual */
    error: (message: string) =>
      addToast({ type: "error", message }),

    /** Notificación azul, auto-dismiss a los 4s */
    info: (message: string, duration = 4000) =>
      addToast({ type: "info", message, duration }),

    /** Notificación amarilla, auto-dismiss a los 5s */
    warning: (message: string, duration = 5000) =>
      addToast({ type: "warning", message, duration }),

    /** Toast de progreso con barra animada. Devuelve el ID para actualizarlo. */
    progress: (message: string, phase?: string): string =>
      addToast({ type: "progress", message, phase, progress: 0 }),

    /** Actualiza el porcentaje y el texto de fase de un toast de progreso */
    update: (id: string, progress: number, phase: string) =>
      updateToast(id, { progress, phase }),

    /** Marca el toast de progreso como completado y lo auto-descarta en 5s */
    complete: (id: string, message: string) =>
      updateToast(id, { message, progress: 100, completed: true, phase: undefined, duration: 5000 }),

    /** Cierra manualmente un toast por su ID */
    dismiss: dismissToast,
  };
}

/** Hook usado por ToastContainer para leer la cola sin exponer mutaciones */
export function useToastState() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToastState debe usarse dentro de ToastProvider");
  return { toasts: ctx.toasts, dismissToast: ctx.dismissToast };
}
```

- [ ] **Step 2: Commit**

```bash
rtk git add admin-panel/lib/toast-context.tsx
rtk git commit -m "feat: add ToastContext, ToastProvider and useToast hook"
```

---

## Task 3: Crear `Toast.tsx` — componente individual

**Files:**
- Create: `admin-panel/components/ui/Toast.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
// Componente visual de una notificación flotante individual
"use client";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToastItem } from "@/lib/toast-context";

const ICON_MAP: Record<string, React.ReactNode> = {
  success: <CheckCircle className="h-4 w-4 text-status-success shrink-0" />,
  error: <AlertCircle className="h-4 w-4 text-status-error shrink-0" />,
  info: <Info className="h-4 w-4 text-accent-info shrink-0" />,
  warning: <AlertTriangle className="h-4 w-4 text-status-warning shrink-0" />,
  progress: <Download className="h-4 w-4 text-accent-lego shrink-0" />,
};

const BORDER_MAP: Record<string, string> = {
  success: "border-status-success/30",
  error: "border-status-error/30",
  info: "border-accent-info/30",
  warning: "border-status-warning/30",
  progress: "border-accent-lego/30",
};

interface Props {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

export function Toast({ toast, onDismiss }: Props) {
  const isProgressCompleted = toast.type === "progress" && toast.completed;
  const borderClass = isProgressCompleted ? BORDER_MAP.success : BORDER_MAP[toast.type];
  const icon = isProgressCompleted ? ICON_MAP.success : ICON_MAP[toast.type];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "relative flex w-80 flex-col gap-2 overflow-hidden rounded-xl border bg-bg-card p-4 shadow-2xl animate-slide-in-right",
        borderClass
      )}
    >
      {/* Cabecera: icono + mensaje + botón de cierre */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          {icon}
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary leading-snug">{toast.message}</p>
            {toast.phase && (
              <p className="text-xs text-text-muted mt-0.5 truncate">{toast.phase}</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Cerrar notificación"
          className="shrink-0 rounded-md p-0.5 text-text-muted hover:text-text-primary transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Barra de progreso — solo en toasts de progreso no completados */}
      {toast.type === "progress" && !toast.completed && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-elevated">
          <div
            className="h-full bg-accent-lego transition-all duration-700 ease-out"
            style={{ width: `${toast.progress ?? 0}%` }}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
rtk git add admin-panel/components/ui/Toast.tsx
rtk git commit -m "feat: add Toast UI component with progress bar support"
```

---

## Task 4: Crear `ToastContainer.tsx` — contenedor global

**Files:**
- Create: `admin-panel/components/ui/ToastContainer.tsx`

- [ ] **Step 1: Crear el componente contenedor**

```tsx
// Contenedor global de notificaciones flotantes — posición fixed bottom-right
"use client";
import { useToastState } from "@/lib/toast-context";
import { Toast } from "./Toast";

export function ToastContainer() {
  const { toasts, dismissToast } = useToastState();
  if (toasts.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Notificaciones"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} onDismiss={dismissToast} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
rtk git add admin-panel/components/ui/ToastContainer.tsx
rtk git commit -m "feat: add ToastContainer fixed bottom-right"
```

---

## Task 5: Integrar provider y contenedor en el layout raíz

**Files:**
- Modify: `admin-panel/app/layout.tsx`

- [ ] **Step 1: Actualizar layout.tsx**

Reemplazar el contenido completo del archivo:

```tsx
// Layout raíz — aplica fuente, meta y estilos globales
import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/lib/toast-context";
import { ToastContainer } from "@/components/ui/ToastContainer";

export const metadata: Metadata = {
  title: "LegoMarkal Admin",
  description: "Panel de gestión de inventario y precios de mercado LEGO",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen">
        <a href="#main-content" className="skip-link">
          Saltar al contenido principal
        </a>
        <ToastProvider>
          {children}
          <ToastContainer />
        </ToastProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verificar que la app arranca sin errores**

```bash
cd admin-panel && npx next build 2>&1 | head -30
```

Resultado esperado: sin errores de tipo ni de compilación.

- [ ] **Step 3: Commit**

```bash
rtk git add admin-panel/app/layout.tsx
rtk git commit -m "feat: integrate ToastProvider and ToastContainer in root layout"
```

---

## Task 6: Corregir bug de exportación y conectar toasts en `inventory/page.tsx`

**Files:**
- Modify: `admin-panel/app/(auth)/inventory/page.tsx`

Este task cubre 4 cambios en el mismo archivo:
1. Corrección del bug de descarga (anchor sin DOM)
2. Toast de progreso por fases para exportar backup
3. Toast de éxito tras importar backup
4. Toast de éxito tras reset total
5. Deshabilitar botón "Resetear" mientras se exporta

- [ ] **Step 1: Añadir import de `useToast` y estado `exportLoading`**

Al principio del archivo, añadir el import:

```ts
import { useToast } from "@/lib/toast-context";
```

Dentro de `InventoryPage()`, después de la línea con `useRefreshProgress`, añadir:

```ts
const [exportLoading, setExportLoading] = useState(false);
const toast = useToast();
```

- [ ] **Step 2: Reemplazar la función `handleExport` completa**

Localizar la función `handleExport` (líneas ~142-156) y reemplazarla por:

```ts
async function handleExport() {
  setExportLoading(true);
  const toastId = toast.progress("Exportando backup…", "Conectando con la base de datos…");

  // Animación predictiva por fases mientras espera la respuesta de Supabase
  let currentPct = 0;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const phases = [
    { upTo: 20, label: "Conectando con la base de datos…", msPerStep: 15 },
    { upTo: 85, label: "Obteniendo datos de Supabase…", msPerStep: 80 },
  ];
  let phaseIdx = 0;

  function advancePhase() {
    if (phaseIdx >= phases.length) return;
    const phase = phases[phaseIdx];
    intervalId = setInterval(() => {
      currentPct++;
      toast.update(toastId, currentPct, phase.label);
      if (currentPct >= phase.upTo) {
        clearInterval(intervalId!);
        intervalId = null;
        phaseIdx++;
        advancePhase();
      }
    }, phase.msPerStep);
  }

  advancePhase();

  try {
    const blob = await productsApi.exportAllData();

    // Detener animación predictiva y saltar a fase final
    if (intervalId) clearInterval(intervalId);
    toast.update(toastId, 95, "Preparando archivo…");

    // Corrección del bug: el <a> debe estar en el DOM para disparar la descarga
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `legomarkal_backup_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 150);

    toast.complete(toastId, "Backup descargado");
  } catch (e: unknown) {
    if (intervalId) clearInterval(intervalId);
    toast.dismiss(toastId);
    const uiError = toUiError(e, "No se pudo exportar el backup completo.");
    toast.error(uiError.message);
    setError(uiError.message);
    setErrorDetails(uiError.details ?? null);
  } finally {
    setExportLoading(false);
  }
}
```

- [ ] **Step 3: Añadir toast de éxito en `handleResetAllData`**

Localizar `handleResetAllData`. Justo después de `setSettingsOpen(false);` (que ya existe), añadir:

```ts
toast.success("Todos los datos han sido eliminados");
```

- [ ] **Step 4: Deshabilitar el botón "Exportar" y "Resetear" durante la exportación**

Localizar el botón "Exportar backup (JSON)" en el JSX (línea ~307) y añadir `loading` y `disabled`:

```tsx
<Button
  variant="secondary"
  size="sm"
  onClick={handleExport}
  loading={exportLoading}
  disabled={exportLoading}
>
  <Download className="h-4 w-4" />
  {exportLoading ? "Exportando…" : "Exportar backup (JSON)"}
</Button>
```

Localizar el botón "Resetear todos los datos" y añadir `disabled`:

```tsx
<Button
  variant="danger"
  size="sm"
  disabled={exportLoading}
  onClick={() => {
    setSettingsOpen(false);
    setResetOpen(true);
  }}
>
  <Trash2 className="h-4 w-4" />
  Resetear todos los datos
</Button>
```

- [ ] **Step 5: Añadir toast en el callback de éxito del BulkImport**

Localizar la prop `onSuccess` del componente `<BulkImport>` (~línea 290):

```tsx
<BulkImport
  onSuccess={() => {
    setImportOpen(false);
    toast.success("Backup importado correctamente");
    load(filters);
  }}
/>
```

- [ ] **Step 6: Añadir toast de error en `handleToggleAvailability`**

En el bloque `catch` de `handleToggleAvailability`, después de `setError`/`setErrorDetails`, añadir:

```ts
toast.error(uiError.message);
```

- [ ] **Step 7: Commit**

```bash
rtk git add "admin-panel/app/(auth)/inventory/page.tsx"
rtk git commit -m "fix: repair backup download bug and add progress toast with predictive phases"
```

---

## Task 7: Conectar toasts en `alerts/page.tsx`

**Files:**
- Modify: `admin-panel/app/(auth)/alerts/page.tsx`

- [ ] **Step 1: Añadir import de `useToast`**

```ts
import { useToast } from "@/lib/toast-context";
```

Dentro de `AlertsPage()`, después de los `useState`:

```ts
const toast = useToast();
```

- [ ] **Step 2: Añadir toast en `handleDelete`**

En `handleDelete`, después de `setAlerts((prev) => ...)` y `setDeleteCandidate(null)`, añadir:

```ts
toast.success("Alerta eliminada");
```

En el bloque `catch`, después de `setError`/`setErrorDetails`:

```ts
toast.error(uiError.message);
```

- [ ] **Step 3: Añadir toast en `handleCreate`**

En `handleCreate`, después de `setThresholdValue("")`, añadir:

```ts
toast.success("Alerta creada correctamente");
```

En el bloque `catch`, después de `setError`/`setErrorDetails`:

```ts
toast.error(uiError.message);
```

- [ ] **Step 4: Commit**

```bash
rtk git add "admin-panel/app/(auth)/alerts/page.tsx"
rtk git commit -m "feat: add toast notifications for alert create/delete actions"
```

---

## Task 8: Añadir toast en creación de producto (`new/page.tsx`)

**Files:**
- Modify: `admin-panel/app/(auth)/inventory/new/page.tsx`

- [ ] **Step 1: Añadir import de `useToast`**

```ts
import { useToast } from "@/lib/toast-context";
```

Dentro de `NewProductPage()`, después de los estados:

```ts
const toast = useToast();
```

- [ ] **Step 2: Añadir toast antes del redirect en `onSubmit`**

Localizar `router.push("/inventory")` y sustituir por:

```ts
toast.success("Producto creado correctamente");
router.push("/inventory");
```

- [ ] **Step 3: Commit**

```bash
rtk git add "admin-panel/app/(auth)/inventory/new/page.tsx"
rtk git commit -m "feat: add success toast on product creation"
```

---

## Task 9: Añadir toast en edición de producto (`edit/page.tsx`)

**Files:**
- Modify: `admin-panel/app/(auth)/inventory/[id]/edit/page.tsx`

- [ ] **Step 1: Añadir import de `useToast`**

```ts
import { useToast } from "@/lib/toast-context";
```

Dentro de `EditProductPage()`, después de los estados:

```ts
const toast = useToast();
```

- [ ] **Step 2: Añadir toast antes del redirect en `handleSubmit`**

Localizar `router.push(...)` y sustituir por:

```ts
toast.success("Cambios guardados");
router.push(`/inventory/${params.id}`);
```

- [ ] **Step 3: Commit**

```bash
rtk git add "admin-panel/app/(auth)/inventory/[id]/edit/page.tsx"
rtk git commit -m "feat: add success toast on product edit save"
```

---

## Task 10: Conectar toasts en la ficha de producto (`[id]/page.tsx`)

**Files:**
- Modify: `admin-panel/app/(auth)/inventory/[id]/page.tsx`

- [ ] **Step 1: Añadir import de `useToast`**

```ts
import { useToast } from "@/lib/toast-context";
```

Dentro del componente, después de los `useState`:

```ts
const toast = useToast();
```

- [ ] **Step 2: Añadir toast antes del redirect en `handleDelete`**

Localizar `router.push("/inventory")` en `handleDelete` y sustituir por:

```ts
toast.success("Producto eliminado");
router.push("/inventory");
```

- [ ] **Step 3: Añadir toast en `handleCreateAlert`**

En `handleCreateAlert`, después de `setAlertThreshold("")` y antes de `await load()`, añadir:

```ts
toast.success("Alerta creada correctamente");
```

Añadir también bloque `catch` si no existe (actualmente `handleCreateAlert` no captura errores):

Localizar `handleCreateAlert` completo y reemplazarlo por:

```ts
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
    toast.success("Alerta creada correctamente");
    await load();
  } catch (e: unknown) {
    const uiError = toUiError(e, "No se pudo crear la alerta.");
    toast.error(uiError.message);
  } finally {
    setCreatingAlert(false);
  }
}
```

Asegurarse de que `toUiError` está importado desde `@/lib/utils` (si no lo está, añadirlo al import existente).

- [ ] **Step 4: Commit**

```bash
rtk git add "admin-panel/app/(auth)/inventory/[id]/page.tsx"
rtk git commit -m "feat: add toast notifications for product delete and alert creation in product detail"
```

---

## Task 11: Actualizar `README_CONTEXT.md`

**Files:**
- Modify: `admin-panel/.Claude/README_CONTEXT.md`

- [ ] **Step 1: Actualizar la sección de últimos cambios**

Al inicio del fichero `README_CONTEXT.md`, actualizar la fecha y añadir:

```markdown
Fecha de actualización: 2026-04-12 (sistema de notificaciones flotantes toast: ToastContext, useToast, Toast, ToastContainer; corrección bug exportación backup; progreso predictivo por fases para descarga desde Supabase; toasts de éxito/error en alertas, productos, importación y reset)
```

Añadir en el árbol de componentes UI:
```
│  │  ├─ Toast.tsx             # Componente individual de notificación flotante
│  │  └─ ToastContainer.tsx    # Contenedor fixed bottom-right de toasts
```

Añadir en la sección de lib:
```
│  ├─ toast-context.tsx        # Context, ToastProvider, useToast, useToastState
```

- [ ] **Step 2: Commit**

```bash
rtk git add ".Claude/README_CONTEXT.md"
rtk git commit -m "docs: update README_CONTEXT with toast system and backup fix"
```

---

## Self-Review

### Spec coverage
- ✅ Bug de descarga corregido (anchor en DOM, revokeObjectURL deferido)
- ✅ Toast de progreso con fases predictivas para exportación
- ✅ Botón "Exportar" disabled + loading durante la descarga
- ✅ Botón "Resetear" disabled durante la descarga
- ✅ Resto de acciones del modal disponibles durante la descarga
- ✅ Notificación flotante bottom-right con progreso y texto de fase
- ✅ Botón X en cada toast
- ✅ Auto-dismiss 5s tras completar el progreso
- ✅ Toast de éxito en: importar backup, reset total, crear alerta, eliminar alerta, crear producto, editar producto, eliminar producto
- ✅ Toast de error en: toggle disponibilidad, crear/eliminar alerta, crear alerta en ficha

### Placeholder scan
- Sin TBDs ni TODOs en el código del plan
- Todos los bloques de código son completos y autocontenidos

### Type consistency
- `ToastItem` (interfaz) usado en `toast-context.tsx`, `Toast.tsx` (import de `@/lib/toast-context`)
- `useToast()` devuelve `{ success, error, info, warning, progress, update, complete, dismiss }`
- `useToastState()` devuelve `{ toasts: ToastItem[], dismissToast: (id: string) => void }`
- `toast.complete(id, message)` llama `updateToast(id, { ..., duration: 5000 })` — el timeout de auto-dismiss está en `updateToast`, que comprueba `updates.duration` ✅
