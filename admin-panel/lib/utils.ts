// Utilidades de formato y helpers generales del panel LegoMarkal
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
// Condition importada solo para tipado interno; conditionLabel acepta string para compatibilidad
import type { Condition } from "@/types";

/** Combina clases Tailwind sin conflictos */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Formatea un número como moneda EUR */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
}

/** Formatea un porcentaje con signo */
export function formatPct(value: number | null | undefined): string {
  if (value == null) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

/** Formatea una fecha (ISO, timestamp o Date) como DD/MM/YYYY */
export function formatDate(value: string | number | Date | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-ES");
}

/** Etiqueta legible para el estado de condición del producto */
export function conditionLabel(condition: string | null | undefined): string {
  const labels: Record<Condition, string> = {
    SEALED: "Sellado",
    OPEN_COMPLETE: "Completo",
    OPEN_INCOMPLETE: "Incompleto",
  };
  return condition ? (labels[condition as Condition] ?? condition) : "—";
}

/** Calcula el margen porcentual entre precio de compra y precio de mercado */
export function calcMarginPct(
  purchasePrice: number | null,
  marketPrice: number | null
): number | null {
  if (!purchasePrice || !marketPrice || purchasePrice === 0) return null;
  return ((marketPrice - purchasePrice) / purchasePrice) * 100;
}

interface UiErrorInfo {
  message: string;
  details?: string;
}

/**
 * Normaliza errores tecnicos para mostrar mensajes mas claros al usuario,
 * manteniendo detalle tecnico opcional para diagnostico.
 */
export function toUiError(error: unknown, fallbackMessage: string): UiErrorInfo {
  const details = error instanceof Error ? error.message.trim() : "";
  if (!details) {
    return { message: fallbackMessage };
  }

  if (/No se pudo conectar con la API|ERR_CONNECTION_REFUSED|Failed to fetch|NetworkError/i.test(details)) {
    return {
      message: "No se pudo conectar con el servicio. Comprueba que el backend este disponible y vuelve a intentarlo.",
      details,
    };
  }

  return { message: details };
}
