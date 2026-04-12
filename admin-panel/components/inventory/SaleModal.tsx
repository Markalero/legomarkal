// Modal de venta con subida opcional de recibos PDF
"use client";
import { useEffect, useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { productsApi } from "@/lib/api-client";

interface SaleModalProps {
  open: boolean;
  /** ID del producto que se va a marcar como vendido */
  productId: string;
  productName: string;
  /** Precio de mercado sugerido como valor inicial */
  suggestedPrice: number | null;
  /** Se llama tras PATCH + upload exitosos; el padre decide cómo refrescar */
  onSuccess: () => void;
  onCancel: () => void;
}

export function SaleModal({
  open,
  productId,
  productName,
  suggestedPrice,
  onSuccess,
  onCancel,
}: SaleModalProps) {
  const [price, setPrice] = useState("");
  const [date, setDate] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Resetea el formulario cada vez que el modal se abre
  useEffect(() => {
    if (!open) return;
    setPrice(suggestedPrice != null ? String(suggestedPrice) : "");
    setDate(new Date().toISOString().slice(0, 10));
    setFiles([]);
    setError(null);
  }, [open, suggestedPrice]);

  function handleFilePick(picked: FileList) {
    const pdfs = Array.from(picked).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    if (pdfs.length < picked.length) {
      setError("Solo se aceptan archivos PDF.");
    } else {
      setError(null);
    }
    setFiles((prev) => [...prev, ...pdfs]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleConfirm() {
    const parsedPrice = parseFloat(price);
    if (!price || isNaN(parsedPrice) || parsedPrice <= 0) {
      setError("Introduce un precio de venta válido.");
      return;
    }
    if (!date) {
      setError("Introduce la fecha de venta.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // 1. Marcar como vendido
      await productsApi.update(productId, {
        availability: "sold",
        sold_price: parsedPrice,
        sold_date: date,
      });
      // 2. Subir recibos si los hay
      if (files.length > 0) {
        await productsApi.uploadSaleReceipts(productId, files);
      }
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al registrar la venta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onCancel} title="Registrar venta" className="max-w-sm">
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Datos de la venta de{" "}
          <span className="font-medium text-text-primary">{productName}</span>.
        </p>

        <Input
          label="Precio de venta (€)"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0.00"
          value={price}
          onChange={(e) => {
            setPrice(e.target.value);
            setError(null);
          }}
        />
        <Input
          label="Fecha de venta"
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setError(null);
          }}
        />

        {/* Dropzone PDF */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-text-secondary">
            Recibos PDF (opcional)
          </p>

          {files.length > 0 && (
            <ul className="space-y-1">
              {files.map((f, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-bg-elevated px-3 py-1.5 text-xs text-text-secondary"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 flex-shrink-0 text-accent-lego" />
                    <span className="truncate">{f.name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="ml-2 flex-shrink-0 text-text-muted hover:text-status-error"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full justify-center border-dashed"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
          >
            <Upload className="h-4 w-4" />
            Añadir PDF
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) handleFilePick(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {error && <p className="text-xs text-status-error">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleConfirm} loading={loading}>
            Confirmar venta
          </Button>
        </div>
      </div>
    </Modal>
  );
}
