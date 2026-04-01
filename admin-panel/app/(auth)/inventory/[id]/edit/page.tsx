// Página de edición de producto existente
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProductForm, type ProductFormData } from "@/components/product/ProductForm";
import { productsApi } from "@/lib/api-client";
import type { Product } from "@/types";

const PURCHASE_SOURCES_KEY = "legomarkal_purchase_sources";

interface Props {
  params: { id: string };
}

export default function EditProductPage({ params }: Props) {
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [purchaseSources, setPurchaseSources] = useState<string[]>([]);
  const [themeSuggestions, setThemeSuggestions] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([productsApi.get(params.id), productsApi.list({ size: 200 })]).then(([p, list]) => {
      setProduct(p);
      const themes = Array.from(new Set(list.items.map((item) => item.theme).filter(Boolean) as string[]));
      setThemeSuggestions(themes.sort((a, b) => a.localeCompare(b)));
    });
    const sources = localStorage.getItem(PURCHASE_SOURCES_KEY);
    if (sources) setPurchaseSources(JSON.parse(sources));
  }, [params.id]);

  async function handleSubmit(data: ProductFormData) {
    await productsApi.update(params.id, {
      ...data,
      year_released: data.year_released === "" ? undefined : data.year_released,
      purchase_price: data.purchase_price === "" ? undefined : data.purchase_price,
    });
    router.push(`/inventory/${params.id}`);
  }

  if (!product) {
    return (
      <div className="flex items-center justify-center py-24 text-text-muted text-sm">
        Cargando…
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <Header
        title="Editar producto"
        description={product.name}
        actions={
          <Link href={`/inventory/${params.id}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Cancelar
            </Button>
          </Link>
        }
      />
      <div className="flex-1 p-6">
        <Card className="max-w-3xl">
          <ProductForm
            defaultValues={product}
            onSubmit={handleSubmit}
            purchaseSources={purchaseSources}
            themeSuggestions={themeSuggestions}
            submitLabel="Guardar cambios"
          />
        </Card>
      </div>
    </div>
  );
}
