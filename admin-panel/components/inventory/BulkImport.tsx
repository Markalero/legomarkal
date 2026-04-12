// Componente de restauración de backup JSON con drag & drop
"use client";
import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { productsApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { FullDataImportResult } from "@/types";

interface BulkImportProps {
  onSuccess: () => void;
}

export function BulkImport({ onSuccess }: BulkImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FullDataImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    setFile(f);
    setResult(null);
    setError(null);
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await productsApi.importAllData(file);
      setResult(res);
      onSuccess();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al importar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Zona de drag & drop */}
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors cursor-pointer",
          dragging
            ? "border-accent-lego bg-accent-lego/5"
            : "border-border bg-bg-elevated hover:border-border-strong"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        onClick={() => inputRef.current?.click()}
      >
        <FileSpreadsheet className="h-10 w-10 text-text-muted" />
        <div className="text-center">
          <p className="text-sm text-text-secondary">
            Arrastra un archivo JSON aquí, o{" "}
            <span className="text-accent-lego">haz clic para seleccionar</span>
          </p>
          <p className="mt-1 text-xs text-text-muted">
            El archivo debe ser una exportación completa de LegoMarkal (formato JSON backup).
          </p>
        </div>
        {file && (
          <div className="flex items-center gap-2 rounded-lg bg-bg-card px-3 py-1.5 text-sm">
            <Upload className="h-4 w-4 text-accent-lego" />
            <span className="text-text-primary">{file.name}</span>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>

      {/* Acciones */}
      {file && (
        <Button
          onClick={handleImport}
          loading={loading}
          disabled={loading}
          className="w-full"
        >
          <Upload className="h-4 w-4" />
          Restaurar backup {file.name}
        </Button>
      )}

      {/* Resultado */}
      {result && (
        <div className="rounded-lg border border-border bg-bg-elevated p-4 space-y-2">
          <div className="flex items-center gap-2 text-status-success text-sm font-medium">
            <CheckCircle className="h-4 w-4" />
            {result.message}
          </div>
          <div className="grid gap-2 text-xs text-text-secondary sm:grid-cols-2">
            {Object.entries(result.inserted).map(([table, count]) => (
              <div key={table} className="rounded-md border border-border bg-bg-card px-2 py-1">
                <span className="font-medium text-text-primary">{table}</span>: {count} importados
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="flex items-center gap-2 text-sm text-status-error">
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
      )}
    </div>
  );
}
