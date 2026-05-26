"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Lock, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api'}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        const data = await res.json();
        // Set cookie manually in the browser
        document.cookie = `legomarkal_token=${data.token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Strict`;
        router.push("/");
      } else {
        setError("Contraseña incorrecta. Inténtalo de nuevo.");
      }
    } catch (err) {
      console.error(err);
      setError("Error de conexión al servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-success/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md p-8 relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-primary/10 rounded-full mb-4">
            <Package className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Bienvenido a LegoMarkal</h1>
          <p className="text-muted-foreground text-sm mt-2 text-center">
            Introduce tu contraseña maestra para acceder a tu inventario.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
              <input
                type="password"
                placeholder="Contraseña Maestra"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                required
              />
            </div>
            {error && <p className="text-sm text-destructive font-medium mt-1">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={isLoading || !password}
            className="w-full flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Acceder"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
