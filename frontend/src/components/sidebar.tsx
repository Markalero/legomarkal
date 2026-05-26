"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, LayoutDashboard, Settings, LogOut } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { ScraperTrigger } from "@/components/scraper-trigger";

export function Sidebar() {
  const pathname = usePathname();

  if (pathname === "/login") {
    return null;
  }

  const handleLogout = () => {
    document.cookie = "legomarkal_token=; path=/; max-age=0";
    window.location.href = "/login";
  };

  return (
    <aside className="w-64 border-r bg-card flex flex-col">
      <div className="p-6 border-b flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary">
          <Package className="h-6 w-6" />
          <span className="font-bold tracking-tight text-lg">LegoMarkal</span>
        </div>
        <ModeToggle />
      </div>
      <nav className="flex-1 p-4 space-y-2">
        <Link href="/" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-secondary text-foreground transition-colors">
          <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
          <span>Panel de Control</span>
        </Link>
        <Link href="/inventory" className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-secondary text-foreground transition-colors">
          <Package className="w-4 h-4 text-muted-foreground" />
          <span>Inventario</span>
        </Link>
      </nav>
      <div className="p-4 border-t space-y-2">
        <ScraperTrigger />
        <Link href="/settings" className="flex items-center gap-3 px-3 py-2 text-sm font-medium w-full text-left rounded-md hover:bg-secondary text-muted-foreground transition-colors">
          <Settings className="w-4 h-4" />
          <span>Ajustes</span>
        </Link>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 text-sm font-medium w-full text-left rounded-md hover:bg-destructive/10 text-destructive transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}
