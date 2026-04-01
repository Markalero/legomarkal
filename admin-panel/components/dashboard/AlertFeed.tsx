// Feed de alertas activas con estado visual por tipo
import { Bell, TrendingUp, TrendingDown, Percent } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PriceAlert } from "@/types";

interface AlertFeedProps {
  alerts: PriceAlert[];
}

const alertConfig = {
  PRICE_ABOVE: {
    label: "Precio por encima",
    icon: TrendingUp,
    badge: "warning" as const,
  },
  PRICE_BELOW: {
    label: "Precio por debajo",
    icon: TrendingDown,
    badge: "info" as const,
  },
  PRICE_CHANGE_PCT: {
    label: "Cambio %",
    icon: Percent,
    badge: "neutral" as const,
  },
};

export function AlertFeed({ alerts }: AlertFeedProps) {
  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-text-muted">
        <Bell className="h-8 w-8 opacity-30" />
        <p className="text-sm">Sin alertas activas</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {alerts.map((alert) => {
        const config = alertConfig[alert.alert_type];
        const Icon = config.icon;
        return (
          <li
            key={alert.id}
            className="flex items-start gap-3 rounded-lg border border-border bg-bg-elevated px-4 py-3"
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant={config.badge}>{config.label}</Badge>
                {alert.last_triggered && (
                  <span className="text-xs text-text-muted">
                    Disparada {formatDate(alert.last_triggered)}
                  </span>
                )}
              </div>
              <p className="mt-1 truncate text-sm text-text-secondary">
                {alert.product?.name ?? alert.product_id} —{" "}
                <span className="text-text-primary font-medium">
                  {alert.alert_type === "PRICE_CHANGE_PCT"
                    ? `${alert.threshold_value}%`
                    : formatCurrency(alert.threshold_value)}
                </span>
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
