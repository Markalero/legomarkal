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
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function ManageSetDialog({ set }: { set: { id: number, name: string, product_id: string } }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  const [sellPrice, setSellPrice] = useState("");
  const [platform, setPlatform] = useState("");

  const handleSell = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        sell_price: parseFloat(sellPrice),
        platform: platform || "Varios",
        receipt_url: null // receipt upload can be implemented later
      };

      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${API_URL}/sales/${set.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload)
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
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Gestionar
      </DialogTrigger>
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
