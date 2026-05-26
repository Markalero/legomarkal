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
import { PackagePlus, Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function AddSetDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isFound, setIsFound] = useState(false);
  const [manualOverride, setManualOverride] = useState(false);
  const [shake, setShake] = useState(false);
  const router = useRouter();

  const [formData, setFormData] = useState({
    product_id: "",
    name: "",
    theme: "",
    year_eol: "",
    buy_price: "",
    msrp: "",
    current_price: "",
    quantity: "1",
    condition: "MISB",
    notes: "",
    image_url: ""
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAutocomplete();
    }
  };

  const handleAutocomplete = async () => {
    if (!formData.product_id) return;
    setSearching(true);
    setHasSearched(false);
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
          year_eol: data.year_eol || prev.year_eol,
          msrp: data.retail_price || prev.msrp,
          current_price: data.current_price || prev.current_price,
        }));
        setIsFound(true);
        toast.success("Datos obtenidos de BrickEconomy");
      } else {
        setIsFound(false);
        setShake(true);
        setTimeout(() => setShake(false), 500);
        toast.warning("No se encontró el set o el servicio está ocupado. Puedes introducir los datos manualmente.");
      }
    } catch (err) {
      console.error(err);
      setIsFound(false);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      toast.error("Error de conexión con el servidor. Verifica que el backend esté en marcha.");
    } finally {
      setSearching(false);
      setHasSearched(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...formData,
        year_eol: formData.year_eol,
        buy_price: parseFloat(formData.buy_price),
        msrp: formData.msrp ? parseFloat(formData.msrp) : null,
        current_price: formData.current_price ? parseFloat(formData.current_price) : null,
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
      setFormData({ product_id: "", name: "", theme: "", year_eol: "", buy_price: "", msrp: "", current_price: "", quantity: "1", condition: "MISB", notes: "", image_url: "" });
      setIsFound(false);
      setManualOverride(false);
      setHasSearched(false);
      toast.success("Set añadido exitosamente al inventario.");
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("Error al añadir el set.");
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
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto overflow-x-hidden pr-2">

          <div className="flex flex-col">
            <div className={`flex gap-2 items-end ${shake ? 'animate-shake' : ''}`}>
              <div className="space-y-2 flex-1">
                <label htmlFor="product_id" className="text-sm font-medium">ID del Set *</label>
                <Input id="product_id" name="product_id" required value={formData.product_id} onChange={handleChange} onKeyDown={handleKeyDown} placeholder="ej. 75192" className={`bg-background ${shake ? 'border-destructive text-destructive' : ''}`} />
              </div>
              <Button data-testid="autocomplete-btn" type="button" variant="secondary" onClick={handleAutocomplete} disabled={searching} className="mb-[2px]">
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>

            {searching && (
              <div className="mt-6 space-y-4 animate-pulse">
                <div className="flex gap-4 items-start">
                  <div className="w-24 h-24 rounded-lg bg-slate-300 dark:bg-slate-700 shrink-0" />
                  <div className="flex-1 space-y-4 mt-2">
                    <div className="h-4 bg-slate-300 dark:bg-slate-700 rounded w-1/3" />
                    <div className="h-10 bg-slate-300 dark:bg-slate-700 rounded w-full" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-10 bg-slate-300 dark:bg-slate-700 rounded w-full" />
                  <div className="h-10 bg-slate-300 dark:bg-slate-700 rounded w-full" />
                  <div className="col-span-2 h-10 bg-slate-300 dark:bg-slate-700 rounded w-full" />
                </div>
              </div>
            )}
          </div>

          {hasSearched && !isFound && !searching && !manualOverride && (
            <div className="flex flex-col items-center justify-center py-4 space-y-2 animate-in fade-in">
              <p className="text-sm text-destructive">No se pudo obtener información.</p>
              <Button type="button" variant="link" size="sm" onClick={() => setManualOverride(true)}>
                Introducir datos manualmente
              </Button>
            </div>
          )}

          {(isFound || manualOverride) && !searching && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex gap-4 items-start">
                {formData.image_url && (
                  <div className="w-24 h-24 rounded-lg overflow-hidden border border-border bg-white/5 flex items-center justify-center shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={formData.image_url} alt={formData.name || "Set image"} className="max-w-full max-h-full object-contain" />
                  </div>
                )}
                <div className="flex-1 space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium">Nombre Oficial *</label>
                    <Input id="name" name="name" required value={formData.name} onChange={handleChange} placeholder="Ej. Millennium Falcon" className="bg-muted/50 text-muted-foreground focus-visible:ring-transparent" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 transition-all animate-in fade-in slide-in-from-left-2">
                  <label htmlFor="theme" className="text-sm font-medium">Tema</label>
                  <Input id="theme" name="theme" value={formData.theme} onChange={handleChange} placeholder="Ej. Star Wars" className="bg-muted/50 text-muted-foreground focus-visible:ring-transparent" />
                </div>
                <div className="space-y-2 transition-all animate-in fade-in slide-in-from-right-2">
                  <label htmlFor="year_eol" className="text-sm font-medium">Año / EOL</label>
                  <Input id="year_eol" name="year_eol" value={formData.year_eol} onChange={handleChange} placeholder="Ej. 2024" className="bg-muted/50 text-muted-foreground focus-visible:ring-transparent" />
                </div>
                <div className="space-y-2 col-span-2">
                  <label htmlFor="condition" className="text-sm font-medium">Condición *</label>
                  <select id="condition" name="condition" value={formData.condition} onChange={handleChange} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                    <option value="MISB">MISB (Nuevo y Sellado)</option>
                    <option value="CIB">CIB (Abierto, Completo)</option>
                    <option value="USED">Usado / Suelto</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label htmlFor="msrp" className="text-sm font-medium">PVP (€)</label>
                  <Input id="msrp" name="msrp" type="number" step="0.01" value={formData.msrp} onChange={handleChange} placeholder="0.00" className="bg-muted/50 text-muted-foreground focus-visible:ring-transparent" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="current_price" className="text-sm font-medium">V. Mercado</label>
                  <Input id="current_price" name="current_price" type="number" step="0.01" value={formData.current_price} onChange={handleChange} placeholder="0.00" className="bg-muted/50 text-muted-foreground focus-visible:ring-transparent" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="buy_price" className="text-sm font-medium">Compra (€) *</label>
                  <Input id="buy_price" name="buy_price" type="number" step="0.01" required value={formData.buy_price} onChange={handleChange} placeholder="0.00" className="bg-background font-medium" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="quantity" className="text-sm font-medium">Cant.</label>
                  <Input id="quantity" name="quantity" type="number" min="1" required value={formData.quantity} onChange={handleChange} className="bg-background font-medium" />
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
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
