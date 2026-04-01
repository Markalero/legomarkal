// Componente Badge para estados: success, warning, error, info, neutral
import { cn } from "@/lib/utils";

type BadgeVariant = "success" | "warning" | "error" | "info" | "neutral";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: "bg-status-success/15 text-status-success",
  warning: "bg-status-warning/15 text-status-warning",
  error: "bg-status-error/15 text-status-error",
  info: "bg-accent-info/15 text-accent-info",
  neutral: "bg-bg-elevated text-text-secondary",
};

export function Badge({ variant = "neutral", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
