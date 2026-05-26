# Informe de Estado del Proyecto: LEGO Stock Manager PRO

Este documento refleja el estado actual del desarrollo del proyecto, separando las características que ya están en producción de las futuras líneas de trabajo planificadas.

---

## 1. Implementado Actualmente (En Producción)

### 🧱 Motor Backend (FastAPI + PostgreSQL)
- **API REST Robusta:** Endpoints para gestión completa (CRUD) de Sets de LEGO, Ventas y Métricas Financieras.
- **Base de Datos Relacional:** Estructura en Supabase manejada mediante SQLAlchemy, con tablas para `LegoSet`, `Sale` y `PriceHistory`.
- **Inyección de Metadatos y Autocompletado:** Soporte completo para el registro de `year_eol` (año de retiro), precio de compra, condición del set, y notas personales. El scraper extrae en tiempo real tanto el precio de venta recomendado (MSRP) como el **valor de mercado actual**.
- **Gestión Avanzada de Ventas:** Endpoint de ventas que permite asignar **fecha de venta personalizada**. Cálculo preciso de ROI Consolidado sobre ventas (Beneficio Realizado) y ROI Potencial sobre stock (Beneficio Latente).
- **Webhook de Sincronización y Scraper Manual:** Ruta segura (`POST /api/scraper/webhook`) y nuevo endpoint (`POST /api/scraper/trigger`) para forzar la ejecución del scraper en segundo plano a demanda del usuario.

### 🖥️ Interfaz de Usuario (Next.js + Tailwind CSS)
- **Panel Principal (Dashboard):** Paneles de Inversión, Valor Estimado (con ROI Potencial) y ROI Consolidado desglosado en tramos de tiempo reales (Este mes, Últ. 6 meses, Histórico Total).
- **Gráfico de Evolución del Portfolio:** Gráfica visual dinámica que pinta en verde (beneficios) o rojo (pérdidas) la evolución del valor de mercado respecto a la inversión base a lo largo del tiempo.
- **Top Performers:** Lista clasificada (Leaderboard) integrada en el panel que destaca automáticamente los sets con mejor rentabilidad porcentual, enlazando directamente al detalle de cada producto.
- **Diálogo de Creación Inteligente:** Un modal dinámico que pre-rellena datos automáticamente desde BrickEconomy, indicando visualmente (blanco vs gris) qué campos son editables y cuáles son automáticos.
- **Tabla de Inventario y Vista Cuadrícula:** Vistas intercambiables, filtrables y ordenables (ej. ordenación por rentabilidad) con peso visual balanceado (insignias tenues para estados).
- **Vista de Detalles del Set (`/inventory/[id]`):** Pantalla inmersiva para cada producto con imagen grande, tarjetas financieras, y registro de historial.

### ⚙️ Automatización (Scraper Worker)
- **Worker Independiente (`scraper/main.py`):** Un módulo desacoplado que navega asíncronamente con navegadores ocultos (Chromium) saltando bloqueos (Cloudflare/Rate Limiting).
- **Procesamiento Histórico:** Actualiza los precios del inventario y genera puntos de historial para trazar la gráfica del dashboard.

### 🧹 Calidad de Código
- **Tests Unitarios:** Batería de pruebas en Vitest que aseguran que los formularios críticos no se rompan tras nuevas actualizaciones.

---

## 2. Planificado para Futuras Implementaciones (Roadmap / Faltante)

### 🔒 Autenticación y Seguridad
- **Sistema de Login:** Implementación de autenticación (JWT o NextAuth) para proteger el acceso al panel, evitando que cualquier visitante pueda modificar tu inventario.
- **Soporte Multi-Usuario:** Posibilidad de que cada coleccionista tenga su propia cuenta separada dentro de la misma instancia.

### 🛠 Herramientas de Productividad y Datos
- **Importación / Exportación Masiva:** Capacidad para subir un archivo CSV o Excel con compras pasadas, o descargar el inventario completo para hacer respaldos locales.
- **Gestión de Monedas (Multi-Currency):** Conversor de divisas integrado por si compras/vendes piezas en USD o GBP, normalizando el ROI al Euro.
- **Alertas de Retiro (EOL):** Notificaciones visuales de los sets que están programados para ser retirados ese mismo año (basándose en el campo `year_eol`).

### 🚀 Despliegue Automatizado y UX
- **Pipeline de GitHub Actions Real:** Desplegar formalmente el archivo `.github/workflows/scraper.yml` para que el worker empiece a correr religiosamente todas las noches sin requerir intervención humana.
- **Optimización Mobile Extrema:** Repasar a fondo las tablas y la vista Grid en resoluciones muy pequeñas (teléfonos móviles) asegurando una experiencia completamente nativa y fluida.
