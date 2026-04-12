// Layout protegido — redirige a /login si no hay token válido
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Menu } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const authenticated = isAuthenticated();
    setIsAuthed(authenticated);
    setIsReady(true);

    if (!authenticated) {
      router.replace("/login");
    }
  }, [router]);

  if (!isReady || !isAuthed) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar className="hidden md:flex" />

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navegacion principal">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Cerrar menu de navegacion"
          />
          <Sidebar
            className="relative z-10 h-full w-64 shadow-2xl"
            onNavigate={() => setMobileSidebarOpen(false)}
            showCloseButton
            onClose={() => setMobileSidebarOpen(false)}
          />
        </div>
      )}

      <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border bg-bg-card px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary"
            aria-label="Abrir menu de navegacion"
          >
            <Menu className="h-4 w-4" />
            Menu
          </button>
          <span className="text-sm font-semibold text-text-primary">LegoMarkal</span>
        </div>
        {children}
      </main>
    </div>
  );
}
