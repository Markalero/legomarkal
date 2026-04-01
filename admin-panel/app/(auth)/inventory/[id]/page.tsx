// Ficha de producto — galería, datos, historial de precios y alertas
"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Edit, Trash2, Tag, BellPlus } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RefreshPricesButton } from "@/components/ui/RefreshPricesButton";
import { Badge } from "@/components/ui/Badge";
import { SellModal } from "@/components/ui/SellModal";
import { PriceHistory } from "@/components/product/PriceHistory";
import { ImageUpload } from "@/components/product/ImageUpload";
import { productsApi, pricesApi, alertsApi } from "@/lib/api-client";
import {
  formatCurrency,
  formatDate,
  conditionLabel,
  calcMarginPct,
  formatPct,
} from "@/lib/utils";
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
  const [creatingAlert, setCreatingAlert] = useState(false);
  const [alertType, setAlertType] = useState<"PRICE_ABOVE" | "PRICE_BELOW" | "PRICE_CHANGE_PCT">("PRICE_BELOW");
  const [alertThreshold, setAlertThreshold] = useState<string>("");
  const [sellModalOpen, setSellModalOpen] = useState(false);

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
    if (!confirm("¿Eliminar este producto? Esta acción no se puede deshacer fácilmente.")) return;
    setDeleting(true);
    try {
      await productsApi.delete(params.id);
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

  async function handleConfirmSell(soldPrice: number, soldDate: string) {
    setSellModalOpen(false);
    const updated = await productsApi.update(params.id, {
      availability: "sold",
      sold_price: soldPrice,
      sold_date: soldDate,
    });
    setProduct(updated);
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
      await load();
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
  const marketPrice = latestPrice?.price_new ?? latestPrice?.price_used ?? null;
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
        actions={
          <div className="flex gap-2">
            <Link href="/inventory">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <RefreshPricesButton loading={scraping} onClick={handleScrape} />
          </div>
        }
      />

      <div className="flex-1 space-y-6 p-6">
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
                  <Link href={`/inventory/${params.id}/edit`}>
                    <Button variant="secondary" size="sm">
                      <Edit className="h-4 w-4" />
                      Editar
                    </Button>
                  </Link>
                  <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>
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
                        Fuente: {latestPrice.source} — {formatDate(latestPrice.fetched_at)}
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
                        {formatCurrency(alert.threshold_value)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Modal de venta — fuera del layout principal para evitar problemas de z-index */}
      <SellModal
        open={sellModalOpen}
        productName={product.name}
        suggestedPrice={marketPrice}
        onConfirm={handleConfirmSell}
        onCancel={() => setSellModalOpen(false)}
      />
    </div>
  );
}
