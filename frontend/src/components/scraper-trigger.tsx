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
    console.log("[ScraperTrigger] Iniciando scraper...");
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      console.log(`[ScraperTrigger] Usando API_URL: ${API_URL}`);
      
      // 1. Get current status to know the "last_run" timestamp before scraping
      let initialStatusRes;
      try {
        initialStatusRes = await fetch(`${API_URL}/scraper/status`, { cache: 'no-store' });
        console.log(`[ScraperTrigger] GET /scraper/status status: ${initialStatusRes.status}`);
      } catch (err) {
        console.error("[ScraperTrigger] Error al obtener status inicial:", err);
      }
      
      const initialStatus = initialStatusRes?.ok ? await initialStatusRes.json() : { last_run: null };
      const initialLastRun = initialStatus.last_run;
      console.log(`[ScraperTrigger] Estado inicial last_run: ${initialLastRun}`);

      // 2. Trigger the scraper in the background
      console.log(`[ScraperTrigger] Llamando a POST /scraper/trigger...`);
      const res = await fetch(`${API_URL}/scraper/trigger`, {
        method: "POST"
      });
      
      if (!res.ok) {
        console.error(`[ScraperTrigger] POST /scraper/trigger falló con status: ${res.status}`);
        throw new Error("Error triggering scraper");
      }
      
      console.log(`[ScraperTrigger] Scraper trigger exitoso. Respuesta:`, await res.json().catch(() => ({})));
      
      toast.info("Scraping iniciado", {
        description: "El proceso se está ejecutando en segundo plano. Esto tomará unos segundos..."
      });

      // 3. Poll for status change every 3 seconds
      let pollCount = 0;
      const pollInterval = setInterval(async () => {
        pollCount++;
        console.log(`[ScraperTrigger] Polling intento #${pollCount}...`);
        try {
          const statusRes = await fetch(`${API_URL}/scraper/status`, { cache: 'no-store' });
          if (statusRes.ok) {
            const status = await statusRes.json();
            console.log(`[ScraperTrigger] Polling last_run actual: ${status.last_run}`);
            
            if (status.last_run !== initialLastRun) {
              console.log(`[ScraperTrigger] ¡El estado ha cambiado! Scraper finalizado.`);
              clearInterval(pollInterval);
              setLoading(false);
              toast.success("Scraper completado", {
                description: "Los precios de tus sets en stock han sido actualizados."
              });
              router.refresh();
            }
          } else {
            console.error(`[ScraperTrigger] Polling falló con status: ${statusRes.status}`);
          }
        } catch (err) {
          console.error(`[ScraperTrigger] Error en polling:`, err);
        }
      }, 3000);

      // Timeout safety: if it takes more than 60s, stop polling
      setTimeout(() => {
        clearInterval(pollInterval);
        if (loading) {
          console.warn("[ScraperTrigger] Timeout alcanzado tras 60 segundos.");
          setLoading(false);
          toast.warning("El scraping está tomando más de lo esperado", {
            description: "Por favor, recarga la página manualmente en un momento."
          });
        }
      }, 60000);

    } catch (err) {
      console.error("[ScraperTrigger] Error general en handleTrigger:", err);
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
