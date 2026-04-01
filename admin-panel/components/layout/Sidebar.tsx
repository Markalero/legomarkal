// Sidebar de navegación principal del panel de administración
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  TrendingUp,
  Bell,
  LogOut,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { removeToken } from "@/lib/auth";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventario", icon: Package },
  { href: "/prices", label: "Precios", icon: TrendingUp },
  { href: "/alerts", label: "Alertas", icon: Bell },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  function handleLogout() {
    removeToken();
    router.push("/login");
  }

  return (
    <aside className="flex h-full w-56 flex-col border-r border-border bg-bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center px-5 border-b border-border">
        <span className="text-lg font-bold">
          <span className="text-accent-lego">Lego</span>
          <span className="text-text-primary">Markal</span>
        </span>
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          const pending = pendingHref === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={() => {
                if (!active) setPendingHref(href);
              }}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-accent-lego/10 text-accent-lego font-medium"
                  : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary"
              )}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <Icon className="h-4 w-4 shrink-0" />
              )}
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer: logout */}
      <div className="border-t border-border p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-bg-elevated hover:text-status-error transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
