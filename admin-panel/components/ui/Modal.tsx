// Componente Modal con overlay y cierre con Escape
"use client";
import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  const selector = [
    'button:not([disabled])',
    'a[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");

  return Array.from(container.querySelectorAll<HTMLElement>(selector));
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const dialogId = useId().replace(/:/g, "");
  const titleId = `${dialogId}-title`;
  const contentRef = useRef<HTMLDivElement>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);

  // Cierre con Escape, bloqueo de scroll y trap de foco.
  useEffect(() => {
    if (!open) return;

    lastActiveElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const animationFrame = window.requestAnimationFrame(() => {
      const focusable = getFocusableElements(contentRef.current);
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        contentRef.current?.focus();
      }
    });

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== "Tab") return;

      const focusable = getFocusableElements(contentRef.current);
      if (focusable.length === 0) {
        e.preventDefault();
        contentRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handler);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = previousOverflow;

      if (lastActiveElementRef.current && document.contains(lastActiveElementRef.current)) {
        lastActiveElementRef.current.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="presentation">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Contenido */}
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : "Dialogo"}
        tabIndex={-1}
        className={cn(
          "relative z-10 w-full max-w-lg rounded-xl border border-border bg-bg-card shadow-2xl animate-zoom-in-fade",
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-border p-5">
            <h2 id={titleId} className="text-base font-semibold text-text-primary">{title}</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
              aria-label="Cerrar modal"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
