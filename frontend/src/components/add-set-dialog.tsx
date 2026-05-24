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
import { PackagePlus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function AddSetDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    product_id: "",
    name: "",
    theme: "",
    buy_price: "",
    msrp: "",
    quantity: "1"
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        buy_price: parseFloat(formData.buy_price),
        msrp: formData.msrp ? parseFloat(formData.msrp) : null,
        quantity: parseInt(formData.quantity, 10)
      };

      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${API_URL}/sets/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error("Failed to create set");
      }

      setOpen(false);
      setFormData({ product_id: "", name: "", theme: "", buy_price: "", msrp: "", quantity: "1" });
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Error al añadir el set.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="gap-2" />}>
        <PackagePlus className="w-4 h-4" />
        Añadir Set
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Añadir Nuevo Set</DialogTitle>
          <DialogDescription>
            Introduce los detalles del nuevo set de LEGO para añadirlo al inventario.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="product_id" className="text-sm font-medium">ID del Set *</label>
              <Input id="product_id" name="product_id" required value={formData.product_id} onChange={handleChange} placeholder="ej. 75192" />
            </div>
            <div className="space-y-2">
              <label htmlFor="quantity" className="text-sm font-medium">Cantidad *</label>
              <Input id="quantity" name="quantity" type="number" min="1" required value={formData.quantity} onChange={handleChange} />
            </div>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">Nombre del Set *</label>
            <Input id="name" name="name" required value={formData.name} onChange={handleChange} placeholder="ej. Millennium Falcon" />
          </div>

          <div className="space-y-2">
            <label htmlFor="theme" className="text-sm font-medium">Tema</label>
            <Input id="theme" name="theme" value={formData.theme} onChange={handleChange} placeholder="ej. Star Wars" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="buy_price" className="text-sm font-medium">Precio Compra (€) *</label>
              <Input id="buy_price" name="buy_price" type="number" step="0.01" required value={formData.buy_price} onChange={handleChange} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <label htmlFor="msrp" className="text-sm font-medium">MSRP (€)</label>
              <Input id="msrp" name="msrp" type="number" step="0.01" value={formData.msrp} onChange={handleChange} placeholder="0.00" />
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {loading ? "Guardando..." : "Guardar Set"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
