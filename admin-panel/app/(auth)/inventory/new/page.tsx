// Página de alta rápida de producto por código LEGO
"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { productsApi } from "@/lib/api-client";

const PURCHASE_SOURCES_KEY = "legomarkal_purchase_sources";

export default function NewProductPage() {
  const router = useRouter();
  const [purchaseSources, setPurchaseSources] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const schema = z.object({
    set_number: z
      .string()
      .trim()
      .regex(/^\d{3,7}(?:-\d+)?$/, "Introduce un código LEGO válido (ej. 75192 o 75192-1)"),
    condition: z.enum(["SEALED", "OPEN_COMPLETE", "OPEN_INCOMPLETE"]),
    purchase_price: z.coerce.number().positive("El precio debe ser mayor que 0"),
    purchase_date: z.string().min(1, "La fecha de compra es obligatoria"),
    purchase_source: z.string().trim().min(1, "La fuente de compra es obligatoria"),
    quantity: z.coerce.number().int().positive().default(1),
    notes: z.string().optional(),
  });

  type QuickFormData = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<QuickFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      set_number: "",
      condition: "SEALED",
      purchase_price: 0,
      purchase_date: "",
      purchase_source: "",
      quantity: 1,
      notes: "",
    },
  });

  useEffect(() => {
    const sources = localStorage.getItem(PURCHASE_SOURCES_KEY);
    if (sources) setPurchaseSources(JSON.parse(sources));
  }, []);

  async function onSubmit(data: QuickFormData) {
    setSubmitError(null);
    try {
      await productsApi.quickAdd({
        ...data,
        set_number: data.set_number.trim(),
        purchase_date: data.purchase_date,
        purchase_source: data.purchase_source.trim(),
        notes: data.notes || null,
      });

      // Auto-guardar la fuente de compra si es nueva
      const source = data.purchase_source.trim();
      if (source && !purchaseSources.includes(source)) {
        const updated = Array.from(new Set([...purchaseSources, source])).sort((a, b) =>
          a.localeCompare(b)
        );
        localStorage.setItem(PURCHASE_SOURCES_KEY, JSON.stringify(updated));
      }

      router.push("/inventory");
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : "No se pudo crear el producto");
    }
  }

  const selectClass =
    "w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-lego/50 disabled:opacity-50";

  return (
    <div className="flex flex-col">
      <Header
        title="Nuevo producto"
        description="Añadir artículo al inventario"
        backHref="/inventory"
      />
      <div className="flex-1 p-6 animate-slide-up-fade">
        <Card className="max-w-3xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {submitError && (
              <div className="rounded-lg border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
                {submitError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Código LEGO *"
                placeholder="Ej. 75192"
                error={errors.set_number?.message}
                {...register("set_number")}
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-text-secondary">Condición *</label>
                <select className={selectClass} {...register("condition")}>
                  <option value="SEALED">Sellado</option>
                  <option value="OPEN_COMPLETE">Completo</option>
                  <option value="OPEN_INCOMPLETE">Incompleto</option>
                </select>
              </div>

              <Input
                label="Precio de compra (€) *"
                type="number"
                step="0.01"
                placeholder="0.00"
                error={errors.purchase_price?.message}
                {...register("purchase_price")}
              />

              <Input
                label="Fecha de compra"
                type="date"
                error={errors.purchase_date?.message}
                {...register("purchase_date")}
              />

              <div>
                <Input
                  label="Fuente de compra *"
                  placeholder="ej. BrickLink, Wallapop"
                  list="purchase-source-suggestions"
                  error={errors.purchase_source?.message}
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

            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-text-secondary">Notas generales</label>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-lego/50 resize-none"
                {...register("notes")}
              />
            </div>

            <p className="text-xs text-text-muted">
              El resto de campos (nombre, temática, año e imagen principal) se obtienen automáticamente desde BrickLink al guardar.
            </p>

            <Button type="submit" loading={isSubmitting} className="w-full sm:w-auto">
              Crear producto
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
