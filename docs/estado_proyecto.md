# Informe de Estado del Proyecto: LEGO Stock Manager PRO

Este documento refleja el estado actual del desarrollo del proyecto, separando las características que ya están en producción de las futuras líneas de trabajo planificadas.

---

## 1. Implementado Actualmente (En Producción)

### 🧱 Motor Backend (FastAPI + PostgreSQL)
- **API REST Robusta:** Endpoints para gestión completa (CRUD) de Sets de LEGO, Ventas y Métricas Financieras.
- **Base de Datos Relacional:** Estructura en Supabase manejada mediante SQLAlchemy, con tablas para `LegoSet`, `Sale` y `PriceHistory`.
- **Inyección de Metadatos:** Soporte completo para el registro de `year_eol` (año de retiro), precio de compra, condición del set, y notas personales.
- **Motor de Scraping en Vivo:** Endpoint de Autocompletado (`/api/autocomplete/`) que extrae en tiempo real nombres, temas e imágenes desde BrickEconomy usando Playwright.
- **Webhook de Sincronización:** Ruta segura (`POST /api/scraper/webhook`) protegida por API Key para recibir actualizaciones masivas de precios sin generar bloqueos en la base de datos (Transacciones Atómicas).

### 🖥️ Interfaz de Usuario (Next.js + Tailwind CSS)
- **Panel Principal (Dashboard):** Tabla de inventario dinámica con indicadores visuales de rentabilidad (ROI), inversión total y valor actual de mercado.
- **Diálogo de Creación Inteligente:** Un modal dinámico que oculta los campos manuales hasta que se realiza una búsqueda del producto. Autocompleta automáticamente datos oficiales si el scraper funciona, o permite entrada manual si falla.
- **Vista de Detalles del Set (`/inventory/[id]`):** Una pantalla inmersiva para cada producto con imagen en grande, tarjetas financieras, y registro de historial.
- **Gestión Avanzada de Ventas:** Capacidad desde el panel frontal para deshacer ventas (devolviendo el set a `IN_STOCK`) o editar parámetros de una venta (plataforma o precio final) en caso de error.

### ⚙️ Automatización (Scraper Worker)
- **Worker Independiente (`scraper/main.py`):** Un módulo desacoplado diseñado para integrarse con GitHub Actions.
- **Extracción Masiva "Zero-Cost":** Navega asíncronamente con navegadores ocultos (Chromium) aplicando retardos aleatorios para evitar ser bloqueado (Cloudflare/Rate Limiting).
- **Procesamiento Histórico:** Actualiza los precios del inventario y genera un punto diario en el historial para trazar gráficas de evolución a largo plazo.

### 🧹 Calidad de Código
- **Tests Unitarios:** Batería de pruebas en Vitest que aseguran que los formularios críticos no se rompan tras nuevas actualizaciones.
- **Limpieza Estructural:** Repositorio optimizado, libre de scripts de prueba obsoletos y archivos de volcado pesado.

---

## 2. Planificado para Futuras Implementaciones (Roadmap)

Aunque el sistema principal ya es 100% funcional, hay varias áreas de expansión natural planificadas para llevar la plataforma al siguiente nivel:

### 🔒 Autenticación y Seguridad
- **Sistema de Login:** Implementación de autenticación (JWT o NextAuth) para proteger el acceso al panel, evitando que cualquier visitante pueda modificar tu inventario.
- **Soporte Multi-Usuario:** Posibilidad de que cada coleccionista tenga su propia cuenta separada dentro de la misma instancia.

### 📈 Analítica y Gráficas Avanzadas
- **Gráfico de Evolución del Portfolio:** Una gráfica visual de líneas que muestre el crecimiento histórico del valor total del almacén a lo largo de los meses.
- **Top Performers:** Un panel que destaque automáticamente los sets que mayor rentabilidad porcentual han generado en los últimos 30 días.

### 🛠 Herramientas de Productividad
- **Importación / Exportación Masiva:** Capacidad para subir un archivo CSV o Excel con compras pasadas, o descargar el inventario completo para hacer respaldos locales.
- **Gestión de Monedas (Multi-Currency):** Conversor de divisas integrado por si compras/vendes piezas en USD o GBP, normalizando el ROI al Euro.
- **Alertas de Retiro (EOL):** Notificaciones en el Dashboard de los sets que están programados para ser retirados ese mismo año (basándose en el campo `year_eol`).

### 🚀 Despliegue Automatizado
- **Pipeline de GitHub Actions Real:** Desplegar formalmente el archivo `.github/workflows/scraper.yml` para que el worker empiece a correr religiosamente todas las noches sin requerir intervención humana.
- **Optimización Mobile:** Ajustar los modales y las tablas de datos para que la app se maneje de forma cómoda desde teléfonos móviles a la hora de actualizar una venta sobre la marcha.
