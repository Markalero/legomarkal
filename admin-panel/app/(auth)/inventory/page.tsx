// Página de listado de inventario con filtros, exportación e importación masiva
"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Download, Upload, SlidersHorizontal, PlusCircle, X, Trash2, AlertTriangle } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FilterBar } from "@/components/inventory/FilterBar";
import { InventoryTable } from "@/components/inventory/InventoryTable";
import { BulkImport } from "@/components/inventory/BulkImport";
import { RefreshPricesButton } from "@/components/ui/RefreshPricesButton";
import { RefreshProgressOverlay } from "@/components/ui/RefreshProgressOverlay";
import { useRefreshProgress } from "@/lib/useRefreshProgress";
import { dashboardApi, productsApi } from "@/lib/api-client";
import { toUiError } from "@/lib/utils";
import type { ProductListOut, ProductFilters } from "@/types";

const DEFAULT_FILTERS: ProductFilters = { page: 1, size: 20 };
const PURCHASE_SOURCES_KEY = "legomarkal_purchase_sources";
const RESET_WAIT_MS = 10_000;

export default function InventoryPage() {
  const router = useRouter();
  const [data, setData] = useState<ProductListOut | null>(null);
  const [filters, setFilters] = useState<ProductFilters>(DEFAULT_FILTERS);
  const [themes, setThemes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetProgress, setResetProgress] = useState(0);
  const [resetSecondsLeft, setResetSecondsLeft] = useState(10);
  const [resetLoading, setResetLoading] = useState(false);
  const [purchaseSources, setPurchaseSources] = useState<string[]>([]);
  const [newPurchaseSource, setNewPurchaseSource] = useState("");
  const { refreshing: refreshingAll, progress: refreshProgress, status: refreshStatus, setProgress, setStatus, begin, end, startPredictiveProgress, stopPredictorRef } = useRefreshProgress();

  const load = useCallback(async (f: ProductFilters) => {
    setError(null);
    setErrorDetails(null);
    setLoading(true);
    try {
      const result = await productsApi.list(f);
      setData(result);
      // Extrae temas únicos del resultado actual para el filtro
      const newThemes = Array.from(new Set(result.items.map((p) => p.theme).filter(Boolean) as string[]));
      setThemes((prev) => Array.from(new Set([...prev, ...newThemes])));
    } catch (e: unknown) {
      const uiError = toUiError(e, "No se pudo cargar el inventario.");
      setError(uiError.message);
      setErrorDetails(uiError.details ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filters);
  }, [filters, load]);

  useEffect(() => {
    const storedSources = localStorage.getItem(PURCHASE_SOURCES_KEY);
    if (storedSources) {
      setPurchaseSources(JSON.parse(storedSources));
    }
  }, []);

  useEffect(() => {
    if (!resetOpen) {
      setResetProgress(0);
      setResetSecondsLeft(10);
      return;
    }

    const startedAt = Date.now();
    const timerId = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const boundedElapsed = Math.min(elapsed, RESET_WAIT_MS);
      const progressPct = Math.round((boundedElapsed / RESET_WAIT_MS) * 100);
      setResetProgress(progressPct);
      setResetSecondsLeft(Math.max(0, Math.ceil((RESET_WAIT_MS - boundedElapsed) / 1000)));

      if (boundedElapsed >= RESET_WAIT_MS) {
        window.clearInterval(timerId);
      }
    }, 100);

    return () => window.clearInterval(timerId);
  }, [resetOpen]);

  const resetReady = resetProgress >= 100;

  async function handleRefreshAllPrices() {
    begin();
    try {
      const totalModels = (await productsApi.list({ page: 1, size: 1 })).total || 1;
      const estimatedOps = totalModels * 2 + 4;
      setStatus(`Procesando ~${estimatedOps} operaciones (${totalModels} modelos)`);

      // 1) Refresco rápido de UI con datos actuales de BBDD.
      await load(filters);
      setProgress(18);
      setStatus("Sincronizando precios de mercado");

      stopPredictorRef.current = startPredictiveProgress(totalModels);

      // 2) Refresco completo forzando cobertura diaria para todos los productos.
      const execution = await dashboardApi.refreshAllPricesCompat();
      if (execution.mode === "background") {
        setProgress(60);
        setStatus("Esperando finalización del refresco");
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }

      stopPredictorRef.current?.();
      stopPredictorRef.current = null;

      setProgress(88);
      setStatus("Recalculando cartera diaria completa");
      // 3) Refresco final para pintar resultados actualizados.
      await load(filters);
      setProgress(100);
      setStatus("Completado");
      await new Promise((resolve) => setTimeout(resolve, 450));
    } catch (e: unknown) {
      const uiError = toUiError(e, "No se pudieron actualizar los precios.");
      setError(uiError.message);
      setErrorDetails(uiError.details ?? null);
    } finally {
      end();
    }
  }

  function handleFilterChange(f: ProductFilters) {
    setFilters(f);
  }

  async function handleExport() {
    try {
      const blob = await productsApi.exportAllData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `legomarkal_backup_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const uiError = toUiError(e, "No se pudo exportar el backup completo.");
      setError(uiError.message);
      setErrorDetails(uiError.details ?? null);
    }
  }

  async function handleResetAllData() {
    if (!resetReady) return;

    setResetLoading(true);
    try {
      await productsApi.resetAllData();
      setResetOpen(false);
      setSettingsOpen(false);

      const nextFilters = { ...DEFAULT_FILTERS };
      setFilters(nextFilters);
      await load(nextFilters);
    } catch (e: unknown) {
      const uiError = toUiError(e, "No se pudieron resetear los datos.");
      setError(uiError.message);
      setErrorDetails(uiError.details ?? null);
    } finally {
      setResetLoading(false);
    }
  }

  async function handleToggleAvailability(
    productId: string,
    currentAvailability: "available" | "sold",
  ) {
    // Solo se llega aquí para revertir a "available"; el flujo "sold" lo gestiona SaleModal.
    try {
      if (currentAvailability === "sold") {
        await productsApi.update(productId, {
          availability: "available",
          sold_price: null,
          sold_date: null,
        });
        await load(filters);
      }
    } catch (e: unknown) {
      const uiError = toUiError(e, "No se pudo cambiar la disponibilidad del producto.");
      setError(uiError.message);
      setErrorDetails(uiError.details ?? null);
    }
  }

  function persistList(key: string, list: string[]) {
    localStorage.setItem(key, JSON.stringify(list));
  }

  function addPurchaseSource() {
    const trimmed = newPurchaseSource.trim();
    if (!trimmed) return;
    const next = Array.from(new Set([...purchaseSources, trimmed])).sort((a, b) => a.localeCompare(b));
    setPurchaseSources(next);
    persistList(PURCHASE_SOURCES_KEY, next);
    setNewPurchaseSource("");
  }

  function removePurchaseSource(value: string) {
    const next = purchaseSources.filter((item) => item !== value);
    setPurchaseSources(next);
    persistList(PURCHASE_SOURCES_KEY, next);
  }

  return (
    <div className="flex flex-col">
      <Header
        title="Inventario"
        description={data ? `${data.total} productos` : "Cargando…"}
        actions={
          <div className="flex gap-2">
            <RefreshPricesButton
              loading={refreshingAll}
              onClick={handleRefreshAllPrices}
              progress={refreshProgress}
              statusText={refreshStatus}
            />
            <Button variant="secondary" size="sm" onClick={() => setSettingsOpen(true)}>
              <SlidersHorizontal className="h-4 w-4" />
              Configuración
            </Button>
            <Button size="sm" type="button" onClick={() => router.push("/inventory/new")}>
              <Plus className="h-4 w-4" />
              Añadir producto
            </Button>
          </div>
        }
      />

      <div className="flex-1 p-6 animate-slide-up-fade">
        {error && (
          <div className="mb-4 rounded-lg border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
            <p>{error}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Button type="button" variant="secondary" size="sm" onClick={() => load(filters)}>
                Reintentar
              </Button>
              {errorDetails && (
                <details className="text-xs text-text-secondary">
                  <summary className="cursor-pointer">Detalle técnico</summary>
                  <p className="mt-1 break-all">{errorDetails}</p>
                </details>
              )}
            </div>
          </div>
        )}

        <Card padded={false}>
          <FilterBar
            filters={filters}
            themes={themes}
            onChange={handleFilterChange}
          />
          {loading && !data ? (
            <div className="flex items-center justify-center py-16 text-sm text-text-muted">
              Cargando inventario…
            </div>
          ) : data ? (
            <InventoryTable
              data={data}
              onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
              onToggleAvailability={handleToggleAvailability}
              onSaleComplete={() => load(filters)}
            />
          ) : null}
        </Card>
      </div>

      {/* Modal de importación masiva */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Restaurar copia completa desde JSON"
      >
        <BulkImport
          onSuccess={() => {
            setImportOpen(false);
            load(filters);
          }}
        />
      </Modal>

      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Configuración de inventario"
      >
        <div className="space-y-6">
          {/* Exportación e importación de datos */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-text-primary">Datos</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4" />
                Exportar backup (JSON)
              </Button>
              <Button variant="secondary" size="sm" onClick={() => { setSettingsOpen(false); setImportOpen(true); }}>
                <Upload className="h-4 w-4" />
                Importar backup (JSON)
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  setSettingsOpen(false);
                  setResetOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4" />
                Resetear todos los datos
              </Button>
            </div>
            <p className="text-xs text-text-muted">
              La exportación incluye todas las tablas de negocio. La importación acepta exclusivamente ese JSON.
            </p>
          </div>
          <div className="border-t border-border" />
          <div className="space-y-3">
            <p className="text-sm font-medium text-text-primary">Fuentes de compra</p>
            <div className="flex gap-2">
              <input
                value={newPurchaseSource}
                onChange={(e) => setNewPurchaseSource(e.target.value)}
                placeholder="Ej. BrickLink, Wallapop"
                className="flex-1 rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary"
              />
              <Button type="button" variant="secondary" onClick={addPurchaseSource}>
                <PlusCircle className="h-4 w-4" />
                Añadir
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {purchaseSources.map((source) => (
                <button
                  key={source}
                  type="button"
                  onClick={() => removePurchaseSource(source)}
                  aria-label={`Eliminar fuente ${source}`}
                  className="inline-flex items-center gap-1 rounded-full bg-bg-elevated px-3 py-1 text-xs text-text-secondary hover:text-status-error"
                  title="Eliminar opción"
                >
                  {source}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={resetOpen}
        onClose={() => {
          if (!resetLoading) setResetOpen(false);
        }}
        title="Confirmación de reseteo total"
        className="max-w-lg"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-status-error/40 bg-status-error/10 p-3 text-sm text-status-error">
            <p className="flex items-start gap-2 font-medium">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Esta acción eliminará todos los datos de inventario, precios, alertas e histórico diario.
            </p>
            <p className="mt-2 text-xs text-text-secondary">
              Espera 10 segundos para habilitar la confirmación final. Es una operación irreversible.
            </p>
          </div>

          <div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-bg-elevated">
              <div
                className="h-full bg-status-warning transition-all"
                style={{ width: `${resetProgress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-text-muted">
              {resetReady
                ? "Tiempo de espera completado. Ya puedes confirmar el reseteo."
                : `Confirma disponible en ${resetSecondsLeft}s`}
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setResetOpen(false)} disabled={resetLoading}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleResetAllData}
              disabled={!resetReady || resetLoading}
              loading={resetLoading}
            >
              Sí, resetear todo
            </Button>
          </div>
        </div>
      </Modal>

      <RefreshProgressOverlay visible={refreshingAll} status={refreshStatus} progress={refreshProgress} />
    </div>
  );
}
