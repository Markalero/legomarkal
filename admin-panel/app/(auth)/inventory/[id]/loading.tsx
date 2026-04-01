// Skeleton de carga para la ficha de producto — se muestra mientras Next.js suspende la página
export default function ProductDetailLoading() {
  return (
    <div className="flex flex-col animate-pulse">
      {/* Header skeleton */}
      <div className="border-b border-border bg-bg-card px-6 py-4">
        <div className="h-6 w-48 rounded-md bg-bg-elevated" />
        <div className="mt-1 h-4 w-24 rounded-md bg-bg-elevated" />
      </div>

      <div className="flex-1 space-y-6 p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Columna izquierda */}
          <div className="space-y-6 lg:col-span-2">
            {/* Card Detalles */}
            <div className="rounded-xl border border-border bg-bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="h-5 w-20 rounded-md bg-bg-elevated" />
                <div className="flex gap-2">
                  <div className="h-7 w-20 rounded-full bg-bg-elevated" />
                  <div className="h-7 w-20 rounded-md bg-bg-elevated" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i}>
                    <div className="h-3 w-16 rounded bg-bg-elevated" />
                    <div className="mt-1.5 h-4 w-24 rounded bg-bg-elevated" />
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-border pt-4 flex justify-end">
                <div className="h-7 w-14 rounded-full bg-bg-elevated" />
              </div>
            </div>

            {/* Card Historial de precios */}
            <div className="rounded-xl border border-border bg-bg-card p-5">
              <div className="mb-4 h-5 w-40 rounded-md bg-bg-elevated" />
              <div className="h-[220px] rounded-lg bg-bg-elevated" />
            </div>
          </div>

          {/* Columna derecha */}
          <div className="space-y-6">
            {/* Card Imágenes */}
            <div className="rounded-xl border border-border bg-bg-card p-5">
              <div className="mb-3 h-5 w-20 rounded-md bg-bg-elevated" />
              <div className="h-32 rounded-lg bg-bg-elevated" />
            </div>

            {/* Card Precio de mercado */}
            <div className="rounded-xl border border-border bg-bg-card p-5">
              <div className="mb-4 h-5 w-36 rounded-md bg-bg-elevated" />
              <div className="h-9 w-28 rounded-md bg-bg-elevated" />
              <div className="mt-3 h-12 rounded-lg bg-bg-elevated" />
            </div>

            {/* Card Alertas */}
            <div className="rounded-xl border border-border bg-bg-card p-5">
              <div className="mb-4 h-5 w-24 rounded-md bg-bg-elevated" />
              <div className="h-20 rounded-lg bg-bg-elevated" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
