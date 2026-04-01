// Redirige la raíz hacia el dashboard si está autenticado, o al login si no
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/dashboard");
}
