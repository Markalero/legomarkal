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

/** Formatea una fecha ISO como DD/MM/YYYY */
export function formatDate(value: string | null | undefined): string {
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
