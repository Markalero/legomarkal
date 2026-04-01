// Tarjeta KPI con valor principal y delta-indicator (variación vs período anterior)
import { Card } from "@/components/ui/Card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string;
  /** Variación porcentual vs período anterior (+5.2 / -3.1 / null) */
  delta?: number | null;
  icon?: React.ReactNode;
  description?: string;
}

export function KpiCard({ title, value, delta, icon, description }: KpiCardProps) {
  const deltaPositive = delta !== null && delta !== undefined && delta > 0;
  const deltaNegative = delta !== null && delta !== undefined && delta < 0;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
          {title}
        </p>
        {icon && <span className="text-text-muted">{icon}</span>}
      </div>

      <div className="flex items-end justify-between gap-2">
        <p className="text-2xl font-bold text-text-primary">{value}</p>

        {delta !== null && delta !== undefined && (
          <span
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              deltaPositive && "text-status-success",
              deltaNegative && "text-status-error",
              !deltaPositive && !deltaNegative && "text-text-muted"
            )}
          >
            {deltaPositive && <TrendingUp className="h-3.5 w-3.5" />}
            {deltaNegative && <TrendingDown className="h-3.5 w-3.5" />}
            {!deltaPositive && !deltaNegative && <Minus className="h-3.5 w-3.5" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>

      {description && (
        <p className="text-xs text-text-muted">{description}</p>
      )}
    </Card>
  );
}
