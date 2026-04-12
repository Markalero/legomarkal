// Página de login — formulario email/contraseña con JWT
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { authApi } from "@/lib/api-client";
import { storeToken } from "@/lib/auth";
import { AlertCircle } from "lucide-react";

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setApiError(null);
    try {
      const { access_token } = await authApi.login(data);
      storeToken(access_token);
      router.push("/dashboard");
    } catch (e: unknown) {
      setApiError(e instanceof Error ? e.message : "Credenciales incorrectas");
    }
  }

  return (
    <div id="main-content" className="flex min-h-screen items-center justify-center bg-bg-primary px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">
            <span className="text-accent-lego">Lego</span>
            <span className="text-text-primary">Markal</span>
          </h1>
          <p className="mt-2 text-sm text-text-muted">Panel de administración</p>
        </div>

        {/* Formulario */}
        <div className="rounded-xl border border-border bg-bg-card p-6 shadow-2xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="admin@legomarkal.com"
              autoComplete="email"
              error={errors.email?.message}
              {...register("email")}
            />
            <Input
              label="Contraseña"
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register("password")}
            />

            {apiError && (
              <div
                role="alert"
                aria-live="assertive"
                className="flex items-center gap-2 rounded-lg bg-status-error/10 px-3 py-2 text-sm text-status-error"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {apiError}
              </div>
            )}

            <Button type="submit" loading={isSubmitting} className="w-full">
              Iniciar sesión
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
