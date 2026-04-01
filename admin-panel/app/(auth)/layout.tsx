// Layout protegido — redirige a /login si no hay token válido
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

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
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
