// Componente Input con soporte para label, error y adorno izquierdo
import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef, useId } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftAddon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, leftAddon, className, id, ...props }, ref) => {
    const generatedId = useId().replace(/:/g, "");
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-") ?? `input-${generatedId}`;
    const errorId = `${inputId}-error`;
    const describedBy = ([props["aria-describedby"], error ? errorId : undefined].filter(Boolean) as string[]).join(" ") || undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm text-text-secondary">
            {label}
          </label>
        )}
        <div className="relative">
          {leftAddon && (
            <span className="absolute inset-y-0 left-3 flex items-center text-text-muted">
              {leftAddon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : props["aria-invalid"]}
            aria-describedby={describedBy}
            className={cn(
              "w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted",
              "focus:outline-none focus:ring-2 focus:ring-accent-lego/50 focus:border-accent-lego/50",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              leftAddon && "pl-9",
              error && "border-status-error focus:ring-status-error/50",
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p id={errorId} role="alert" className="text-xs text-status-error">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
