// Layout raíz — aplica fuente, meta y estilos globales
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LegoMarkal Admin",
  description: "Panel de gestión de inventario y precios de mercado LEGO",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen">
        <a href="#main-content" className="skip-link">
          Saltar al contenido principal
        </a>
        {children}
      </body>
    </html>
  );
}
