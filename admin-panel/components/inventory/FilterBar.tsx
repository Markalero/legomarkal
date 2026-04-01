// Barra de filtros inline para el listado de inventario
"use client";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import type { ProductFilters, Condition } from "@/types";

interface FilterBarProps {
  filters: ProductFilters;
  themes: string[];
  onChange: (filters: ProductFilters) => void;
}

const CONDITIONS: { value: Condition; label: string }[] = [
  { value: "SEALED", label: "Sellado" },
  { value: "OPEN_COMPLETE", label: "Completo" },
  { value: "OPEN_INCOMPLETE", label: "Incompleto" },
];

const selectClass =
  "rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-lego/50";

export function FilterBar({ filters, themes, onChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-3 p-4 border-b border-border bg-bg-card">
      {/* Búsqueda de texto */}
      <div className="flex-1 min-w-48">
        <Input
          placeholder="Buscar nombre, set ID…"
          leftAddon={<Search className="h-4 w-4" />}
          value={filters.search ?? ""}
          onChange={(e) => onChange({ ...filters, search: e.target.value, page: 1 })}
        />
      </div>

      {/* Filtro tema */}
      <select
        className={selectClass}
        value={filters.theme ?? ""}
        onChange={(e) =>
          onChange({ ...filters, theme: e.target.value || undefined, page: 1 })
        }
      >
        <option value="">Todos los temas</option>
        {themes.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      {/* Filtro condición */}
      <select
        className={selectClass}
        value={filters.condition ?? ""}
        onChange={(e) =>
          onChange({
            ...filters,
            condition: (e.target.value as Condition) || undefined,
            page: 1,
          })
        }
      >
        <option value="">Todas las condiciones</option>
        {CONDITIONS.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

      {/* Filtro disponibilidad */}
      <select
        className={selectClass}
        value={filters.availability ?? ""}
        onChange={(e) =>
          onChange({
            ...filters,
            availability: (e.target.value as "available" | "sold" | "") || undefined,
            page: 1,
          })
        }
      >
        <option value="">Disponibilidad: todos</option>
        <option value="available">Disponible</option>
        <option value="sold">Vendido</option>
      </select>
    </div>
  );
}
