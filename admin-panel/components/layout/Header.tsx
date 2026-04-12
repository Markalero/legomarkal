// Header superior del panel con título de página, navegación de retorno y acciones contextuales
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface HeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Si se proporciona, muestra un enlace "← Volver" a la izquierda del título */
  backHref?: string;
  /** Texto del enlace de retorno (por defecto "Volver") */
  backLabel?: string;
}

export function Header({ title, description, actions, backHref, backLabel = "Volver" }: HeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-bg-card px-6 py-4">
      <div className="flex items-center gap-3 min-w-0">
        {backHref && (
          <Link
            href={backHref}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        )}
        <div className={backHref ? "border-l border-border pl-3 min-w-0" : "min-w-0"}>
          <h1 className="truncate text-lg font-semibold text-text-primary">{title}</h1>
          {description && (
            <p className="mt-0.5 text-sm text-text-muted">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0 ml-4">{actions}</div>}
    </div>
  );
}
