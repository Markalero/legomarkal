// Skeleton de carga para la página de edición de producto
export default function EditProductLoading() {
  return (
    <div className="flex flex-col animate-pulse">
      {/* Header skeleton */}
      <div className="border-b border-border bg-bg-card px-6 py-4">
        <div className="h-6 w-36 rounded-md bg-bg-elevated" />
      </div>

      <div className="flex-1 p-6">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-xl border border-border bg-bg-card p-6 space-y-5">
            {/* Grid de campos */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="h-3.5 w-24 rounded bg-bg-elevated" />
                  <div className="h-10 rounded-lg bg-bg-elevated" />
                </div>
              ))}
            </div>
            {/* Textarea notas */}
            <div className="flex flex-col gap-1.5">
              <div className="h-3.5 w-16 rounded bg-bg-elevated" />
              <div className="h-16 rounded-lg bg-bg-elevated" />
            </div>
            {/* Botón */}
            <div className="h-10 w-32 rounded-lg bg-bg-elevated" />
          </div>
        </div>
      </div>
    </div>
  );
}
