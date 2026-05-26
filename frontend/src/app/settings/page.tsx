"use client";

import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";

export default function SettingsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleExport = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api'}/sets/export`;
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setIsImporting(true);
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api'}/sets/import`, {
        method: "POST",
        body: formData,
      });
      
      if (res.ok) {
        alert("Inventario importado correctamente.");
        window.location.reload();
      } else {
        const err = await res.json();
        alert(`Error al importar: ${err.detail || "Desconocido"}`);
      }
    } catch (error) {
      console.error(error);
      alert("Error de conexión al importar.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

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
          <h3 className="text-lg font-semibold mb-4">Herramientas de Exportación</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Respalda todo tu inventario descargando un archivo CSV, o sube un archivo para importar múltiples compras a la vez. Las cabeceras del CSV de importación deben coincidir con las del archivo descargado.
          </p>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Download className="w-4 h-4" />
              Descargar CSV
            </button>
            <button 
              onClick={handleImportClick}
              disabled={isImporting}
              className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {isImporting ? "Importando..." : "Subir CSV"}
            </button>
            <input 
              type="file" 
              accept=".csv" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileChange} 
            />
          </div>
        </div>

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
