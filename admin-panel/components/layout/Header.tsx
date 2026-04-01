// Header superior del panel con título de página y acciones contextuales
interface HeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function Header({ title, description, actions }: HeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-bg-card px-6 py-4">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">{title}</h1>
        {description && (
          <p className="mt-0.5 text-sm text-text-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
