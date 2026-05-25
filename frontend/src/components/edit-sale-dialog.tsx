"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, Loader2 } from "lucide-react";

export function EditSaleDialog({ sale }: { sale: { id: number, sell_price: number, platform: string | null } }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [formData, setFormData] = useState({
    sell_price: sale.sell_price.toString(),
    platform: sale.platform || ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        sell_price: parseFloat(formData.sell_price),
        platform: formData.platform || null
      };

      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${API_URL}/sales/${sale.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error("Failed to update sale");
      }

      setOpen(false);
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Error al actualizar la venta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-foreground">
          <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
        </Button>
      } />
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Detalles de Venta</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="sell_price" className="text-sm font-medium">Precio de Venta Final (€) *</label>
            <Input id="sell_price" name="sell_price" type="number" step="0.01" required value={formData.sell_price} onChange={handleChange} />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="platform" className="text-sm font-medium">Plataforma (opcional)</label>
            <select id="platform" name="platform" value={formData.platform} onChange={handleChange} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <option value="">Ninguna / Directo</option>
              <option value="Wallapop">Wallapop</option>
              <option value="Vinted">Vinted</option>
              <option value="eBay">eBay</option>
              <option value="Milanuncios">Milanuncios</option>
            </select>
          </div>

          <DialogFooter className="pt-4">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {loading ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
