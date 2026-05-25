"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RotateCcw, Loader2, AlertCircle } from "lucide-react";

export function UndoSaleDialog({ sale }: { sale: { id: number, sell_price: number } }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleUndo = async () => {
    setLoading(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${API_URL}/sales/${sale.id}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        throw new Error("Failed to undo sale");
      }

      setOpen(false);
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Error al deshacer la venta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="ghost" size="sm" className="h-8 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive">
          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Deshacer
        </Button>
      } />
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            Deshacer Venta
          </DialogTitle>
          <DialogDescription className="pt-2">
            ¿Estás seguro de que deseas deshacer esta venta de <strong>€{sale.sell_price.toFixed(2)}</strong>? El set volverá a marcarse como &quot;EN STOCK&quot; en tu inventario.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="pt-4 flex gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleUndo} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {loading ? "Deshaciendo..." : "Deshacer Venta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
