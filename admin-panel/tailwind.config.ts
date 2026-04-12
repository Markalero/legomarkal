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
        "text-muted": "#8A8A94",
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
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up-fade": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "zoom-in-fade": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(20px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out both",
        "slide-up-fade": "slide-up-fade 0.25s ease-out both",
        "zoom-in-fade": "zoom-in-fade 0.15s ease-out both",
        "slide-in-right": "slide-in-right 0.2s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
