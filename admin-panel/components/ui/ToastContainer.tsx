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
