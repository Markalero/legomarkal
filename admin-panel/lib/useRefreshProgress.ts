// Hook reutilizable para gestionar el estado y la lógica del progreso de refresco de precios
"use client";
import { useState, useRef } from "react";

export interface UseRefreshProgressReturn {
  refreshing: boolean;
  progress: number;
  status: string;
  setProgress: (v: number) => void;
  setStatus: (v: string) => void;
  begin: () => void;
  end: () => void;
  startPredictiveProgress: (totalModels: number) => () => void;
  stopPredictorRef: React.MutableRefObject<(() => void) | null>;
}

export function useRefreshProgress(): UseRefreshProgressReturn {
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const stopPredictorRef = useRef<(() => void) | null>(null);

  function startPredictiveProgress(totalModels: number): () => void {
    const ceiling = 82;
    const expectedDurationMs = Math.max(6000, totalModels * 2200);
    const startTs = Date.now();

    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startTs;
      const ratio = Math.min(1, elapsed / expectedDurationMs);
      const eased = 1 - Math.pow(1 - ratio, 2);
      const predicted = Math.round(8 + (ceiling - 8) * eased);
      setProgress((prev) => Math.max(prev, predicted));
    }, 300);

    return () => window.clearInterval(timer);
  }

  function begin() {
    setRefreshing(true);
    setProgress(8);
    setStatus("Preparando sincronización");
  }

  function end() {
    stopPredictorRef.current?.();
    stopPredictorRef.current = null;
    setRefreshing(false);
    setProgress(0);
    setStatus("");
  }

  return {
    refreshing,
    progress,
    status,
    setProgress,
    setStatus,
    begin,
    end,
    startPredictiveProgress,
    stopPredictorRef,
  };
}
