// Modal de confirmación de venta — captura precio y fecha real de venta
"use client";
import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { Input } from "./Input";

interface SellModalProps {
  open: boolean;
  productName: string;
  /** Precio de mercado sugerido como valor inicial */
  suggestedPrice: number | null;
  onConfirm: (soldPrice: number, soldDate: string) => void;
  onCancel: () => void;
}

export function SellModal({
  open,
  productName,
  suggestedPrice,
  onConfirm,
  onCancel,
}: SellModalProps) {
  const [price, setPrice] = useState("");
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Inicializa los campos cada vez que el modal se abre
  useEffect(() => {
    if (!open) return;
    setPrice(suggestedPrice != null ? String(suggestedPrice) : "");
    setDate(new Date().toISOString().slice(0, 10));
    setError(null);
  }, [open, suggestedPrice]);

  function handleConfirm() {
    const parsedPrice = parseFloat(price);
    if (!price || isNaN(parsedPrice) || parsedPrice <= 0) {
      setError("Introduce un precio de venta válido.");
      return;
    }
    if (!date) {
      setError("Introduce la fecha de venta.");
      return;
    }
    onConfirm(parsedPrice, date);
  }

  return (
    <Modal open={open} onClose={onCancel} title="Registrar venta" className="max-w-sm">
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">
          Introduce los datos reales de la venta de{" "}
          <span className="font-medium text-text-primary">{productName}</span>.
        </p>

        <Input
          label="Precio de venta (€)"
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0.00"
          value={price}
          onChange={(e) => { setPrice(e.target.value); setError(null); }}
        />
        <Input
          label="Fecha de venta"
          type="date"
          value={date}
          onChange={(e) => { setDate(e.target.value); setError(null); }}
        />

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleConfirm}>
            Confirmar venta
          </Button>
        </div>
      </div>
    </Modal>
  );
}
