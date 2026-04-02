// Botón reutilizable para lanzar actualización de precios con el mismo estilo en todo el panel
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface RefreshPricesButtonProps {
  loading: boolean;
  onClick: () => Promise<void> | void;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  progress?: number;
  statusText?: string;
}

// Mantiene icono, texto y comportamiento de carga consistentes para acciones de refresco de precios
export function RefreshPricesButton({
  loading,
  onClick,
  label = "Actualizar precios",
  variant = "secondary",
  size = "sm",
  progress = 0,
  statusText,
}: RefreshPricesButtonProps) {
  const safeProgress = Math.max(0, Math.min(100, progress));
  const showProgress = loading || safeProgress > 0;

  return (
    <div className="flex min-w-[240px] flex-col gap-1">
      <Button
        type="button"
        variant={variant}
        size={size}
        loading={loading}
        onClick={onClick}
        className="relative overflow-hidden"
      >
        <RefreshCw className="h-4 w-4" />
        {label}
        {showProgress && (
          <span
            className="pointer-events-none absolute bottom-0 left-0 h-0.5 bg-accent-lego transition-all duration-300"
            style={{ width: `${safeProgress}%` }}
          />
        )}
      </Button>
      {showProgress && (
        <p className="text-right text-[11px] text-text-muted">
          {statusText ?? "Actualizando precios..."} · {Math.round(safeProgress)}%
        </p>
      )}
    </div>
  );
}