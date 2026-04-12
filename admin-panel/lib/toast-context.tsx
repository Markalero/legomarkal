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
 * Devuelve métodos tipados para cada variante de toast.
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de ToastProvider");
  const { addToast, updateToast, dismissToast } = ctx;

  return {
    /** Notificación verde, auto-dismiss a los 4s por defecto */
    success: (message: string, duration = 4000) =>
      addToast({ type: "success", message, duration }),

    /** Notificación roja, persiste hasta cierre manual */
    error: (message: string) =>
      addToast({ type: "error", message }),

    /** Notificación azul, auto-dismiss a los 4s por defecto */
    info: (message: string, duration = 4000) =>
      addToast({ type: "info", message, duration }),

    /** Notificación amarilla, auto-dismiss a los 5s por defecto */
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
