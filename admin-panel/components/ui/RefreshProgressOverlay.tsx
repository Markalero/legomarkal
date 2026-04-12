// Overlay de progreso reutilizable para operaciones de refresco de precios
import { RefreshCw } from "lucide-react";

interface RefreshProgressOverlayProps {
  visible: boolean;
  status: string;
  progress: number;
}

export function RefreshProgressOverlay({ visible, status, progress }: RefreshProgressOverlayProps) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[1px]">
      <div className="animate-zoom-in-fade rounded-xl border border-border bg-bg-card px-5 py-4 text-center shadow-xl">
        <p className="text-sm font-medium text-text-primary">Actualizando precios…</p>
        <RefreshCw className="mx-auto mt-3 h-12 w-12 animate-spin text-accent-lego" />
        <p className="mt-3 text-xs text-text-muted">
          {status || "Sincronizando datos"} · {Math.round(progress)}%
        </p>
      </div>
    </div>
  );
}
