// Página de gestión de alertas de precio activas
"use client";
import { useEffect, useState, useCallback } from "react";
import { Trash2, Bell, BellPlus } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { alertsApi, productsApi } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PriceAlert, Product } from "@/types";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [productId, setProductId] = useState("");
  const [alertType, setAlertType] = useState<"PRICE_ABOVE" | "PRICE_BELOW" | "PRICE_CHANGE_PCT">("PRICE_BELOW");
  const [thresholdValue, setThresholdValue] = useState("");
  const productNameById = new Map(products.map((p) => [p.id, p]));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await alertsApi.list();
      setAlerts(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    async function loadProducts() {
      try {
        const pageSize = 200;
        let page = 1;
        let pages = 1;
        const all: Product[] = [];

        while (page <= pages) {
          const response = await productsApi.list({ page, size: pageSize });
          all.push(...response.items);
          pages = response.pages;
          page += 1;
        }

        all.sort((a, b) => a.name.localeCompare(b.name));
        setProducts(all);
      } catch {
        setProducts([]);
      }
    }

    loadProducts();
  }, []);

  async function handleDelete(id: string) {
    await alertsApi.delete(id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleCreate() {
    if (!productId || !thresholdValue) return;
    setCreating(true);
    try {
      const created = await alertsApi.create({
        product_id: productId,
        alert_type: alertType,
        threshold_value: Number(thresholdValue),
      });
      setAlerts((prev) => [created, ...prev]);
      setThresholdValue("");
    } finally {
      setCreating(false);
    }
  }

  const alertTypeLabel: Record<string, string> = {
    PRICE_ABOVE: "Precio por encima de",
    PRICE_BELOW: "Precio por debajo de",
    PRICE_CHANGE_PCT: "Cambio de precio %",
  };

  return (
    <div className="flex flex-col">
      <Header
        title="Alertas de precio"
        description={`${alerts.filter((a) => a.is_active).length} alertas activas`}
      />

      <div className="flex-1 p-6">
        <Card className="mb-6 border-accent-lego/30 bg-accent-lego/5">
          <div className="mb-3 flex items-center gap-2">
            <BellPlus className="h-4 w-4 text-accent-lego" />
            <p className="text-sm font-medium text-text-primary">Crear alerta rápidamente</p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary"
            >
              <option value="">Selecciona producto</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.set_number ? `${product.set_number} - ` : ""}{product.name}
                </option>
              ))}
            </select>
            <select
              value={alertType}
              onChange={(e) =>
                setAlertType(e.target.value as "PRICE_ABOVE" | "PRICE_BELOW" | "PRICE_CHANGE_PCT")
              }
              className="rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary"
            >
              <option value="PRICE_BELOW">Precio por debajo de</option>
              <option value="PRICE_ABOVE">Precio por encima de</option>
              <option value="PRICE_CHANGE_PCT">Cambio de precio (%)</option>
            </select>
            <input
              type="number"
              value={thresholdValue}
              onChange={(e) => setThresholdValue(e.target.value)}
              placeholder={alertType === "PRICE_CHANGE_PCT" ? "Umbral %" : "Umbral €"}
              className="rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary"
            />
            <Button
              type="button"
              onClick={handleCreate}
              loading={creating}
              disabled={!productId || !thresholdValue}
            >
              Crear alerta
            </Button>
          </div>
        </Card>

        {loading ? (
          <div className="space-y-3 py-2">
            <div className="h-16 animate-pulse rounded-xl border border-border bg-bg-card" />
            <div className="h-16 animate-pulse rounded-xl border border-border bg-bg-card" />
            <div className="h-16 animate-pulse rounded-xl border border-border bg-bg-card" />
            <div className="flex items-center justify-center py-4 text-sm text-text-muted">
              Cargando alertas…
            </div>
          </div>
        ) : alerts.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 py-16">
            <Bell className="h-10 w-10 text-text-muted opacity-30" />
            <p className="text-text-muted">Sin alertas configuradas.</p>
            <p className="text-xs text-text-muted">
              Crea alertas desde la ficha de cada producto.
            </p>
          </Card>
        ) : (
          <Card padded={false}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-elevated text-left text-xs text-text-muted uppercase tracking-wider">
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">Tipo de alerta</th>
                  <th className="px-4 py-3">Umbral</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Último disparo</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {alerts.map((alert) => (
                  <tr
                    key={alert.id}
                    className="hover:bg-bg-elevated/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-text-primary max-w-48 truncate">
                      {productNameById.get(alert.product_id)?.name ?? alert.product?.name ?? "Producto no disponible"}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {alertTypeLabel[alert.alert_type] ?? alert.alert_type}
                    </td>
                    <td className="px-4 py-3 font-medium text-text-primary">
                      {alert.alert_type === "PRICE_CHANGE_PCT"
                        ? `${alert.threshold_value}%`
                        : formatCurrency(alert.threshold_value)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={alert.is_active ? "success" : "neutral"}>
                        {alert.is_active ? "Activa" : "Inactiva"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-text-muted text-xs">
                      {formatDate(alert.last_triggered)}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:text-status-error"
                        onClick={() => handleDelete(alert.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
}
