// Componente visual de una notificación flotante individual
"use client";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToastItem } from "@/lib/toast-context";

const ICON_MAP: Record<string, React.ReactNode> = {
  success: <CheckCircle className="h-4 w-4 text-status-success shrink-0 mt-0.5" />,
  error:   <AlertCircle  className="h-4 w-4 text-status-error shrink-0 mt-0.5" />,
  info:    <Info         className="h-4 w-4 text-accent-info shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="h-4 w-4 text-status-warning shrink-0 mt-0.5" />,
  progress: <Download   className="h-4 w-4 text-accent-lego shrink-0 mt-0.5" />,
};

const BORDER_MAP: Record<string, string> = {
  success:  "border-status-success/30",
  error:    "border-status-error/30",
  info:     "border-accent-info/30",
  warning:  "border-status-warning/30",
  progress: "border-accent-lego/30",
};

interface Props {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

export function Toast({ toast, onDismiss }: Props) {
  const isProgressCompleted = toast.type === "progress" && toast.completed;
  // Un toast de progreso completado cambia a icono y borde verde
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
