import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Package, LayoutDashboard, Settings } from "lucide-react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LEGO Stock Manager PRO",
  description: "Professional LEGO inventory management and ROI tracking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning translate="no">
      <body suppressHydrationWarning className={`${inter.className} flex h-screen bg-background overflow-hidden`}>
        {/* Sidebar */}
        <aside className="w-64 border-r bg-card flex flex-col">

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
          <div className="p-4 border-t">
            <Link href="/settings" className="flex items-center gap-3 px-3 py-2 text-sm font-medium w-full text-left rounded-md hover:bg-secondary text-muted-foreground transition-colors">
              <Settings className="w-4 h-4" />
              <span>Ajustes</span>
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col h-screen overflow-y-auto">
          <div className="p-8 flex-1 max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
