// Componente de subida múltiple de imágenes hacia la API (que las persiste en Supabase Storage)
"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Star, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { getToken } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { productsApi } from "@/lib/api-client";

interface ImageUploadProps {
  productId: string;
  images: string[];
  onUpdate: (images: string[]) => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function ImageUpload({ productId, images, onUpdate }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [confirmRemoveUrl, setConfirmRemoveUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!viewerOpen) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setViewerOpen(false);
      if (event.key === "ArrowRight") setViewerIndex((idx) => (idx + 1) % images.length);
      if (event.key === "ArrowLeft") setViewerIndex((idx) => (idx - 1 + images.length) % images.length);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [viewerOpen, images.length]);

  async function handleFiles(files: FileList) {
    setUploading(true);
    setError(null);
    try {
      const token = getToken();
      const form = new FormData();
      Array.from(files).forEach((f) => form.append("files", f));

      const res = await fetch(`${API_URL}/products/${productId}/images`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const { images: updated } = await res.json();
      onUpdate(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al subir imágenes");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(url: string) {
    setError(null);
    try {
      const updated = images.filter((img) => img !== url);
      await productsApi.update(productId, { images: updated });
      onUpdate(updated);
      if (viewerOpen && viewerIndex >= updated.length) {
        setViewerIndex(Math.max(0, updated.length - 1));
      }
      if (updated.length === 0) {
        setViewerOpen(false);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al eliminar la imagen");
    }
  }

  async function handleSetFeatured(url: string) {
    setError(null);
    try {
      const next = [url, ...images.filter((img) => img !== url)];
      await productsApi.update(productId, { images: next });
      onUpdate(next);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al marcar imagen destacada");
    }
  }

  function resolveImageUrl(url: string) {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    return new URL(url, API_URL).toString();
  }

  return (
    <div className="space-y-3">
      <ConfirmModal
        open={confirmRemoveUrl !== null}
        title="Eliminar imagen"
        message="¿Seguro que quieres eliminar esta imagen?"
        confirmLabel="Eliminar"
        onConfirm={() => {
          if (confirmRemoveUrl) handleRemove(confirmRemoveUrl);
          setConfirmRemoveUrl(null);
        }}
        onCancel={() => setConfirmRemoveUrl(null)}
      />
      {/* Miniaturas existentes */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((url, index) => (
            <div key={url} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-border">
              <button
                type="button"
                onClick={() => {
                  setViewerIndex(index);
                  setViewerOpen(true);
                }}
                className="absolute inset-0"
                title="Ver imagen"
              >
                <Image
                  src={resolveImageUrl(url)}
                  alt="Imagen del producto"
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </button>
              <div className="absolute inset-0 bg-black/35 opacity-0 transition-opacity group-hover:opacity-100" />
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleSetFeatured(url);
                }}
                className="absolute right-1 top-1 z-10 rounded-full bg-black/70 p-1 text-white"
                title={index === 0 ? "Imagen destacada" : "Marcar como destacada"}
              >
                <Star className={`h-3.5 w-3.5 ${index === 0 ? "fill-yellow-300 text-yellow-300" : "text-white"}`} />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setConfirmRemoveUrl(url);
                }}
                className="absolute left-1 top-1 z-10 rounded-full bg-black/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                title="Eliminar imagen"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Botón de subida */}
      <div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={uploading}
          onClick={() => inputRef.current?.click()}
          className={cn(images.length === 0 && "w-full justify-center py-8 border-dashed border-border")}
        >
          <Upload className="h-4 w-4" />
          {images.length === 0 ? "Añadir imágenes" : "Añadir más"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
          }}
        />
      </div>

      {error && <p className="text-xs text-status-error">{error}</p>}

      {viewerOpen && images.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <button
            type="button"
            onClick={() => setViewerOpen(false)}
            className="absolute right-4 top-4 rounded-full bg-black/70 p-2 text-white"
            title="Cerrar visor"
          >
            <X className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => setViewerIndex((idx) => (idx - 1 + images.length) % images.length)}
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/70 p-2 text-white"
            title="Imagen anterior"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          <button
            type="button"
            onClick={() => setViewerIndex((idx) => (idx + 1) % images.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/70 p-2 text-white"
            title="Siguiente imagen"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          <div className="relative h-[70vh] w-full max-w-5xl">
            <Image
              src={resolveImageUrl(images[viewerIndex])}
              alt="Vista ampliada"
              fill
              className="object-contain"
              sizes="100vw"
            />
          </div>

          <div className="absolute bottom-4 left-1/2 flex max-w-[90vw] -translate-x-1/2 gap-2 overflow-x-auto rounded-lg bg-black/60 p-2">
            {images.map((img, idx) => (
              <button
                key={img}
                type="button"
                onClick={() => setViewerIndex(idx)}
                className={`relative h-14 w-14 overflow-hidden rounded-md border ${
                  idx === viewerIndex ? "border-accent-lego" : "border-transparent"
                }`}
                title={`Imagen ${idx + 1}`}
              >
                <Image src={resolveImageUrl(img)} alt={`Miniatura ${idx + 1}`} fill className="object-cover" sizes="56px" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
