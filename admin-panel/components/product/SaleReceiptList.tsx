// Lista de recibos de venta adjuntos a un producto vendido
"use client";
import { useState } from "react";
import { Download, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { productsApi } from "@/lib/api-client";
import type { SaleReceipt } from "@/types";

interface SaleReceiptListProps {
  productId: string;
  receipts: SaleReceipt[];
  /** Llamado con la lista actualizada tras borrar un recibo */
  onUpdate: (receipts: SaleReceipt[]) => void;
}

export function SaleReceiptList({ productId, receipts, onUpdate }: SaleReceiptListProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [receiptToDelete, setReceiptToDelete] = useState<SaleReceipt | null>(null);

  async function handleDownload(receipt: SaleReceipt) {
    setDownloadingId(receipt.id);
    try {
      const { url } = await productsApi.getSaleReceiptDownloadUrl(productId, receipt.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDeleteConfirmed() {
    if (!receiptToDelete) return;

    const target = receiptToDelete;
    setDeletingId(target.id);
    setReceiptToDelete(null);
    try {
      await productsApi.deleteSaleReceipt(productId, target.id);
      onUpdate(receipts.filter((r) => r.id !== target.id));
    } finally {
      setDeletingId(null);
    }
  }

  if (receipts.length === 0) {
    return <p className="text-sm text-text-muted">Sin recibos adjuntos.</p>;
  }

  return (
    <>
      <ConfirmModal
        open={receiptToDelete !== null}
        title="Eliminar recibo"
        message={`¿Eliminar el recibo "${receiptToDelete?.filename ?? ""}"? Esta accion no se puede deshacer.`}
        confirmLabel="Eliminar"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setReceiptToDelete(null)}
      />

      <ul className="space-y-2">
        {receipts.map((receipt) => (
          <li
            key={receipt.id}
            className="flex items-center justify-between rounded-lg bg-bg-elevated px-3 py-2 text-sm"
          >
            <span className="flex min-w-0 items-center gap-2 text-text-secondary">
              <FileText className="h-4 w-4 flex-shrink-0 text-accent-lego" />
              <span className="truncate">{receipt.filename}</span>
            </span>
            <div className="ml-2 flex flex-shrink-0 gap-1">
              <Button
                variant="ghost"
                size="sm"
                loading={downloadingId === receipt.id}
                onClick={() => handleDownload(receipt)}
                title="Descargar"
                aria-label="Descargar recibo"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                loading={deletingId === receipt.id}
                onClick={() => setReceiptToDelete(receipt)}
                title="Eliminar recibo"
                aria-label="Eliminar recibo"
                className="text-status-error hover:text-status-error"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
