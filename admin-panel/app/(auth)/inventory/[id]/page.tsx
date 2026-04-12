// Ficha de producto — galería, datos, historial de precios y alertas
"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Edit, Trash2, Tag, BellPlus } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RefreshPricesButton } from "@/components/ui/RefreshPricesButton";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Badge } from "@/components/ui/Badge";
import { SaleModal } from "@/components/inventory/SaleModal";
import { SaleReceiptList } from "@/components/product/SaleReceiptList";
import { PriceHistory } from "@/components/product/PriceHistory";
import { ImageUpload } from "@/components/product/ImageUpload";
import { productsApi, pricesApi, alertsApi } from "@/lib/api-client";
import {
  formatCurrency,
  formatDate,
  conditionLabel,
  calcMarginPct,
  formatPct,
  toUiError,
} from "@/lib/utils";
import { useToast } from "@/lib/toast-context";
import type { Product, PriceAlert, ProductPriceHistory } from "@/types";

interface Props {
  params: { id: string };
}

/** Etiquetas legibles para tipos de alerta */
const ALERT_LABELS: Record<string, string> = {
  PRICE_ABOVE: "Precio por encima de",
  PRICE_BELOW: "Precio por debajo de",
  PRICE_CHANGE_PCT: "Cambio de precio (%)",
};

export default function ProductDetailPage({ params }: Props) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [priceHistory, setPriceHistory] = useState<ProductPriceHistory | null>(null);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [scraping, setScraping] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [creatingAlert, setCreatingAlert] = useState(false);
  const [alertType, setAlertType] = useState<"PRICE_ABOVE" | "PRICE_BELOW" | "PRICE_CHANGE_PCT">("PRICE_BELOW");
  const [alertThreshold, setAlertThreshold] = useState<string>("");
  const [sellModalOpen, setSellModalOpen] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    const [p, ph, al] = await Promise.all([
      productsApi.get(params.id),
      pricesApi.trend(params.id, 6),
      alertsApi.list(),
    ]);
    setProduct(p);
    setPriceHistory(ph);
    setAlerts(al.filter((a) => a.product_id === params.id));
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  async function handleScrape() {
    setScraping(true);
    try {
      await pricesApi.scrape(params.id); 
      await load();
    } finally {
      setScraping(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await productsApi.delete(params.id);
      toast.success("Producto eliminado");
      router.push("/inventory");
    } finally {
      setDeleting(false);
    }
  }

  /** Abre el modal de venta si está disponible; revierte a disponible si ya está vendido */
  function handleToggleAvailability() {
    if (!product) return;
    if (product.availability === "available") {
      setSellModalOpen(true);
    } else {
      productsApi
        .update(params.id, { availability: "available", sold_price: null, sold_date: null })
        .then(setProduct);
    }
  }

  async function handleCreateAlert() {
    if (!alertThreshold) return;
    setCreatingAlert(true);
    try {
      await alertsApi.create({
        product_id: params.id,
        alert_type: alertType,
        threshold_value: Number(alertThreshold),
      });
      setAlertThreshold("");
      toast.success("Alerta creada correctamente");
      await load();
    } catch (e: unknown) {
      const uiError = toUiError(e, "No se pudo crear la alerta.");
      toast.error(uiError.message);
    } finally {
      setCreatingAlert(false);
    }
  }

  if (!product) {
    return (
      <div className="flex items-center justify-center py-24 text-text-muted text-sm">
        Cargando…
      </div>
    );
  }

  const latestPrice = product.latest_market_price ?? null;

  // Preferir el último precio no nulo del `priceHistory` que coincida con la
  // condición del producto (SEALED vs OPEN). Si no hay ninguno, caer atrás al
  // `latest_market_price` almacenado en `product`.
  function findLastPriceFromHistory() {
    if (!priceHistory || !priceHistory.points || priceHistory.points.length === 0) return null;
    const cond = product?.condition ?? priceHistory.condition ?? null;
    for (let i = priceHistory.points.length - 1; i >= 0; i--) {
      const p = priceHistory.points[i];
      const v = cond === "SEALED" ? p.price_new ?? null : p.price_used ?? null;
      if (v != null) return { price: v, date: p.date };
    }
    return null;
  }

  const phLast = findLastPriceFromHistory();
  const latestByCondition = product.condition === "SEALED"
    ? (latestPrice?.price_new ?? null)
    : (latestPrice?.price_used ?? null);
  const marketPrice = phLast?.price ?? latestByCondition;
  const sourceLabel = phLast ? "Historial" : latestPrice?.source ?? null;
  const sourceDate = phLast ? phLast.date : latestPrice?.fetched_at ?? null;
  const isSold = product.availability === "sold";
  const marginPct = isSold
    ? calcMarginPct(product.purchase_price, product.sold_price)
    : calcMarginPct(product.purchase_price, marketPrice);

  // Campos del panel de detalles — adapta etiquetas según disponibilidad
  const detailFields = [
    { label: "Tema", value: product.theme },
    { label: "Año", value: product.year_released },
    { label: "Cantidad", value: product.quantity },
    { label: "Precio compra", value: formatCurrency(product.purchase_price) },
    { label: "Fecha compra", value: formatDate(product.purchase_date) },
    { label: "Fuente compra", value: product.purchase_source },
    isSold
      ? { label: "Vendido", value: formatDate(product.sold_date) }
      : { label: "Añadido", value: formatDate(product.created_at) },
    ...(isSold && product.sold_price != null
      ? [{ label: "Precio venta", value: formatCurrency(product.sold_price) }]
      : []),
  ];

  return (
    <div className="flex flex-col">
      <Header
        title={product.name}
        description={product.set_number ? `Set ${product.set_number}` : undefined}
        backHref="/inventory"
        actions={<RefreshPricesButton loading={scraping} onClick={handleScrape} />}
      />

      <div className="flex-1 space-y-6 p-6 animate-slide-up-fade">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Columna izquierda: datos */}
          <div className="space-y-6 lg:col-span-2">
            {/* Datos del producto */}
            <Card>
              <CardHeader>
                <CardTitle>Detalles</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={isSold ? "error" : "success"}>
                    <Tag className="mr-1 h-3 w-3" />
                    {isSold ? "Vendido" : "Disponible"}
                  </Badge>
                  {product.condition && (
                    <Badge variant="neutral">{conditionLabel(product.condition)}</Badge>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push(`/inventory/${params.id}/edit`)}
                  >
                    <Edit className="h-4 w-4" />
                    Editar
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => setConfirmDeleteOpen(true)} loading={deleting}>
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </Button>
                </div>
              </CardHeader>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
                {detailFields.map(({ label, value }) => (
                  <div key={label}>
                    <dt className="text-text-muted">{label}</dt>
                    <dd className="mt-0.5 text-text-primary">{value ?? "—"}</dd>
                  </div>
                ))}
              </dl>

              {/* Toggle de disponibilidad — siempre visible */}
              <div className="mt-4 border-t border-border pt-4">
                <div className="flex items-end justify-between gap-3">
                  {product.notes && (
                    <p className="text-sm text-text-secondary">{product.notes}</p>
                  )}
                  <div className="ml-auto flex flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={handleToggleAvailability}
                      role="switch"
                      aria-checked={!isSold}
                      aria-label={isSold ? "Marcar como disponible" : "Marcar como vendido"}
                      className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${
                        isSold ? "bg-status-error" : "bg-status-success"
                      }`}
                      title="Alternar disponibilidad"
                    >
                      <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                          isSold ? "translate-x-7" : "translate-x-1"
                        }`}
                      />
                    </button>
                    <p className="text-xs text-text-muted">
                      {isSold ? "Vendido" : "Disponible"}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Historial de precios */}
            <Card>
              <CardHeader>
                <CardTitle>Historial de precios de mercado</CardTitle>
              </CardHeader>
              {priceHistory ? (
                <PriceHistory
                  history={priceHistory}
                  soldPrice={product.sold_price ?? undefined}
                  soldDate={product.sold_date ?? undefined}
                />
              ) : (
                <div className="flex h-40 items-center justify-center text-sm text-text-muted">
                  Cargando historial…
                </div>
              )}
            </Card>
          </div>

          {/* Columna derecha: imágenes + resumen precio + alertas */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Imágenes</CardTitle>
              </CardHeader>
              <ImageUpload
                productId={product.id}
                images={product.images}
                onUpdate={(imgs) => setProduct({ ...product, images: imgs })}
              />
            </Card>

            {/* Precio de mercado / venta */}
            <Card>
              <CardTitle className="mb-4">
                {isSold ? "Precio de venta" : "Precio de mercado"}
              </CardTitle>
              <div className="space-y-3">
                {isSold ? (
                  <>
                    <p className="text-3xl font-bold text-text-primary">
                      {formatCurrency(product.sold_price)}
                    </p>
                    {marginPct !== null && (
                      <div className="rounded-lg bg-bg-elevated px-3 py-2">
                        <p className="text-xs text-text-muted">Beneficio real</p>
                        <p className={`text-lg font-semibold ${marginPct >= 0 ? "text-status-success" : "text-status-error"}`}>
                          {formatPct(marginPct)}
                        </p>
                      </div>
                    )}
                  </>
                ) : latestPrice ? (
                  <>
                    <div>
                      <p className="text-3xl font-bold text-text-primary">
                        {formatCurrency(marketPrice)}
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        Fuente: {sourceLabel} — {formatDate(sourceDate)}
                      </p>
                    </div>
                    {marginPct !== null && (
                      <div className="rounded-lg bg-bg-elevated px-3 py-2">
                        <p className="text-xs text-text-muted">Margen potencial</p>
                        <p className={`text-lg font-semibold ${marginPct >= 0 ? "text-status-success" : "text-status-error"}`}>
                          {formatPct(marginPct)}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-text-muted">Sin datos de mercado todavía.</p>
                )}
              </div>
            </Card>

            {/* Alertas del producto */}
            <Card>
              <CardTitle className="mb-4">Alertas ({alerts.length})</CardTitle>
              <div className="mb-4 space-y-3 rounded-lg border border-border bg-bg-elevated p-3">
                <p className="text-xs font-medium text-text-secondary">Crear alerta rápida</p>
                <div className="grid grid-cols-1 gap-2">
                  <select
                    value={alertType}
                    onChange={(e) =>
                      setAlertType(e.target.value as "PRICE_ABOVE" | "PRICE_BELOW" | "PRICE_CHANGE_PCT")
                    }
                    className="rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary"
                  >
                    <option value="PRICE_BELOW">Precio por debajo de</option>
                    <option value="PRICE_ABOVE">Precio por encima de</option>
                    <option value="PRICE_CHANGE_PCT">Cambio de precio (%)</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <input
                    type="number"
                    value={alertThreshold}
                    onChange={(e) => setAlertThreshold(e.target.value)}
                    placeholder={alertType === "PRICE_CHANGE_PCT" ? "Umbral %" : "Umbral €"}
                    className="rounded-lg border border-border bg-bg-card px-3 py-2 text-sm text-text-primary"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateAlert}
                    loading={creatingAlert}
                    disabled={!alertThreshold}
                    className="w-full sm:w-auto"
                  >
                    <BellPlus className="h-4 w-4" />
                    Añadir alerta
                  </Button>
                </div>
              </div>
              {alerts.length === 0 ? (
                <p className="text-sm text-text-muted">Sin alertas configuradas.</p>
              ) : (
                <ul className="space-y-2">
                  {alerts.map((alert) => (
                    <li
                      key={alert.id}
                      className="flex items-center justify-between rounded-lg bg-bg-elevated px-3 py-2 text-sm"
                    >
                      <span className="text-text-secondary">
                        {ALERT_LABELS[alert.alert_type] ?? alert.alert_type}
                      </span>
                      <span className="text-text-primary font-medium">
                        {alert.alert_type === "PRICE_CHANGE_PCT"
                          ? `${alert.threshold_value}%`
                          : formatCurrency(alert.threshold_value)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* Recibos de venta — solo visible cuando el producto está vendido */}
            {isSold && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    Recibos de venta ({(product.sale_receipts ?? []).length})
                  </CardTitle>
                </CardHeader>
                <SaleReceiptList
                  productId={product.id}
                  receipts={product.sale_receipts ?? []}
                  onUpdate={(updated) =>
                    setProduct({ ...product, sale_receipts: updated })
                  }
                />
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Modal de confirmación de eliminación */}
      <ConfirmModal
        open={confirmDeleteOpen}
        title="Eliminar producto"
        message="¿Eliminar este producto? Esta acción no se puede deshacer fácilmente."
        confirmLabel="Eliminar"
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          handleDelete();
        }}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      {/* Modal de venta — fuera del layout principal para evitar problemas de z-index */}
      <SaleModal
        open={sellModalOpen}
        productId={params.id}
        productName={product.name}
        suggestedPrice={marketPrice ?? null}
        onSuccess={() => {
          setSellModalOpen(false);
          load();
        }}
        onCancel={() => setSellModalOpen(false)}
      />
    </div>
  );
}
