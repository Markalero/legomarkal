// Configuración Tailwind con tokens de color de la marca LegoMarkal
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Fondos
        "bg-primary": "#0A0A0B",
        "bg-card": "#141416",
        "bg-elevated": "#1C1C1F",
        "bg-hover": "#222225",
        // Bordes
        border: "#2A2A2D",
        "border-strong": "#3A3A3D",
        // Texto
        "text-primary": "#F5F5F7",
        "text-secondary": "#A1A1AA",
        "text-muted": "#71717A",
        // Acentos de marca
        "accent-lego": "#F59E0B",
        "accent-lego-dark": "#D97706",
        "accent-info": "#3B82F6",
        // Estados
        "status-success": "#10B981",
        "status-warning": "#F97316",
        "status-error": "#EF4444",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
