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
}

// Mantiene icono, texto y comportamiento de carga consistentes para acciones de refresco de precios
export function RefreshPricesButton({
  loading,
  onClick,
  label = "Actualizar precios",
  variant = "secondary",
  size = "sm",
}: RefreshPricesButtonProps) {
  return (
    <Button type="button" variant={variant} size={size} loading={loading} onClick={onClick}>
      <RefreshCw className="h-4 w-4" />
      {label}
    </Button>
  );
}