// Lista de recibos de venta adjuntos a un producto vendido
"use client";
import { useState, useRef } from "react";
import { Download, FileText, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Modal } from "@/components/ui/Modal";
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
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewingReceipt, setPreviewingReceipt] = useState<SaleReceipt | null>(null);

  async function handleDownload(receipt: SaleReceipt) {
    setDownloadingId(receipt.id);
    try {
      // El endpoint sirve el PDF directamente con auth JWT — lo descargamos como blob
      const blob = await productsApi.downloadSaleReceipt(productId, receipt.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = receipt.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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
  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const pdfs = Array.from(files).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (pdfs.length !== files.length) {
      setUploadError("Solo se aceptan archivos PDF.");
    } else {
      setUploadError(null);
    }

    setUploading(true);
    try {
      const updated = await productsApi.uploadSaleReceipts(productId, pdfs);
      onUpdate(updated.sale_receipts || []);
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : "Error al subir recibos.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handlePreview(receipt: SaleReceipt) {
    setPreviewingReceipt(receipt);
    try {
      const blob = await productsApi.downloadSaleReceipt(productId, receipt.id);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (e: unknown) {
      // Si hay error, mostrarlo como alert básico (no crítico)
      alert(e instanceof Error ? e.message : "No se pudo cargar la previsualización.");
      setPreviewingReceipt(null);
    } finally {
    }
  }

  function closePreview() {
    if (previewUrl) {
      try {
        URL.revokeObjectURL(previewUrl);
      } catch {}
    }
    setPreviewUrl(null);
    setPreviewingReceipt(null);
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

      <Modal open={!!previewUrl} onClose={closePreview} title={previewingReceipt?.filename} className="max-w-4xl">
        <div className="h-[70vh]">
          {previewUrl ? (
            <iframe src={previewUrl} title={previewingReceipt?.filename} className="w-full h-full" />
          ) : (
            <p className="text-sm text-text-muted">Cargando previsualización…</p>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <Button variant="ghost" size="sm" onClick={closePreview}>
            Cerrar
          </Button>
          <Button
            size="sm"
            onClick={() => previewingReceipt && handleDownload(previewingReceipt)}
            loading={downloadingId === previewingReceipt?.id}
          >
            Descargar
          </Button>
        </div>
      </Modal>

      <div className="space-y-2">
        {receipts.length === 0 ? (
          <>
            <p className="text-sm text-text-muted">Sin recibos adjuntos.</p>

            <div className="mt-1">
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleUpload(e.target.files);
                }}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex w-full items-center gap-2 rounded-lg bg-bg-elevated px-3 py-2 text-sm text-text-secondary disabled:opacity-60 disabled:cursor-not-allowed"
                aria-label="Añadir recibo"
                disabled={uploading}
                aria-busy={uploading}
              >
                {uploading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Upload className="h-4 w-4 flex-shrink-0 text-accent-lego" />
                )}
                <span className="truncate">Añadir recibo</span>
              </button>
            </div>
          </>
        ) : (
          <ul className="space-y-2">
            {receipts.map((receipt) => (
              <li
                key={receipt.id}
                className="flex items-center justify-between rounded-lg bg-bg-elevated px-3 py-2 text-sm"
              >
                <button
                  type="button"
                  onClick={() => handlePreview(receipt)}
                  title="Previsualizar recibo"
                  aria-label={`Previsualizar ${receipt.filename}`}
                  className="flex min-w-0 items-center gap-2 text-text-secondary text-left"
                >
                  <FileText className="h-4 w-4 flex-shrink-0 text-accent-lego" />
                  <span className="truncate">{receipt.filename}</span>
                </button>
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

            {/* Botón igual que un recuadro de recibo, colocado al final */}
            <li className="flex items-center justify-between rounded-lg bg-bg-elevated px-3 py-2 text-sm">
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleUpload(e.target.files);
                }}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex min-w-0 items-center gap-2 text-text-secondary w-full text-left disabled:opacity-60 disabled:cursor-not-allowed"
                aria-label="Añadir recibo"
                disabled={uploading}
                aria-busy={uploading}
              >
                {uploading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Upload className="h-4 w-4 flex-shrink-0 text-accent-lego" />
                )}
                <span className="truncate">Añadir recibo</span>
              </button>
            </li>
          </ul>
        )}

        {uploadError && <p className="text-xs text-status-error">{uploadError}</p>}
      </div>
    </>
  );
}
