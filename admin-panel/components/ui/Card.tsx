// Componente Card: contenedor con fondo bg-card y borde sutil
import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  /** Añade padding interior estándar */
  padded?: boolean;
}

export function Card({ children, className, padded = true }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-bg-card",
        padded && "p-5",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-center justify-between", className)}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3 className={cn("text-sm font-medium text-text-secondary uppercase tracking-wider", className)}>
      {children}
    </h3>
  );
}
