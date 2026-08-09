"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function ScraperTrigger() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleTrigger = async () => {
    setLoading(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      
      // 1. Get current status to know the "last_run" timestamp before scraping
      let initialStatusRes;
      try {
        initialStatusRes = await fetch(`${API_URL}/scraper/status`, { cache: 'no-store' });
      } catch {
        // Ignorar error inicial
      }
      const initialStatus = initialStatusRes?.ok ? await initialStatusRes.json() : { last_run: null };
      const initialLastRun = initialStatus.last_run;

      // 2. Trigger the scraper in the background
      const res = await fetch(`${API_URL}/scraper/trigger`, {
        method: "POST"
      });
      
      if (!res.ok) throw new Error("Error triggering scraper");
      
      toast.info("Scraping iniciado", {
        description: "El proceso se está ejecutando en segundo plano. Esto tomará unos segundos..."
      });

      // 3. Poll for status change every 3 seconds
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`${API_URL}/scraper/status`, { cache: 'no-store' });
          if (statusRes.ok) {
            const status = await statusRes.json();
            if (status.last_run !== initialLastRun) {
              clearInterval(pollInterval);
              setLoading(false);
              toast.success("Scraper completado", {
                description: "Los precios de tus sets en stock han sido actualizados."
              });
              router.refresh();
            }
          }
        } catch {
          // Keep trying if network briefly drops
        }
      }, 3000);

      // Timeout safety: if it takes more than 60s, stop polling
      setTimeout(() => {
        clearInterval(pollInterval);
        if (loading) {
          setLoading(false);
          toast.warning("El scraping está tomando más de lo esperado", {
            description: "Por favor, recarga la página manualmente en un momento."
          });
        }
      }, 60000);

    } catch (err) {
      console.error(err);
      toast.error("Error al iniciar el scraper");
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
      <span>{loading ? "Actualizando precios..." : "Actualizar Precios"}</span>
    </Button>
  );
}
