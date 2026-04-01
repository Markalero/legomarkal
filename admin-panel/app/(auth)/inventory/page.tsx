// Página de listado de inventario con filtros, exportación e importación masiva
"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Download, Upload, SlidersHorizontal, PlusCircle, X } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FilterBar } from "@/components/inventory/FilterBar";
import { InventoryTable } from "@/components/inventory/InventoryTable";
import { BulkImport } from "@/components/inventory/BulkImport";
import { productsApi } from "@/lib/api-client";
import type { ProductListOut, ProductFilters } from "@/types";

const DEFAULT_FILTERS: ProductFilters = { page: 1, size: 20 };
const PURCHASE_SOURCES_KEY = "legomarkal_purchase_sources";

export default function InventoryPage() {
  const [data, setData] = useState<ProductListOut | null>(null);
  const [filters, setFilters] = useState<ProductFilters>(DEFAULT_FILTERS);
  const [themes, setThemes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [purchaseSources, setPurchaseSources] = useState<string[]>([]);
  const [newPurchaseSource, setNewPurchaseSource] = useState("");

  const load = useCallback(async (f: ProductFilters) => {
    setLoading(true);
    try {
      const result = await productsApi.list(f);
      setData(result);
      // Extrae temas únicos del resultado actual para el filtro
      const newThemes = Array.from(new Set(result.items.map((p) => p.theme).filter(Boolean) as string[]));
      setThemes((prev) => Array.from(new Set([...prev, ...newThemes])));
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

  function handleFilterChange(f: ProductFilters) {
    setFilters(f);
  }

  async function handleExport() {
    const blob = await productsApi.exportCsv();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventario_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleToggleAvailability(
    productId: string,
    currentAvailability: "available" | "sold",
    soldPrice?: number,
    soldDate?: string,
  ) {
    const nextAvailability = currentAvailability === "available" ? "sold" : "available";
    await productsApi.update(productId, {
      availability: nextAvailability,
      // Al marcar como vendido se guardan precio y fecha; al revertir se limpian
      sold_price: nextAvailability === "sold" ? (soldPrice ?? null) : null,
      sold_date: nextAvailability === "sold" ? (soldDate ?? null) : null,
    });
    await load(filters);
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
            <Button variant="secondary" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />
              Importar
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setSettingsOpen(true)}>
              <SlidersHorizontal className="h-4 w-4" />
              Configuración
            </Button>
            <Link href="/inventory/new">
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Añadir producto
              </Button>
            </Link>
          </div>
        }
      />

      <div className="flex-1 p-6">
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
            />
          ) : null}
        </Card>
      </div>

      {/* Modal de importación masiva */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Importar productos desde CSV / Excel"
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
    </div>
  );
}
