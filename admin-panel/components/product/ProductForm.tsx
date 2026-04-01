// Formulario de alta/edición de producto con react-hook-form + zod
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { Product } from "@/types";

const schema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  set_number: z.string().optional(),
  theme: z.string().optional(),
  year_released: z.coerce.number().int().min(1949).max(2100).optional().or(z.literal("")),
  condition: z
    .enum(["SEALED", "OPEN_COMPLETE", "OPEN_INCOMPLETE"])
    .optional(),
  purchase_price: z.coerce.number().positive().optional().or(z.literal("")),
  purchase_date: z.string().optional(),
  purchase_source: z.string().optional(),
  quantity: z.coerce.number().int().positive().default(1),
  notes: z.string().optional(),
});

export type ProductFormData = z.infer<typeof schema>;

interface ProductFormProps {
  defaultValues?: Partial<Product>;
  onSubmit: (data: ProductFormData) => Promise<void>;
  purchaseSources?: string[];
  themeSuggestions?: string[];
  submitLabel?: string;
}

const selectClass =
  "w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-lego/50 disabled:opacity-50";

export function ProductForm({
  defaultValues,
  onSubmit,
  purchaseSources = [],
  themeSuggestions = [],
  submitLabel = "Guardar",
}: ProductFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      set_number: defaultValues?.set_number ?? "",
      theme: defaultValues?.theme ?? "",
      year_released: defaultValues?.year_released ?? "",
      condition: defaultValues?.condition ?? undefined,
      purchase_price: defaultValues?.purchase_price ?? "",
      purchase_date: defaultValues?.purchase_date ?? "",
      purchase_source: defaultValues?.purchase_source ?? "",
      quantity: defaultValues?.quantity ?? 1,
      notes: defaultValues?.notes ?? "",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Identificación */}
        <Input
          label="Nombre del producto *"
          error={errors.name?.message}
          {...register("name")}
        />
        <Input
          label="Número de set"
          placeholder="ej. 75192"
          {...register("set_number")}
        />
        <div>
          <Input
            label="Tema"
            placeholder="ej. Star Wars"
            list="theme-suggestions"
            {...register("theme")}
          />
          <datalist id="theme-suggestions">
            {themeSuggestions.map((theme) => (
              <option key={theme} value={theme} />
            ))}
          </datalist>
        </div>
        <Input
          label="Año de lanzamiento"
          type="number"
          placeholder="ej. 2017"
          {...register("year_released")}
        />

        {/* Condición */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-text-secondary">Condición</label>
          <select className={selectClass} {...register("condition")}>
            <option value="">Seleccionar…</option>
            <option value="SEALED">Sellado</option>
            <option value="OPEN_COMPLETE">Completo</option>
            <option value="OPEN_INCOMPLETE">Incompleto</option>
          </select>
        </div>

        {/* Compra */}
        <Input
          label="Precio de compra (€)"
          type="number"
          step="0.01"
          placeholder="0.00"
          {...register("purchase_price")}
        />
        <Input
          label="Fecha de compra"
          type="date"
          {...register("purchase_date")}
        />
        <div>
          <Input
            label="Fuente de compra"
            placeholder="ej. Wallapop, BrickLink"
            list="purchase-source-suggestions"
            {...register("purchase_source")}
          />
          <datalist id="purchase-source-suggestions">
            {purchaseSources.map((source) => (
              <option key={source} value={source} />
            ))}
          </datalist>
        </div>
        <Input
          label="Cantidad"
          type="number"
          min={1}
          {...register("quantity")}
        />
      </div>

      {/* Notas generales */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-text-secondary">Notas</label>
        <textarea
          rows={2}
          className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-lego/50 resize-none"
          {...register("notes")}
        />
      </div>

      <Button type="submit" loading={isSubmitting} className="w-full sm:w-auto">
        {submitLabel}
      </Button>
    </form>
  );
}
