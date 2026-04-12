// Tabla densa de inventario con paginación server-side, lightbox de imagen y navegación a ficha
"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SaleModal } from "@/components/inventory/SaleModal";
import {
  formatCurrency,
  formatPct,
  conditionLabel,
  calcMarginPct,
} from "@/lib/utils";
import type { Product, ProductListOut } from "@/types";

function getRangeByCondition(product: Product): { min: number | null; max: number | null } {
  const latest = product.latest_market_price;
  if (!latest) return { min: null, max: null };

  if (product.condition === "SEALED") {
    return {
      min: latest.min_price_new,
      max: latest.max_price_new,
    };
  }

  return {
    min: latest.min_price_used,
    max: latest.max_price_used,
  };
}

interface InventoryTableProps {
  data: ProductListOut;
  onPageChange: (page: number) => void;
  onToggleAvailability?: (
    productId: string,
    currentAvailability: "available" | "sold",
  ) => void;
  /** Llamado tras completar la venta (PATCH + upload) para refrescar la lista */
  onSaleComplete?: () => void;
}

/** Estado del modal de venta: qué producto está siendo marcado como vendido */
interface SellTarget {
  productId: string;
  productName: string;
  suggestedPrice: number | null;
}

function marginBadge(pct: number | null) {
  if (pct === null) return <span className="text-text-muted">—</span>;
  const variant = pct >= 20 ? "success" : pct >= 0 ? "warning" : "error";
  return <Badge variant={variant}>{formatPct(pct)}</Badge>;
}

export function InventoryTable({ data, onPageChange, onToggleAvailability, onSaleComplete }: InventoryTableProps) {
  const router = useRouter();
  const { items, total, page, size, pages } = data;
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  // Producto objetivo para el modal de venta; null = modal cerrado
  const [sellTarget, setSellTarget] = useState<SellTarget | null>(null);
  // URL de imagen en el lightbox; null = cerrado
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  function resolveImageUrl(url: string) {
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return new URL(url, apiUrl).toString();
  }

  return (
    <>
      {/* Modal de venta — fuera del <table> para evitar nesting inválido en el DOM */}
      <SaleModal
        open={sellTarget !== null}
        productId={sellTarget?.productId ?? ""}
        productName={sellTarget?.productName ?? ""}
        suggestedPrice={sellTarget?.suggestedPrice ?? null}
        onSuccess={() => {
          setSellTarget(null);
          onSaleComplete?.();
        }}
        onCancel={() => setSellTarget(null)}
      />

      {/* Lightbox de imagen — cierra con Escape o click en overlay */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-fade-in"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute right-4 top-4 rounded-full bg-black/70 p-2 text-white hover:bg-black/90"
            title="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
          <div
            className="relative h-[80vh] w-full max-w-3xl animate-zoom-in-fade"
            onClick={(e) => e.stopPropagation()}
          >
            <Image src={lightboxUrl} alt="Vista ampliada" fill className="object-contain" sizes="100vw" />
          </div>
        </div>
      )}

      <div className="flex flex-col">
        {/* Tabla */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-elevated text-left text-xs text-text-muted uppercase tracking-wider">
                <th className="px-4 py-3">Set ID</th>
                <th className="px-4 py-3">Imagen</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Tema</th>
                <th className="px-4 py-3">Condición</th>
                <th className="px-4 py-3 text-right">Cantidad</th>
                <th className="px-4 py-3 text-right">Compra</th>
                <th className="px-4 py-3 text-right">Mercado</th>
                <th className="px-4 py-3 text-right">Margen</th>
                <th className="px-4 py-3">Disponibilidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-12 text-center text-text-muted"
                  >
                    Sin productos que coincidan con los filtros.
                  </td>
                </tr>
              )}
              {items.map((product: Product) => {
                const marketPrice =
                  product.condition === "SEALED"
                    ? (product.latest_market_price?.price_new ?? null)
                    : (product.latest_market_price?.price_used ?? null);
                const isSold = product.availability === "sold";
                const range = getRangeByCondition(product);

                // Precio y margen ajustados según estado de venta
                const displayPrice = isSold ? product.sold_price : marketPrice;
                const marginPct = isSold
                  ? calcMarginPct(product.purchase_price, product.sold_price)
                  : calcMarginPct(product.purchase_price, marketPrice);

                return (
                  <tr
                    key={product.id}
                    className={`cursor-pointer transition-colors hover:bg-bg-elevated/50 ${
                      isSold ? "opacity-60" : ""
                    }`}
                    onClick={() => router.push(`/inventory/${product.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-text-secondary">
                      {product.set_number ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {product.images?.[0] ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightboxUrl(resolveImageUrl(product.images![0]));
                          }}
                          className="relative h-10 w-10 overflow-hidden rounded-md border border-border transition-opacity hover:opacity-80"
                          title="Ver imagen"
                        >
                          <Image src={resolveImageUrl(product.images[0])} alt={product.name} fill className="object-cover" sizes="40px" />
                        </button>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-text-primary max-w-48 truncate">
                      {product.name}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {product.theme ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="neutral">
                        {conditionLabel(product.condition)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary">
                      {product.quantity ?? 1}
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary">
                      {formatCurrency(product.purchase_price)}
                    </td>
                    {/* Columna de precio: muestra sold_price con badge "venta" si está vendido */}
                    <td className="px-4 py-3 text-right text-text-primary">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="inline-flex items-center justify-end gap-1.5">
                          {formatCurrency(displayPrice)}
                          {isSold && (
                            <Badge variant="neutral">venta</Badge>
                          )}
                        </span>
                        {!isSold && (range.min !== null || range.max !== null) && (
                          <span className="text-xs text-text-muted">
                            min {formatCurrency(range.min)} / max {formatCurrency(range.max)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {marginBadge(marginPct)}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant={isSold ? "danger" : "secondary"}
                        size="sm"
                        className={isSold ? "h-8" : "h-8 border-status-success/30 text-status-success bg-status-success/10 hover:bg-status-success/20"}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isSold) {
                            // Revertir venta: sin modal
                            onToggleAvailability?.(product.id, "sold");
                          } else {
                            // Marcar como vendido: abrir SellModal
                            setSellTarget({
                              productId: product.id,
                              productName: product.name,
                              suggestedPrice: marketPrice,
                            });
                          }
                        }}
                      >
                        {isSold ? "Vendido" : "Disponible"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <p className="text-xs text-text-muted">
            {total === 0
              ? "Sin resultados"
              : `${(page - 1) * size + 1}–${Math.min(page * size, total)} de ${total}`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-text-secondary">
              {page} / {pages || 1}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= pages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
