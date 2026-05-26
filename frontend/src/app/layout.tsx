import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/sidebar";
import { Toaster } from "sonner";

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
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {/* Sidebar */}
          <Sidebar />

          {/* Main Content */}
          <main className="flex-1 flex flex-col h-screen overflow-y-auto">
            <div className="p-8 flex-1 max-w-7xl mx-auto w-full">
              {children}
            </div>
          </main>
          <Toaster position="bottom-right" richColors theme="system" />
        </ThemeProvider>
      </body>
    </html>
  );
}
