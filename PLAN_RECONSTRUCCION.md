# Plan de Reconstrucción: LEGO Stock Manager PRO

Este documento detalla la planificación por etapas para recrear desde cero la aplicación de gestión de inventario de LEGO. El enfoque es crear un sistema con una **arquitectura robusta "Zero-Cost"** (aprovechando capas gratuitas como Vercel, Supabase y GitHub Actions) y una **identidad visual completamente nueva, profesional y moderna**.

## 🎨 Nueva Identidad Visual y UI/UX

Se abandona por completo el esquema de colores naranja y negro. El nuevo diseño se basará en las mejores prácticas de aplicaciones SaaS modernas y herramientas financieras (ej. Stripe, Vercel, Linear):

*   **Paleta de Colores:**
    *   **Primario:** Azul Índigo / Cobalto (Transmite confianza, finanzas, seriedad).
    *   **Fondo:** Modo claro muy limpio (Blanco / Gris Perla) con un "Dark Mode" elegante (Gris Pizarra oscuro, no negro puro).
    *   **Acentos (Métricas):** Verde Esmeralda para ROI positivo o ganancias; Rojo Carmesí suave para alertas o pérdidas.
*   **Tipografía:** Fuentes modernas y legibles como *Inter*, *Geist* o *Roboto*.
*   **Estilo:** Minimalista. Uso de bordes sutiles, sombras suaves (glassmorphism en modales), y micro-animaciones para que la interfaz se sienta "viva" y fluida.

---

## 🏗️ Fases del Desarrollo

Dado que se ha decidido **rehacer el proyecto desde cero** para garantizar la máxima calidad técnica, el desarrollo se dividirá en las siguientes fases:

### Fase 1: Limpieza y Cimentación (Semana 1)
*   **Reinicio del Repositorio:** Eliminación del código legacy (antiguo `admin-panel`, `api` actual, etc.). Se creará una estructura limpia.
*   **Base de Datos (Supabase):** Creación del proyecto en Supabase. Diseño y despliegue del esquema de base de datos relacional (PostgreSQL) para `sets`, `sales`, `users` y métricas.
*   **Almacenamiento (Supabase Storage):** Configuración del bucket para alojar de forma segura y permanente los recibos y PDFs de ventas.

### Fase 2: Backend API Puro (Semana 2)
*   **Setup:** Inicialización del nuevo proyecto FastAPI en Python, estrictamente modular y *stateless*.
*   **Desarrollo de Endpoints:**
    *   CRUD completo para el inventario de LEGO.
    *   Lógica para registrar ventas y calcular beneficios.
    *   Endpoints de agregación para el Dashboard (Valor total, ROI, alertas de precio).
*   **Integración de Storage:** Conexión con Supabase para manejar la subida y generación de URLs seguras para los recibos.

### Fase 3: Motor de Scraping Desacoplado (Semana 3)
*   **Script Independiente:** Creación de un worker en Python con Playwright enfocado **únicamente** en extraer precios.
*   **Automatización "Zero-Cost":** Configuración de GitHub Actions para ejecutar este scraper automáticamente cada madrugada (aprovechando el runner gratuito de Ubuntu con 7GB de RAM).
*   **Sincronización:** Creación de un Webhook protegido en el Backend para que el worker de GitHub Actions envíe los nuevos precios y actualice la base de datos de manera eficiente y sin consumir memoria del servidor principal.

### Fase 4: Frontend y Panel de Control Profesional (Semanas 4-5)
*   **Setup:** Inicialización de Next.js 14 con Tailwind CSS y componentes de Shadcn UI adaptados a la nueva paleta de colores corporativa.
*   **Dashboard Principal:** Vista general con tarjetas de KPIs (Inversión total, Valor actual estimado, ROI medio) y gráficos interactivos de evolución.
*   **Gestión de Inventario:** Tabla de datos avanzada con filtros, ordenación y paginación.
*   **Fichas de Producto:** Vistas detalladas por cada set de LEGO, con el historial de precios y un flujo optimizado (modal/drawer) para registrar una venta y adjuntar su recibo en PDF.

### Fase 5: Despliegue y Pruebas (Semana 6)
*   **Despliegue del Frontend:** Configuración en Vercel.
*   **Despliegue del Backend API:** Configuración en Render (Web Service gratuito).
*   **Pruebas End-to-End (E2E):** Validar flujos críticos como la actualización de precios y el guardado de recibos.

---

> **Siguiente paso:** Una vez aprobado este plan, procederé a borrar el código antiguo e inicializar la nueva arquitectura empezando por la Fase 1.
