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
import { PackagePlus, Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";

export function AddSetDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    product_id: "",
    name: "",
    theme: "",
    buy_price: "",
    msrp: "",
    target_price: "",
    quantity: "1",
    condition: "MISB",
    notes: "",
    image_url: ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAutocomplete = async () => {
    if (!formData.product_id) return;
    setSearching(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${API_URL}/autocomplete/${formData.product_id}`);
      
      if (res.ok) {
        const data = await res.json();
        setFormData(prev => ({
          ...prev,
          name: data.name || prev.name,
          theme: data.theme !== "N/A" ? data.theme : prev.theme,
          image_url: data.image_url || prev.image_url,
        }));
      } else {
        alert("No se encontró el set en BrickEconomy o el servicio está ocupado. Intenta de nuevo en unos segundos.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        buy_price: parseFloat(formData.buy_price),
        msrp: formData.msrp ? parseFloat(formData.msrp) : null,
        target_price: formData.target_price ? parseFloat(formData.target_price) : null,
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
      setFormData({ product_id: "", name: "", theme: "", buy_price: "", msrp: "", target_price: "", quantity: "1", condition: "MISB", notes: "", image_url: "" });
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
      <DialogContent className="sm:max-w-[500px] bg-background/80 backdrop-blur-xl border-white/20 shadow-2xl">
        <DialogHeader>
          <DialogTitle>Añadir Nuevo Set</DialogTitle>
          <DialogDescription>
            Introduce el ID y usa la varita para autocompletar mágicamente extrayendo los datos de BrickEconomy. 
            <br/><span className="text-amber-500 font-semibold mt-1 inline-block">⏳ Nota: El escaneo invisible puede tardar unos 5-10 segundos.</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto px-1">
          
          <div className="flex flex-col">
            <div className="flex gap-2 items-end">
              <div className="space-y-2 flex-1">
                <label htmlFor="product_id" className="text-sm font-medium">ID del Set (EAN/SKU) *</label>
                <Input id="product_id" name="product_id" required value={formData.product_id} onChange={handleChange} placeholder="ej. 75192" />
              </div>
              <Button type="button" variant="secondary" onClick={handleAutocomplete} disabled={searching} className="mb-[2px]">
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            
            {searching && (
              <div className="mt-3 space-y-1.5 transition-all animate-in fade-in slide-in-from-top-1">
                <div className="flex justify-between text-xs text-amber-500 font-medium">
                  <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Extrayendo datos de BrickEconomy...</span>
                </div>
                <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full w-full animate-pulse"></div>
                </div>
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">Nombre Oficial *</label>
            <Input id="name" name="name" required value={formData.name} onChange={handleChange} placeholder="ej. Millennium Falcon" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="theme" className="text-sm font-medium">Tema</label>
              <Input id="theme" name="theme" value={formData.theme} onChange={handleChange} placeholder="ej. Star Wars" />
            </div>
            <div className="space-y-2">
              <label htmlFor="condition" className="text-sm font-medium">Condición *</label>
              <select id="condition" name="condition" value={formData.condition} onChange={handleChange} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                <option value="MISB">MISB (Nuevo y Sellado)</option>
                <option value="CIB">CIB (Abierto, Completo)</option>
                <option value="USED">Usado / Suelto</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label htmlFor="buy_price" className="text-sm font-medium">Compra (€) *</label>
              <Input id="buy_price" name="buy_price" type="number" step="0.01" required value={formData.buy_price} onChange={handleChange} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <label htmlFor="target_price" className="text-sm font-medium">Target (€)</label>
              <Input id="target_price" name="target_price" type="number" step="0.01" value={formData.target_price} onChange={handleChange} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <label htmlFor="quantity" className="text-sm font-medium">Cant.</label>
              <Input id="quantity" name="quantity" type="number" min="1" required value={formData.quantity} onChange={handleChange} />
            </div>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="notes" className="text-sm font-medium">Notas de Condición / Desperfectos</label>
            <textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} placeholder="ej. La esquina de la caja está abollada..." className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
          </div>

          <DialogFooter className="pt-4">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {loading ? "Guardando..." : "Guardar Set en Inventario"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
