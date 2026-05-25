"use client";
import { useState } from "react";
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
import { useRouter } from "next/navigation";

type LegoSet = {
  id: number;
  product_id: string;
  name: string;
  theme: string;
  buy_price: number;
  msrp: number | null;
  condition: string;
  notes: string | null;
};

export function EditSetDialog({ set }: { set: LegoSet }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [formData, setFormData] = useState({
    buy_price: set.buy_price.toString(),
    msrp: set.msrp ? set.msrp.toString() : "",
    condition: set.condition || "MISB",
    notes: set.notes || ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        buy_price: parseFloat(formData.buy_price),
        msrp: formData.msrp ? parseFloat(formData.msrp) : null,
        condition: formData.condition,
        notes: formData.notes
      };

      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${API_URL}/sets/${set.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error("Failed to update set");
      }

      setOpen(false);
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Error al actualizar el set.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
          <Pencil className="w-4 h-4" />
        </Button>
      } />
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Set: {set.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="buy_price" className="text-sm font-medium">Compra (€) *</label>
              <Input id="buy_price" name="buy_price" type="number" step="0.01" required value={formData.buy_price} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <label htmlFor="msrp" className="text-sm font-medium">PVP (€)</label>
              <Input id="msrp" name="msrp" type="number" step="0.01" value={formData.msrp} onChange={handleChange} />
            </div>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="condition" className="text-sm font-medium">Condición *</label>
            <select id="condition" name="condition" value={formData.condition} onChange={handleChange} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
              <option value="MISB">MISB (Nuevo y Sellado)</option>
              <option value="CIB">CIB (Abierto, Completo)</option>
              <option value="USED">Usado / Suelto</option>
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="notes" className="text-sm font-medium">Notas</label>
            <textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
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
