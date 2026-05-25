"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function ScraperTrigger() {
  const [loading, setLoading] = useState(false);

  const handleTrigger = async () => {
    setLoading(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${API_URL}/scraper/trigger`, {
        method: "POST"
      });
      
      if (!res.ok) throw new Error("Error triggering scraper");
      
      toast.success("Scraper iniciado en segundo plano", {
        description: "Se actualizarán los precios de los sets en stock próximamente."
      });
    } catch (err) {
      console.error(err);
      toast.error("Error al iniciar el scraper");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      variant="ghost" 
      onClick={handleTrigger} 
      disabled={loading}
      className="w-full flex items-center justify-start gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-secondary text-muted-foreground transition-colors"
    >
      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-primary' : ''}`} />
      <span>{loading ? "Iniciando..." : "Actualizar Precios"}</span>
    </Button>
  );
}
