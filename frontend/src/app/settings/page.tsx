export default function SettingsPage() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Ajustes</h2>
        <p className="text-muted-foreground mt-1">
          Configuración general de tu cuenta y preferencias de la aplicación.
        </p>
      </div>

      <div className="grid gap-6">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Configuración del Scraper</h3>
          <p className="text-sm text-muted-foreground mb-4">
            El motor de scraping se ejecuta automáticamente cada noche a través de GitHub Actions para actualizar los precios del mercado.
          </p>
          <div className="flex items-center gap-4">
            <div className="px-3 py-1 bg-success/20 text-success text-sm font-medium rounded-full">
              Activo y Sincronizado
            </div>
            <span className="text-xs text-muted-foreground">Última ejecución: Hoy, 03:00 AM</span>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Preferencias de la Cuenta</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Opciones de visualización y notificaciones (Próximamente).
          </p>
          <button disabled className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium opacity-50 cursor-not-allowed">
            Editar Perfil
          </button>
        </div>
      </div>
    </div>
  );
}
