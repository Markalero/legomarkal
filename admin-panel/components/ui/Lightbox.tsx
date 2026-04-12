// Lightbox reutilizable para visualización ampliada de imágenes
"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface LightboxProps {
  images: string[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
  showThumbnails?: boolean;
}

export function Lightbox({ images, initialIndex = 0, open, onClose, showThumbnails = true }: LightboxProps) {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    if (!open) return;
    setIndex(initialIndex);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % images.length);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + images.length) % images.length);
    };
    // Evitar scroll del body mientras está abierto
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, initialIndex, images.length, onClose]);

  if (!open) return null;
  if (!images || images.length === 0) return null;

  function prev() {
    setIndex((i) => (i - 1 + images.length) % images.length);
  }

  function next() {
    setIndex((i) => (i + 1) % images.length);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-6xl max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Contenedor de controles */}
        <div className="absolute left-4 top-4 z-20 flex items-center gap-2 text-sm text-white">
          <span className="rounded-md bg-black/40 px-2 py-1">{index + 1} / {images.length}</span>
        </div>

        {/* Botón cerrar dentro del contenedor (pegado a la imagen) */}
        <button
          aria-label="Cerrar"
          className="absolute right-4 top-4 z-20 inline-flex items-center justify-center rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>

        {/* Flechas laterales */}
        <button
          aria-label="Anterior"
          onClick={prev}
          className="absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        <button
          aria-label="Siguiente"
          onClick={next}
          className="absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
        >
          <ChevronRight className="h-6 w-6" />
        </button>

        {/* Imagen principal */}
        <div className="relative mx-auto h-[72vh] w-full rounded-lg bg-black/90 shadow-lg animate-zoom-in-fade overflow-hidden">
          <Image src={images[index]} alt={`Imagen ${index + 1}`} fill className="object-contain bg-black" sizes="100vw" />
        </div>

        {/* Acciones rápidas */}
        <div className="absolute right-4 bottom-24 z-20 flex items-center gap-2">
          <a href={images[index]} target="_blank" rel="noreferrer" title="Abrir en nueva pestaña">
            <Button variant="ghost" size="sm">
              <Download className="h-4 w-4" />
            </Button>
          </a>
        </div>

        {/* Thumbnails */}
        {showThumbnails && (
          <div className="absolute left-1/2 bottom-6 z-20 flex max-w-[90vw] -translate-x-1/2 items-center gap-2 overflow-x-auto rounded-lg bg-black/50 p-2">
            {images.map((img, idx) => (
              <button
                key={img}
                type="button"
                onClick={() => setIndex(idx)}
                className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-md border ${idx === index ? "border-accent-lego" : "border-transparent"}`}
                title={`Imagen ${idx + 1}`}
              >
                <Image src={img} alt={`Miniatura ${idx + 1}`} fill className="object-cover" sizes="56px" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Lightbox;
