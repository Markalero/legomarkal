"use client";
import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function ScraperTrigger() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const toastIdRef = useRef<string | number | undefined>(undefined);

  const handleTrigger = useCallback(async () => {
    if (loading) return;
    setLoading(true);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

    // Show initial progress toast
    toastIdRef.current = toast.loading("Iniciando actualización de precios...", {
      duration: Infinity,
      description: "Conectando con BrickEconomy...",
    });

    try {
      const res = await fetch(`${API_URL}/scraper/update-prices`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error(`Error ${res.status}: ${res.statusText}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No readable stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === "progress") {
              const pct = Math.round((event.current / event.total) * 100);

              const statusIcon = event.status === "ok" ? "✅" : "⚠️";
              toast.loading(`Actualizando precios... (${event.current}/${event.total})`, {
                id: toastIdRef.current,
                duration: Infinity,
                description: (
                  <div className="flex flex-col gap-1.5 mt-1">
                    <span className="text-xs">
                      {statusIcon} {event.name || event.product_id}
                      {event.status === "ok" && event.price != null
                        ? ` → €${event.price.toFixed(2)}`
                        : event.status === "error"
                        ? " — sin datos"
                        : ""}
                    </span>
                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                ),
              });
            } else if (event.type === "done") {
              toast.success(
                `Precios actualizados: ${event.updated}/${event.total} sets`,
                {
                  id: toastIdRef.current,
                  duration: 5000,
                  description:
                    event.updated > 0
                      ? "Los precios de tu inventario han sido actualizados correctamente."
                      : "No se pudieron obtener precios. Inténtalo de nuevo más tarde.",
                }
              );
            }
          } catch {
            // Ignore malformed lines
          }
        }
      }

      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error("Error al actualizar precios", {
        id: toastIdRef.current,
        description: "No se pudo conectar con el servidor. Verifica tu conexión.",
      });
    } finally {
      setLoading(false);
    }
  }, [loading, router]);

  return (
    <Button
      variant="ghost"
      onClick={handleTrigger}
      disabled={loading}
      className="w-full flex items-center justify-start gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-secondary text-muted-foreground transition-colors"
    >
      <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-primary" : ""}`} />
      <span>{loading ? "Actualizando precios..." : "Actualizar Precios"}</span>
    </Button>
  );
}
