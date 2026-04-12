// Página de precios — listado de productos con último precio de mercado y botón de scraping puntual
"use client";
import { useEffect, useState, useCallback } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { RefreshPricesButton } from "@/components/ui/RefreshPricesButton";
import { dashboardApi, pricesApi, productsApi } from "@/lib/api-client";
import { conditionLabel, formatCurrency, formatDate } from "@/lib/utils";
import { ChartRangeSelector } from "@/components/ui/ChartRangeSelector";
import type { RangeKey } from "@/components/ui/ChartRangeSelector";
import { useRefreshProgress } from "@/lib/useRefreshProgress";
import { RefreshProgressOverlay } from "@/components/ui/RefreshProgressOverlay";
import type { Condition, MarketPrice, PriceInsightProduct, PriceTrendPoint, ProductPriceHistoryPoint } from "@/types";

function toDateKey(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function avgNullable(values: Array<number | null | undefined>): number | null {
  const nums = values
    .map((v) => (v == null ? null : Number(v)))
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length === 0) return null;
  return Number((nums.reduce((acc, n) => acc + n, 0) / nums.length).toFixed(2));
}

function minNullable(values: Array<number | null | undefined>): number | null {
  const nums = values
    .map((v) => (v == null ? null : Number(v)))
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length === 0) return null;
  return Number(Math.min(...nums).toFixed(2));
}

function maxNullable(values: Array<number | null | undefined>): number | null {
  const nums = values
    .map((v) => (v == null ? null : Number(v)))
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length === 0) return null;
  return Number(Math.max(...nums).toFixed(2));
}

function buildDailyPointsFromHistory(history: MarketPrice[]): ProductPriceHistoryPoint[] {
  const byDay = new Map<string, MarketPrice[]>();
  for (const row of history) {
    const key = toDateKey(row.fetched_at);
    const bucket = byDay.get(key) ?? [];
    bucket.push(row);
    byDay.set(key, bucket);
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, rows]) => {
      // Prioriza BrickLink; si no hay en ese día, usa el resto para no perder muestras válidas.
      const preferred = rows.filter((r) => r.source === "bricklink");
      const sourceRows = preferred.length > 0 ? preferred : rows;

      const priceNew = avgNullable(sourceRows.map((r) => r.price_new));
      const priceUsed = avgNullable(sourceRows.map((r) => r.price_used));

      const minNew = minNullable(sourceRows.map((r) => r.min_price_new ?? r.price_new));
      const maxNew = maxNullable(sourceRows.map((r) => r.max_price_new ?? r.price_new));
      const minUsed = minNullable(sourceRows.map((r) => r.min_price_used ?? r.price_used));
      const maxUsed = maxNullable(sourceRows.map((r) => r.max_price_used ?? r.price_used));

      return {
        date: `${dateKey}T00:00:00Z`,
        price_new: priceNew,
        price_used: priceUsed,
        min_price_new: minNew,
        max_price_new: maxNew,
        min_price_used: minUsed,
        max_price_used: maxUsed,
      };
    });
}

function mergeTrendWithHistory(
  trendPoints: ProductPriceHistoryPoint[],
  historyRows: MarketPrice[]
): ProductPriceHistoryPoint[] {
  const merged = new Map<string, ProductPriceHistoryPoint>();

  for (const point of trendPoints) {
    merged.set(toDateKey(point.date), {
      ...point,
      date: `${toDateKey(point.date)}T00:00:00Z`,
    });
  }

  for (const fallback of buildDailyPointsFromHistory(historyRows)) {
    const key = toDateKey(fallback.date);
    const current = merged.get(key);

    if (!current) {
      merged.set(key, fallback);
      continue;
    }

    merged.set(key, {
      ...current,
      price_new: current.price_new ?? fallback.price_new,
      price_used: current.price_used ?? fallback.price_used,
      min_price_new: current.min_price_new ?? fallback.min_price_new,
      max_price_new: current.max_price_new ?? fallback.max_price_new,
      min_price_used: current.min_price_used ?? fallback.min_price_used,
      max_price_used: current.max_price_used ?? fallback.max_price_used,
    });
  }

  return Array.from(merged.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export default function PricesPage() {
  const [insights, setInsights] = useState<PriceInsightProduct[]>([]);
  const [globalTrends, setGlobalTrends] = useState<PriceTrendPoint[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedProductName, setSelectedProductName] = useState<string>("");
  const [selectedCondition, setSelectedCondition] = useState<Condition | null>(null);
  const [selectedPurchasePrice, setSelectedPurchasePrice] = useState<number | null>(null);
  const [selectedFallbackBandMin, setSelectedFallbackBandMin] = useState<number | null>(null);
  const [selectedFallbackBandMax, setSelectedFallbackBandMax] = useState<number | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<ProductPriceHistoryPoint[]>([]);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { refreshing: refreshingAll, progress: refreshProgress, status: refreshStatus, setProgress, setStatus, begin, end, startPredictiveProgress, stopPredictorRef } = useRefreshProgress();

  const loadFallback = useCallback(async () => {
    const [products, trends] = await Promise.all([
      productsApi.list({ size: 200 }),
      dashboardApi.priceTrends(),
    ]);

    const fallbackInsights: PriceInsightProduct[] = products.items
      .map((product) => {
        const currentPrice =
          product.condition === "SEALED"
            ? (product.latest_market_price?.price_new ?? null)
            : (product.latest_market_price?.price_used ?? null);
        const purchasePrice = product.purchase_price ?? null;
        const profit =
          currentPrice !== null && purchasePrice !== null
            ? Number((currentPrice - purchasePrice).toFixed(2))
            : null;

        return {
          id: product.id,
          name: product.name,
          set_number: product.set_number,
          condition: product.condition,
          purchase_price: purchasePrice,
          current_market_price: currentPrice,
          min_market_price: null,
          max_market_price: null,
          avg_market_price: currentPrice,
          profit_eur: profit,
        };
      })
      .sort((a, b) => (b.profit_eur ?? -999999) - (a.profit_eur ?? -999999));

    setInsights(fallbackInsights);
    setGlobalTrends(trends);
    setFallbackMode(true);
    setErrorMsg(null);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextInsights, nextTrends] = await Promise.all([
        dashboardApi.priceInsights(),
        dashboardApi.priceTrends(),
      ]);
      setInsights(nextInsights);
      setGlobalTrends(nextTrends);
      setFallbackMode(false);
      setErrorMsg(null);
    } catch {
      try {
        await loadFallback();
      } catch (fallbackError) {
        const message =
          fallbackError instanceof Error
            ? fallbackError.message
            : "No se pudieron cargar los datos de precios";
        setErrorMsg(message);
        setInsights([]);
        setGlobalTrends([]);
      }
    } finally {
      setLoading(false);
    }
  }, [loadFallback]);

  useEffect(() => { load(); }, [load]);

  async function handleRefreshAllPrices() {
    begin();

    try {
      const totalModels = (await productsApi.list({ page: 1, size: 1 })).total || 1;
      const estimatedOps = totalModels * 2 + 4;
      setStatus(`Procesando ~${estimatedOps} operaciones (${totalModels} modelos)`);

      // 1) Refresco rápido de UI con datos actuales de BBDD.
      await load();
      setProgress(18);
      setStatus("Sincronizando precios de mercado");

      stopPredictorRef.current = startPredictiveProgress(totalModels);

      // 2) Refresco completo forzando cobertura diaria para todos los productos.
      const execution = await dashboardApi.refreshAllPricesCompat();
      if (execution.mode === "background") {
        // En backend legado, el scraping corre en segundo plano.
        setProgress(60);
        setStatus("Esperando finalización del refresco");
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }

      stopPredictorRef.current?.();
      stopPredictorRef.current = null;

      setProgress(88);
      setStatus("Recalculando cartera diaria completa");
      // 3) Refresco final para pintar resultados actualizados.
      await load();
      setProgress(100);
      setStatus("Completado");
      await new Promise((resolve) => setTimeout(resolve, 450));
    } finally {
      end();
    }
  }

  async function handleSelectProduct(product: PriceInsightProduct) {
    setSelectedProductId(product.id);
    setSelectedProductName(product.name);
    setSelectedCondition(product.condition);
    setSelectedPurchasePrice(product.purchase_price ?? null);
    setSelectedFallbackBandMin(toNum(product.min_market_price));
    setSelectedFallbackBandMax(toNum(product.max_market_price));
    const [trendResult, historyResult] = await Promise.allSettled([
      pricesApi.trend(product.id, 6, "sold"),
      pricesApi.history(product.id),
    ]);

    const trendPoints =
      trendResult.status === "fulfilled" ? trendResult.value.points : [];
    const historyRows =
      historyResult.status === "fulfilled" ? historyResult.value : [];

    const mergedPoints = mergeTrendWithHistory(trendPoints, historyRows);
    setSelectedHistory(mergedPoints);
  }

  const sortedGlobalTrends = [...globalTrends].sort((a, b) => a.date.localeCompare(b.date));
  const sortedSelectedHistory = [...selectedHistory].sort((a, b) => a.date.localeCompare(b.date));
  const toNum = (value: number | null | undefined) => {
    if (value == null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const toBand = (
    minV: number | null | undefined,
    maxV: number | null | undefined,
    mainV?: number | null,
    fallbackMinV?: number | null,
    fallbackMaxV?: number | null,
  ) => {
    const explicitMin = toNum(minV);
    const explicitMax = toNum(maxV);
    const fallbackMin = toNum(fallbackMinV);
    const fallbackMax = toNum(fallbackMaxV);
    const main = toNum(mainV);

    let minN = explicitMin;
    let maxN = explicitMax;

    // Si faltan límites por punto, usa amplitud fallback centrada en el precio del punto.
    if ((minN == null || maxN == null) && main != null && fallbackMin != null && fallbackMax != null) {
      const fallbackSpan = Math.max(0, fallbackMax - fallbackMin);
      if (fallbackSpan > 0) {
        minN = Math.max(0, Number((main - fallbackSpan / 2).toFixed(2)));
        maxN = Number((main + fallbackSpan / 2).toFixed(2));
      }
    }

    if (minN == null || maxN == null) {
      return { min: null, max: null, span: null };
    }
    const min = Math.min(minN, maxN);
    const max = Math.max(minN, maxN);
    return {
      min,
      max,
      span: Number((max - min).toFixed(2)),
    };
  };

  const globalChartData = sortedGlobalTrends.map((point) => ({
    ...point,
    dateTs: new Date(point.date).getTime(),
  }));
  const selectedChartData = sortedSelectedHistory.map((point) => {
    const newBand = toBand(
      point.min_price_new,
      point.max_price_new,
      point.price_new,
      selectedCondition === "SEALED" ? selectedFallbackBandMin : null,
      selectedCondition === "SEALED" ? selectedFallbackBandMax : null,
    );
    const usedBand = toBand(
      point.min_price_used,
      point.max_price_used,
      point.price_used,
      selectedCondition !== "SEALED" ? selectedFallbackBandMin : null,
      selectedCondition !== "SEALED" ? selectedFallbackBandMax : null,
    );

    return {
      ...point,
      dateTs: new Date(point.date).getTime(),
      newBandMin: newBand.min,
      newBandMax: newBand.max,
      newBandSpan: newBand.span,
      usedBandMin: usedBand.min,
      usedBandMax: usedBand.max,
      usedBandSpan: usedBand.span,
    };
  });
  const [range, setRange] = useState<RangeKey>("6m");

  function filterByRange<T extends { dateTs: number }>(data: T[]) {
    if (range === "all") return data;
    const end = data.reduce((m, d) => Math.max(m, d.dateTs), 0) || Date.now();
    const months = range === "1m" ? 1 : range === "3m" ? 3 : 6;
    const start = end - months * 30 * 24 * 60 * 60 * 1000;
    return data.filter((d) => d.dateTs >= start);
  }

  const visibleGlobal = filterByRange(globalChartData);
  const visibleSelected = filterByRange(selectedChartData);
  const highlightNew = selectedCondition === "SEALED";
  const highlightUsed = selectedCondition !== "SEALED";
  const domainFromValues = (values: Array<number | null | undefined>) => {
    const nums = values
      .map((v) => (v == null ? null : Number(v)))
      .filter((v): v is number => v != null && Number.isFinite(v));

    if (nums.length === 0) return [0, 100] as const;

    const positiveNums = nums.filter((v) => v > 0);
    const axisNums = positiveNums.length > 0 ? positiveNums : nums;
    const minVal = Math.min(...axisNums);
    const maxVal = Math.max(...axisNums);

    if (maxVal <= minVal) {
      const pad = Math.max(minVal * 0.05, 1);
      return [Math.max(0, Number((minVal - pad).toFixed(2))), Number((maxVal + pad).toFixed(2))] as const;
    }

    return [
      Math.max(0, Number((minVal - Math.max(minVal * 0.03, 1)).toFixed(2))),
      Number((maxVal + Math.max(maxVal * 0.03, 1)).toFixed(2)),
    ] as const;
  };

  const selectedValues = visibleSelected.flatMap((point) => [
    point.price_new,
    point.price_used,
    point.newBandMin,
    point.newBandMax,
    point.usedBandMin,
    point.usedBandMax,
    selectedPurchasePrice,
  ]);
  const globalValues = visibleGlobal.flatMap((point) => [
    point.invested_value,
    point.market_value,
  ]);

  const [yMin, yMax] = selectedProductId
    ? domainFromValues(selectedValues)
    : domainFromValues(globalValues);
  const maxProfit = Math.max(...insights.map(p => Math.abs(p.profit_eur ?? 0)), 1);

  function renderTooltipContent({ active, payload, label }: { active?: boolean; payload?: Array<{ payload: Record<string, unknown> }>; label?: number }) {
    if (!active || !payload || payload.length === 0) return null;

    const point = payload[0].payload;
    const newPrice = toNum(point.price_new as number | null | undefined);
    const usedPrice = toNum(point.price_used as number | null | undefined);
    const invested = toNum(point.invested_value as number | null | undefined);
    const market = toNum(point.market_value as number | null | undefined);

    const newBandMin = toNum(point.newBandMin as number | null | undefined);
    const newBandMax = toNum(point.newBandMax as number | null | undefined);
    const usedBandMin = toNum(point.usedBandMin as number | null | undefined);
    const usedBandMax = toNum(point.usedBandMax as number | null | undefined);

    const showSelected = Boolean(selectedProductId);
    const isMainNew = selectedCondition === "SEALED";

    const mainPrice = isMainNew ? newPrice : usedPrice;
    const mainMin = isMainNew ? newBandMin : usedBandMin;
    const mainMax = isMainNew ? newBandMax : usedBandMax;
    const distToMax = mainPrice != null && mainMax != null ? Math.max(0, mainMax - mainPrice) : null;
    const distToMin = mainPrice != null && mainMin != null ? Math.max(0, mainPrice - mainMin) : null;
    const formatDelta = (value: number) =>
      value.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const deltaText =
      distToMax != null && distToMin != null
        ? ` (+${formatDelta(distToMax)}/-${formatDelta(distToMin)})`
        : "";

    return (
      <div
        style={{
          backgroundColor: "#141416",
          border: "1px solid #2A2A2D",
          borderRadius: 8,
          padding: "8px 10px",
        }}
      >
        <div style={{ color: "#A1A1AA", fontSize: 12, marginBottom: 6 }}>
          {formatDate(label ?? 0)}
        </div>

        {showSelected ? (
          <>
            {newPrice != null && (
              <div style={{ color: "#F59E0B", fontSize: 12, marginBottom: 4 }}>
                Nuevo : {formatCurrency(newPrice)}{isMainNew ? deltaText : ""}
              </div>
            )}
            {usedPrice != null && (
              <div style={{ color: "#3B82F6", fontSize: 12 }}>
                Usado : {formatCurrency(usedPrice)}{!isMainNew ? deltaText : ""}
              </div>
            )}
          </>
        ) : (
          <>
            {invested != null && (
              <div style={{ color: "#F59E0B", fontSize: 12, marginBottom: 4 }}>
                Invertido : {formatCurrency(invested)}
              </div>
            )}
            {market != null && (
              <div style={{ color: "#3B82F6", fontSize: 12 }}>
                Valor de mercado : {formatCurrency(market)}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <Header
        title="Precios de mercado"
        description="Fuente oficial: BrickLink"
        actions={
          <RefreshPricesButton
            loading={refreshingAll}
            onClick={handleRefreshAllPrices}
            progress={refreshProgress}
            statusText={refreshStatus}
          />
        }
      />

      <div className="flex-1 p-6 animate-slide-up-fade">
        {loading ? (
          <div className="space-y-4 py-2">
            <div className="h-12 animate-pulse rounded-xl border border-border bg-bg-card" />
            <div className="h-72 animate-pulse rounded-xl border border-border bg-bg-card" />
            <div className="h-96 animate-pulse rounded-xl border border-border bg-bg-card" />
            <div className="flex items-center justify-center text-sm text-text-muted">
              Cargando precios de mercado…
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {errorMsg && (
              <Card>
                <p className="text-sm text-status-error">{errorMsg}</p>
              </Card>
            )}

            {fallbackMode && !errorMsg && (
              <Card>
                <p className="text-xs text-text-muted">
                  Mostrando modo compatible: algunas métricas avanzadas dependen de endpoints nuevos del backend.
                </p>
              </Card>
            )}

            <Card>
                  <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    {selectedProductId
                      ? `Histórico de precios · ${selectedProductName}`
                      : "Tendencia global de cartera"}
                  </h3>
                  <p className="text-xs text-text-muted">
                    {selectedProductId
                      ? `Guide type: sold · Línea destacada según estado (${conditionLabel(selectedCondition)}) · Banda sombreada = rango min/max`
                      : "Misma visualización que en dashboard: invertido y valor de mercado"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <ChartRangeSelector value={range} onChange={(v) => setRange(v)} />
                  {selectedProductId && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setSelectedProductId(null);
                        setSelectedProductName("");
                        setSelectedCondition(null);
                        setSelectedPurchasePrice(null);
                        setSelectedFallbackBandMin(null);
                        setSelectedFallbackBandMax(null);
                        setSelectedHistory([]);
                      }}
                    >
                      Ver gráfica global
                    </Button>
                  )}
                </div>
              </div>

              {!selectedProductId && sortedGlobalTrends.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-muted">Sin datos suficientes para generar la gráfica.</p>
              ) : selectedProductId && sortedSelectedHistory.length === 0 ? (
                <p className="py-8 text-center text-sm text-text-muted">Sin histórico disponible para este producto en los últimos 6 meses.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <ComposedChart
                    data={selectedProductId ? visibleSelected : visibleGlobal}
                    margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2D" />
                    <XAxis
                      dataKey="dateTs"
                      type="number"
                      scale="time"
                      domain={["dataMin", "dataMax"]}
                      tickFormatter={(v) => formatDate(v)}
                      tick={{ fill: "#71717A", fontSize: 11 }}
                      axisLine={{ stroke: "#2A2A2D" }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[yMin, yMax]}
                      allowDataOverflow
                      tickFormatter={(v) => `${v}€`}
                      tick={{ fill: "#71717A", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={(props) => renderTooltipContent(props as { active?: boolean; payload?: Array<{ payload: Record<string, unknown> }>; label?: number })}
                    />
                    <Legend />

                    {selectedProductId ? (
                      <>
                        {/* Límites min/max invisibles para banda de variabilidad (nuevo) */}
                        <Line type="monotone" dataKey="newBandMin" stroke="#F59E0B" strokeOpacity={0} dot={false} activeDot={false} legendType="none" connectNulls />
                        <Line type="monotone" dataKey="newBandMax" stroke="#F59E0B" strokeOpacity={0} dot={false} activeDot={false} legendType="none" connectNulls />
                        {/* Límites min/max invisibles para banda de variabilidad (usado) */}
                        <Line type="monotone" dataKey="usedBandMin" stroke="#3B82F6" strokeOpacity={0} dot={false} activeDot={false} legendType="none" connectNulls />
                        <Line type="monotone" dataKey="usedBandMax" stroke="#3B82F6" strokeOpacity={0} dot={false} activeDot={false} legendType="none" connectNulls />

                        <Area
                          type="monotone"
                          dataKey="newBandMin"
                          stackId="varianceNew"
                          stroke="none"
                          fillOpacity={0}
                          connectNulls
                          isAnimationActive={false}
                          activeDot={false}
                          legendType="none"
                        />
                        <Area
                          type="monotone"
                          dataKey="newBandSpan"
                          stackId="varianceNew"
                          stroke="none"
                          fill="#F59E0B"
                          fillOpacity={highlightNew ? 0.24 : 0.12}
                          connectNulls
                          activeDot={false}
                          legendType="none"
                        />
                        <Area
                          type="monotone"
                          dataKey="usedBandMin"
                          stackId="varianceUsed"
                          stroke="none"
                          fillOpacity={0}
                          connectNulls
                          isAnimationActive={false}
                          activeDot={false}
                          legendType="none"
                        />
                        <Area
                          type="monotone"
                          dataKey="usedBandSpan"
                          stackId="varianceUsed"
                          stroke="none"
                          fill="#3B82F6"
                          fillOpacity={highlightUsed ? 0.24 : 0.12}
                          connectNulls
                          activeDot={false}
                          legendType="none"
                        />
                        {selectedPurchasePrice !== null && (
                          <ReferenceLine
                            y={selectedPurchasePrice}
                            stroke="#A1A1AA"
                            strokeDasharray="4 4"
                            ifOverflow="extendDomain"
                            label={{
                              value: `Compra ${formatCurrency(selectedPurchasePrice)}`,
                              position: "insideBottomRight",
                              fill: "#A1A1AA",
                              fontSize: 11,
                            }}
                          />
                        )}
                        <Line
                          type="monotone"
                          dataKey="price_new"
                          name="Nuevo"
                          stroke="#F59E0B"
                          strokeWidth={highlightNew ? 3 : 1.5}
                          strokeDasharray={highlightNew ? "0" : "4 4"}
                          connectNulls
                          dot={{ r: 3, strokeWidth: 1, fill: "#F59E0B", stroke: "#111827" }}
                          activeDot={{ r: 5 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="price_used"
                          name="Usado"
                          stroke="#3B82F6"
                          strokeWidth={highlightNew ? 1.5 : 3}
                          strokeDasharray={highlightNew ? "4 4" : "0"}
                          connectNulls
                          dot={{ r: 3, strokeWidth: 1, fill: "#3B82F6", stroke: "#111827" }}
                          activeDot={{ r: 5 }}
                        />
                      </>
                    ) : (
                      <>
                        <Line type="monotone" dataKey="invested_value" name="Invertido" stroke="#F59E0B" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="market_value" name="Valor de mercado" stroke="#3B82F6" strokeWidth={2} dot={false} />
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card padded={false}>
            <div className="overflow-hidden rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-elevated text-left text-xs text-text-muted uppercase tracking-wider">
                  <th className="px-4 py-3">Set ID</th>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Compra</th>
                  <th className="px-4 py-3 text-right">Actual</th>
                  <th className="px-4 py-3 text-right text-text-muted/80">Mín.</th>
                  <th className="px-4 py-3 text-right text-text-muted/80">Máx.</th>
                  <th className="px-4 py-3 text-right">Beneficio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {insights.map((p) => (
                  <tr
                    key={p.id}
                    className={`cursor-pointer transition-colors hover:bg-bg-elevated/60 ${
                      selectedProductId === p.id
                        ? "bg-bg-elevated/40 shadow-[inset_3px_0_0_0_rgba(16,185,129,0.45)]"
                        : ""
                    }`}
                    onClick={() => handleSelectProduct(p)}
                  >
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-md border border-border bg-bg-elevated px-2 py-0.5 font-mono text-xs">
                        {p.set_number ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-primary max-w-48 truncate">
                      {p.name}
                    </td>
                    <td className="px-4 py-3">
                      {p.condition ? (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          p.condition === "SEALED"
                            ? "bg-purple-500/15 text-purple-400"
                            : p.condition === "OPEN_COMPLETE"
                            ? "bg-blue-500/15 text-blue-400"
                            : "bg-amber-500/15 text-amber-400"
                        }`}>
                          {conditionLabel(p.condition)}
                        </span>
                      ) : <span className="text-text-muted">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(p.purchase_price)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatCurrency(p.current_market_price)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-text-muted">
                      {formatCurrency(p.min_market_price)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-text-muted">
                      {formatCurrency(p.max_market_price)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="ml-auto flex h-6 items-center justify-end gap-3">
                        {p.profit_eur !== null && (
                          <div className="w-20 h-1.5 rounded-full overflow-hidden bg-bg-elevated">
                            <div
                              className={`h-full rounded-full ${(p.profit_eur ?? 0) >= 0 ? "bg-status-success" : "bg-status-error"}`}
                              style={{ width: `${Math.min(100, Math.abs((p.profit_eur ?? 0) / (maxProfit || 1)) * 100)}%` }}
                            />
                          </div>
                        )}
                        <span className={`w-20 text-right font-medium tabular-nums leading-none ${(p.profit_eur ?? 0) >= 0 ? "text-status-success" : "text-status-error"}`}>
                          {formatCurrency(p.profit_eur)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
                {insights.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-text-muted">
                      Sin productos en inventario.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </Card>
          </div>
        )}
      </div>

      <RefreshProgressOverlay visible={refreshingAll} status={refreshStatus} progress={refreshProgress} />
    </div>
  );
}
