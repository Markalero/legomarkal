"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";

export function ManageSetDialog({ set }: { set: { id: number, name: string, product_id: string } }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  const [sellPrice, setSellPrice] = useState("");
  const [sellDate, setSellDate] = useState(new Date().toISOString().split("T")[0]);
  const [platform, setPlatform] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const handleSell = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("sell_price", sellPrice);
      if (platform) {
        formData.append("platform", platform);
      } else {
        formData.append("platform", "Varios");
      }
      if (sellDate) {
        formData.append("sell_date", sellDate);
      }
      if (receiptFile) {
        formData.append("receipt", receiptFile);
      }

      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${API_URL}/sales/set/${set.id}`, {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        throw new Error("Failed to register sale");
      }

      setOpen(false);
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Error al registrar la venta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="ghost" size="icon" className="h-8 w-8 text-success hover:bg-success/10 hover:text-success" title="Vender">
          <ShoppingCart className="w-4 h-4" />
        </Button>
      } />
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Gestionar Set: {set.name}</DialogTitle>
          <DialogDescription>
            Registra una venta para este set (ID: {set.product_id}).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSell} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="sell_price" className="text-sm font-medium">Precio Venta (€) *</label>
              <Input id="sell_price" required type="number" step="0.01" value={sellPrice} onChange={e => setSellPrice(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <label htmlFor="platform" className="text-sm font-medium">Plataforma</label>
              <Input id="platform" value={platform} onChange={e => setPlatform(e.target.value)} placeholder="ej. Wallapop" />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="sell_date" className="text-sm font-medium">Fecha de Venta</label>
            <Input id="sell_date" type="date" value={sellDate} onChange={e => setSellDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label htmlFor="receipt" className="text-sm font-medium">Recibo / Justificante (Opcional)</label>
            <Input id="receipt" type="file" accept="application/pdf,image/*" onChange={e => setReceiptFile(e.target.files?.[0] || null)} />
            <p className="text-xs text-muted-foreground">Sube el PDF o imagen de la factura de venta.</p>
          </div>
          <DialogFooter className="pt-4">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {loading ? "Registrando..." : "Registrar Venta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
