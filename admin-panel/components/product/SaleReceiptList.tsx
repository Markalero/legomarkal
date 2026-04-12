// Lista de recibos de venta adjuntos a un producto vendido
"use client";
import { useState } from "react";
import { Download, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
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

  async function handleDownload(receipt: SaleReceipt) {
    setDownloadingId(receipt.id);
    try {
      const { url } = await productsApi.getSaleReceiptDownloadUrl(productId, receipt.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDelete(receipt: SaleReceipt) {
    if (!confirm(`¿Eliminar el recibo "${receipt.filename}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    setDeletingId(receipt.id);
    try {
      await productsApi.deleteSaleReceipt(productId, receipt.id);
      onUpdate(receipts.filter((r) => r.id !== receipt.id));
    } finally {
      setDeletingId(null);
    }
  }

  if (receipts.length === 0) {
    return <p className="text-sm text-text-muted">Sin recibos adjuntos.</p>;
  }

  return (
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
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              loading={deletingId === receipt.id}
              onClick={() => handleDelete(receipt)}
              title="Eliminar recibo"
              className="text-status-error hover:text-status-error"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
