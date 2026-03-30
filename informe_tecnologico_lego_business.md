# Plan Tecnológico — Empresa de Reventa de LEGO de Coleccionista

## Documento de referencia para el equipo técnico

**Autor:** Generado con asistencia de IA  
**Fecha:** Marzo 2026  
**Destinatario:** Fundador + Ingeniero informático  
**Objetivo:** Guiar paso a paso la construcción de toda la infraestructura tecnológica del negocio, desde una versión mínima funcional hasta un sistema completo y escalable.

---

## Índice

1. [Visión general y filosofía del proyecto](#1-visión-general-y-filosofía-del-proyecto)
2. [Arquitectura global del sistema](#2-arquitectura-global-del-sistema)
3. [Versión 1 — MVP: Inventario + Precios de mercado](#3-versión-1--mvp-inventario--precios-de-mercado)
4. [Versión 2 — Tienda web propia conectada al stock](#4-versión-2--tienda-web-propia-conectada-al-stock)
5. [Versión 3 — Venta multicanal sincronizada](#5-versión-3--venta-multicanal-sincronizada)
6. [Versión 4 — Analítica, dashboard y decisiones de negocio](#6-versión-4--analítica-dashboard-y-decisiones-de-negocio)
7. [Versión 5 — Facturación, logística y CRM](#7-versión-5--facturación-logística-y-crm)
8. [Versión 6 — Automatización avanzada e inteligencia](#8-versión-6--automatización-avanzada-e-inteligencia)
9. [Infraestructura, hosting y DevOps](#9-infraestructura-hosting-y-devops)
10. [Resumen de stack tecnológico por versión](#10-resumen-de-stack-tecnológico-por-versión)
11. [Cronograma orientativo](#11-cronograma-orientativo)
12. [Glosario técnico](#12-glosario-técnico)

---

## 1. Visión general y filosofía del proyecto

### 1.1. El problema que resolvemos

Un coleccionista de LEGO que quiere convertir su afición en negocio se enfrenta a varios retos operativos: no sabe exactamente qué tiene, no conoce el valor real de mercado de cada pieza en cada momento, vende en múltiples plataformas sin sincronización (con riesgo de vender lo mismo dos veces), y no tiene datos para tomar decisiones de compra o venta inteligentes.

### 1.2. El principio rector: construir por capas

Este plan sigue una arquitectura incremental. Cada versión es funcional por sí sola y añade valor sobre la anterior. No se necesita construir todo para empezar a operar: con la Versión 1 ya se tiene control del negocio, y con la Versión 2 ya se puede vender online.

### 1.3. Decisiones de diseño fundamentales

- **Backend en Python (FastAPI):** Lenguaje versátil, enorme ecosistema para scraping, análisis de datos e IA. FastAPI es moderno, rápido y genera documentación de API automática.
- **Base de datos PostgreSQL:** Robusta, gratuita, excelente para consultas complejas y escalable. Soporta JSON nativo para datos semi-estructurados (útil para datos variables de sets LEGO).
- **Frontend en React (con Next.js):** Estándar de la industria, enorme comunidad, permite construir tanto el panel interno como la tienda web con la misma tecnología.
- **Arquitectura API-first:** Todo el sistema se comunica mediante una API REST. Esto significa que el panel de gestión, la tienda web, la app móvil futura y cualquier integración externa consumen los mismos endpoints. Se construye una vez, se usa en todas partes.

---

## 2. Arquitectura global del sistema

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTES / CANALES                    │
│  Tienda Web ── App Móvil ── BrickLink ── eBay ── Otros │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS / APIs
┌────────────────────────▼────────────────────────────────┐
│                  API CENTRAL (FastAPI)                    │
│  Inventario · Precios · Pedidos · Usuarios · Analítica  │
└──┬──────────┬──────────┬──────────┬──────────┬──────────┘
   │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼
PostgreSQL  Redis     Scraper    Pasarela    Servicio
(datos)    (caché)   de precios  de pago    de envíos
```

Toda la lógica de negocio vive en la API central. Los distintos frontends (panel de gestión, tienda, integraciones) son consumidores de esa API. Esto permite cambiar o añadir canales sin tocar el núcleo.

---

## 3. Versión 1 — MVP: Inventario + Precios de mercado

> **Objetivo:** Tener control total de lo que se posee y su valor real de mercado.  
> **Tiempo estimado:** 4-6 semanas.  
> **Resultado:** Un panel web interno donde el fundador ve todo su stock, con precios actualizados.

### 3.1. Base de datos del inventario

#### Tecnologías

- **PostgreSQL 16+** como motor de base de datos.
- **SQLAlchemy** como ORM (Object-Relational Mapper) para interactuar con la base de datos desde Python sin escribir SQL a mano.
- **Alembic** para gestionar migraciones (cambios en la estructura de la base de datos a lo largo del tiempo).

#### Modelo de datos principal

Se necesitan las siguientes tablas en la base de datos. Cada tabla se describe con sus campos, tipo de dato y propósito:

**Tabla `categories`** — Clasifica los productos en tipos.

| Campo       | Tipo         | Descripción                                  |
|-------------|--------------|----------------------------------------------|
| id          | UUID         | Identificador único                          |
| name        | VARCHAR(100) | Nombre (Set sellado, Set abierto, Minifigura, Pieza suelta, Lote) |
| description | TEXT         | Descripción opcional de la categoría         |

**Tabla `products`** — Cada artículo individual del inventario.

| Campo              | Tipo          | Descripción                                           |
|--------------------|---------------|-------------------------------------------------------|
| id                 | UUID          | Identificador único interno                           |
| category_id        | UUID (FK)     | Referencia a la categoría                             |
| set_number         | VARCHAR(20)   | Número oficial de LEGO (ej: 75192, sw0001a)           |
| name               | VARCHAR(255)  | Nombre del producto                                   |
| theme              | VARCHAR(100)  | Tema LEGO (Star Wars, Technic, City...)               |
| year_released      | INTEGER       | Año de lanzamiento original                           |
| condition          | ENUM          | Estado: SEALED, OPEN_COMPLETE, OPEN_INCOMPLETE, USED  |
| condition_notes    | TEXT          | Notas libres sobre el estado (daños en caja, etc.)    |
| purchase_price     | DECIMAL(10,2) | Precio al que se compró                               |
| purchase_date      | DATE          | Fecha de adquisición                                  |
| purchase_source    | VARCHAR(255)  | Dónde se compró (tienda, particular, feria...)        |
| storage_location   | VARCHAR(100)  | Ubicación física (ej: "Estantería A3, caja 2")        |
| quantity           | INTEGER       | Unidades (normalmente 1 para coleccionismo)           |
| images             | JSONB         | Array de URLs a las fotos del producto                |
| notes              | TEXT          | Notas adicionales libres                              |
| is_listed          | BOOLEAN       | Si está publicado para la venta                       |
| created_at         | TIMESTAMP     | Fecha de creación del registro                        |
| updated_at         | TIMESTAMP     | Fecha de última modificación                          |

**Tabla `market_prices`** — Histórico de precios de mercado.

| Campo          | Tipo          | Descripción                                      |
|----------------|---------------|--------------------------------------------------|
| id             | UUID          | Identificador único                              |
| product_id     | UUID (FK)     | Referencia al producto                           |
| source         | VARCHAR(50)   | Fuente del dato (bricklink, brickeconomy, ebay)  |
| price_new      | DECIMAL(10,2) | Precio medio si es nuevo/sellado                 |
| price_used     | DECIMAL(10,2) | Precio medio si es usado                         |
| min_price      | DECIMAL(10,2) | Precio mínimo encontrado                         |
| max_price      | DECIMAL(10,2) | Precio máximo encontrado                         |
| currency       | VARCHAR(3)    | Moneda (EUR, USD)                                |
| fetched_at     | TIMESTAMP     | Momento en que se capturó el dato                |

**Tabla `price_alerts`** — Alertas configurables por producto.

| Campo            | Tipo          | Descripción                                    |
|------------------|---------------|------------------------------------------------|
| id               | UUID          | Identificador único                            |
| product_id       | UUID (FK)     | Producto al que aplica la alerta               |
| alert_type       | ENUM          | PRICE_ABOVE, PRICE_BELOW, PRICE_CHANGE_PCT    |
| threshold_value  | DECIMAL(10,2) | Valor umbral que dispara la alerta             |
| is_active        | BOOLEAN       | Si la alerta está activa                       |
| last_triggered   | TIMESTAMP     | Última vez que se activó                       |

#### Pasos de implementación

1. **Instalar PostgreSQL** en el servidor o usar un servicio gestionado (ver sección 9).
2. **Crear el proyecto Python:**
   ```bash
   mkdir lego-business-api
   cd lego-business-api
   python -m venv venv
   source venv/bin/activate
   pip install fastapi uvicorn sqlalchemy alembic psycopg2-binary pydantic
   ```
3. **Definir los modelos SQLAlchemy** que corresponden a las tablas descritas arriba.
4. **Configurar Alembic** para migraciones:
   ```bash
   alembic init alembic
   # Editar alembic.ini con la URL de conexión a PostgreSQL
   alembic revision --autogenerate -m "initial schema"
   alembic upgrade head
   ```
5. **Crear los endpoints de la API (FastAPI):**
   - `POST /products` — Añadir un producto al inventario.
   - `GET /products` — Listar productos con filtros (tema, categoría, estado, rango de precios).
   - `GET /products/{id}` — Detalle de un producto con sus precios de mercado.
   - `PUT /products/{id}` — Editar un producto.
   - `DELETE /products/{id}` — Eliminar (soft delete, nunca se borra realmente, solo se marca como eliminado).
   - `POST /products/bulk-import` — Importar muchos productos desde un archivo CSV o Excel (imprescindible para cargar el inventario inicial).

6. **Implementar la importación masiva (bulk import).** El fundador probablemente tiene su inventario en una hoja de cálculo. El sistema debe aceptar un archivo CSV/Excel, validar los datos y cargarlos en la base de datos. Esto es crítico para el arranque, ya que introducir cientos de artículos uno a uno es inviable.

### 3.2. Sistema de captura de precios de mercado

#### Tecnologías

- **BeautifulSoup4 + httpx** para scraping de páginas web.
- **Celery + Redis** para ejecutar tareas programadas en segundo plano.
- **APScheduler** como alternativa ligera a Celery si el volumen es bajo al principio.

#### Fuentes de datos de precios

Las fuentes principales, ordenadas por relevancia para el mercado LEGO:

1. **BrickLink** — El marketplace de referencia mundial. Contiene precios de venta actuales y un historial de transacciones completadas (Price Guide). Es la fuente más fiable.
2. **BrickEconomy** — Agregador que muestra tendencias de revalorización, precios medios y gráficos históricos. Muy útil para análisis de tendencias.
3. **eBay (ventas completadas)** — Refleja precios reales de transacción. Útil como segunda fuente de verificación, especialmente para sets raros.

#### Cómo funciona el scraper

El scraper es un proceso automático que se ejecuta periódicamente (por ejemplo, una vez al día por la noche) y hace lo siguiente:

1. Recorre todos los productos del inventario que no tienen precio actualizado en las últimas 24 horas.
2. Para cada producto, consulta las fuentes de datos usando el número de set como clave de búsqueda.
3. Extrae los precios (nuevo, usado, mínimo, máximo) y los guarda en la tabla `market_prices`.
4. Si algún precio cumple una condición de alerta configurada, genera una notificación.

#### Pasos de implementación

1. **Instalar Redis** (se usará como broker de tareas y como caché):
   ```bash
   # En Ubuntu/Debian
   sudo apt install redis-server
   ```
2. **Crear el módulo de scraping** con una clase por cada fuente de datos:
   ```
   scrapers/
   ├── base_scraper.py       # Clase base con lógica común
   ├── bricklink_scraper.py  # Scraper específico de BrickLink
   ├── brickeconomy_scraper.py
   └── ebay_scraper.py
   ```
3. **Implementar rate limiting** (limitación de velocidad de peticiones) para no sobrecargar las fuentes y evitar bloqueos. Recomendación: máximo 1 petición cada 2-3 segundos por fuente.
4. **Programar la ejecución periódica** con Celery Beat o APScheduler:
   ```python
   # Ejemplo con APScheduler
   scheduler.add_job(
       update_all_prices,
       trigger='cron',
       hour=3,        # Ejecutar a las 3:00 AM
       minute=0
   )
   ```
5. **Implementar caché con Redis** para que las consultas al panel no dependan de scraping en tiempo real. Cuando el panel pide el precio de un producto, lee de la tabla `market_prices` (datos ya capturados), no hace scraping en ese momento.

#### Nota legal importante

El scraping debe hacerse de forma responsable y respetuosa. Se deben revisar los términos de servicio de cada plataforma. BrickLink, por ejemplo, tiene una API oficial (aunque limitada) que es preferible al scraping directo. Si alguna fuente ofrece API oficial, siempre se debe usar en lugar de scraping.

### 3.3. Panel de gestión interno (frontend V1)

#### Tecnologías

- **Next.js 14+** (framework React con renderizado del lado del servidor).
- **Tailwind CSS** para estilos rápidos y consistentes.
- **Tanstack Table** para tablas interactivas con filtros, ordenación y paginación.
- **Recharts** para gráficos de precios.

#### Pantallas del panel

**Dashboard principal:**
- Resumen del inventario: número total de artículos, valor total de compra, valor total estimado de mercado, beneficio potencial.
- Alertas activas (productos que han alcanzado un precio objetivo).
- Los 10 productos con mayor margen potencial.
- Los 10 productos que más se han revalorizado en el último mes.

**Listado de inventario:**
- Tabla con todos los productos, filtrable por categoría, tema, estado, rango de precio.
- Columnas: foto miniatura, nombre, número de set, precio de compra, precio de mercado actual, margen (%), estado, ubicación.
- Búsqueda por texto libre (nombre o número de set).
- Exportación a CSV/Excel.

**Ficha de producto:**
- Toda la información del producto.
- Gráfico de evolución del precio de mercado a lo largo del tiempo.
- Comparación entre precio de compra y precio actual.
- Botón para marcar como "en venta" o "vendido".

**Formulario de alta/edición:**
- Formulario para añadir o editar un producto.
- Autocompletado del nombre y tema al introducir el número de set (consultando los datos de BrickLink/Rebrickable).
- Subida de múltiples fotos.

#### Pasos de implementación

1. **Crear el proyecto Next.js:**
   ```bash
   npx create-next-app@latest lego-admin-panel --typescript --tailwind
   ```
2. **Configurar la conexión con la API** usando un cliente HTTP (axios o fetch nativo).
3. **Construir las pantallas en este orden:** Dashboard → Listado → Ficha → Formulario. Cada una es una página dentro del proyecto Next.js.
4. **Implementar autenticación básica** (usuario y contraseña) para proteger el panel. En esta versión, un solo usuario (el fundador) es suficiente. Se puede usar NextAuth.js para esto.

---

## 4. Versión 2 — Tienda web propia conectada al stock

> **Objetivo:** Vender directamente a clientes desde una web propia, con el stock siempre sincronizado.  
> **Tiempo estimado:** 3-5 semanas adicionales.  
> **Resultado:** Una tienda online pública donde los clientes pueden ver productos y comprar.

### 4.1. Decisión: ¿tienda a medida o plataforma existente?

Existen dos caminos. Se recomienda empezar por la **Opción A** y migrar a la **Opción B** cuando el volumen lo justifique:

**Opción A — WooCommerce / Shopify (recomendada para empezar):**
- Se monta en días, no en semanas.
- Incluye pasarela de pago, gestión de pedidos, plantillas de diseño.
- Se conecta al sistema de inventario mediante la API (sincronización automática de stock).
- Coste: Shopify desde ~30 €/mes; WooCommerce es gratuito pero necesita hosting (~10-20 €/mes).

**Opción B — Tienda a medida con Next.js (para escalar):**
- Control total del diseño y la experiencia de usuario.
- Integración nativa con la API central (mismo stack tecnológico).
- Requiere más tiempo de desarrollo inicial.
- Requiere integrar la pasarela de pago manualmente (Stripe).

### 4.2. Implementación con Opción A (WooCommerce + sincronización)

#### Pasos

1. **Instalar WordPress + WooCommerce** en un hosting o usar Shopify.
2. **Crear un plugin/conector de sincronización** que haga lo siguiente:
   - Cada vez que se marca un producto como "en venta" en el panel de gestión, se crea automáticamente el producto en WooCommerce (con nombre, descripción, fotos, precio).
   - Cada vez que se vende un producto en WooCommerce, se notifica a la API central para actualizar el stock.
   - Si se modifica el precio o la información en el panel, se actualiza en WooCommerce.
3. **Configurar webhooks de WooCommerce** para que cada evento de venta dispare una llamada a la API central.

### 4.3. Implementación con Opción B (tienda a medida)

#### Tecnologías adicionales

- **Stripe** como pasarela de pago (comisión: ~1.5% + 0.25 € por transacción en Europa).
- **Next.js** (el mismo framework del panel, pero con páginas públicas).
- **Cloudinary o S3** para almacenar y servir las imágenes de productos de forma optimizada.

#### Estructura de la tienda

```
tienda-web/
├── app/
│   ├── page.tsx               # Página de inicio (destacados, novedades)
│   ├── catalogo/
│   │   └── page.tsx           # Catálogo con filtros
│   ├── producto/
│   │   └── [id]/page.tsx      # Ficha de producto pública
│   ├── carrito/
│   │   └── page.tsx           # Carrito de compra
│   ├── checkout/
│   │   └── page.tsx           # Proceso de pago (Stripe)
│   └── cuenta/
│       └── page.tsx           # Área del cliente (pedidos, perfil)
```

#### Nuevos endpoints de la API central

- `GET /shop/products` — Productos publicados para la venta (solo los marcados como `is_listed = true`).
- `GET /shop/products/{id}` — Detalle público de un producto.
- `POST /orders` — Crear un pedido.
- `POST /orders/{id}/payment` — Procesar el pago con Stripe.
- `GET /orders/{id}/status` — Consultar el estado de un pedido.

#### Pasos de implementación

1. **Crear la cuenta de Stripe** y obtener las claves de API (modo test primero).
2. **Implementar los endpoints de la tienda** en la API central.
3. **Construir las páginas públicas** de la tienda (catálogo, ficha de producto, carrito, checkout).
4. **Integrar Stripe Checkout** para el proceso de pago. Stripe se encarga de la seguridad de las tarjetas (PCI compliance), por lo que no se almacenan datos de pago en la base de datos propia.
5. **Implementar un flujo de pedido completo:**
   - Cliente añade productos al carrito.
   - Cliente procede al checkout, introduce datos de envío.
   - Se crea una sesión de pago en Stripe.
   - Al completar el pago, Stripe envía un webhook a la API confirmando la transacción.
   - La API actualiza el estado del pedido y marca el producto como vendido en el inventario.
6. **Configurar el envío de emails transaccionales** (confirmación de pedido, envío) usando un servicio como Resend o SendGrid (ambos tienen plan gratuito para bajo volumen).

---

## 5. Versión 3 — Venta multicanal sincronizada

> **Objetivo:** Vender simultáneamente en BrickLink, eBay, Wallapop y la web propia sin riesgo de overselling (vender lo mismo dos veces).  
> **Tiempo estimado:** 4-6 semanas adicionales.  
> **Resultado:** Stock unificado que se sincroniza automáticamente con todas las plataformas.

### 5.1. Principio fundamental: fuente única de verdad

La base de datos PostgreSQL es siempre la referencia. Cuando un producto se vende en cualquier canal, la secuencia es:

1. Se detecta la venta (via webhook, polling o notificación).
2. Se actualiza el inventario central (marcar como vendido, reducir cantidad).
3. Se retira el producto del resto de canales automáticamente.

### 5.2. Integración por canal

**BrickLink:**
- Dispone de API oficial (BrickLink API v2) que permite listar productos, actualizar precios y gestionar pedidos.
- Se necesita una cuenta de tienda en BrickLink y obtener tokens de API.
- El conector debe: publicar/despublicar artículos, sincronizar precios, recibir notificaciones de venta.

**eBay:**
- API oficial robusta (eBay Browse API, Inventory API, Fulfillment API).
- Permite listar productos, gestionar stock y recibir notificaciones de venta.
- Requiere registro como desarrollador en eBay Developer Program.

**Wallapop:**
- No dispone de API pública oficial.
- Opciones: gestión manual asistida (el sistema genera la información lista para copiar-pegar) o explorar automatización mediante herramientas no oficiales (con precaución).

**Otras plataformas (Vinted, Todocoleccion, etc.):**
- Evaluar caso por caso según disponibilidad de API.
- Para plataformas sin API, el sistema puede generar "fichas de publicación" con toda la información formateada para copiar manualmente.

### 5.3. Arquitectura del módulo multicanal

```
┌─────────────────────┐
│   INVENTARIO CENTRAL│
│    (PostgreSQL)      │
└─────────┬───────────┘
          │
┌─────────▼───────────┐
│  CHANNEL MANAGER     │
│  (Servicio Python)   │
└──┬─────┬─────┬──────┘
   │     │     │
   ▼     ▼     ▼
BrickLink eBay  Tienda
Connector Conn. Web Conn.
```

#### Nuevas tablas en la base de datos

**Tabla `channel_listings`** — Registro de en qué canales está publicado cada producto.

| Campo              | Tipo          | Descripción                                    |
|--------------------|---------------|------------------------------------------------|
| id                 | UUID          | Identificador único                            |
| product_id         | UUID (FK)     | Producto del inventario                        |
| channel            | ENUM          | BRICKLINK, EBAY, WEB, WALLAPOP                |
| external_id        | VARCHAR(255)  | ID del producto en la plataforma externa       |
| listing_url        | TEXT          | URL de la publicación                          |
| listed_price       | DECIMAL(10,2) | Precio al que está publicado en ese canal      |
| status             | ENUM          | ACTIVE, SOLD, PAUSED, REMOVED                 |
| listed_at          | TIMESTAMP     | Fecha de publicación                           |
| last_synced_at     | TIMESTAMP     | Última sincronización con la plataforma        |

**Tabla `sales`** — Registro de todas las ventas.

| Campo              | Tipo          | Descripción                                    |
|--------------------|---------------|------------------------------------------------|
| id                 | UUID          | Identificador único                            |
| product_id         | UUID (FK)     | Producto vendido                               |
| channel            | ENUM          | Canal donde se vendió                          |
| sale_price         | DECIMAL(10,2) | Precio de venta real                           |
| platform_fees      | DECIMAL(10,2) | Comisiones de la plataforma                    |
| shipping_cost      | DECIMAL(10,2) | Coste de envío                                 |
| net_profit         | DECIMAL(10,2) | Beneficio neto (venta - compra - comisiones - envío) |
| buyer_info         | JSONB         | Información del comprador                      |
| sold_at            | TIMESTAMP     | Fecha y hora de la venta                       |

### 5.4. Pasos de implementación

1. **Registrarse como desarrollador** en BrickLink y eBay para obtener acceso a sus APIs.
2. **Crear un conector por cada canal** siguiendo un patrón común (interfaz/clase base):
   ```python
   class ChannelConnector:
       def list_product(self, product) -> str:       # Devuelve external_id
       def update_price(self, external_id, price) -> bool:
       def remove_listing(self, external_id) -> bool:
       def check_sales(self) -> list[Sale]:
       def sync_status(self, external_id) -> str:
   ```
3. **Implementar el Channel Manager** como servicio que coordina todos los conectores.
4. **Configurar polling periódico** (consulta cada 5-15 minutos) para detectar ventas en plataformas que no soporten webhooks.
5. **Implementar la lógica de despublicación automática:** cuando se detecta una venta en un canal, el Channel Manager llama a `remove_listing` en todos los demás canales.
6. **Añadir al panel de gestión** una vista de "Publicaciones" donde se vea en qué canales está cada producto, con opciones de publicar/despublicar desde un solo lugar.

---

## 6. Versión 4 — Analítica, dashboard y decisiones de negocio

> **Objetivo:** Transformar datos en decisiones inteligentes de compra, venta y retención.  
> **Tiempo estimado:** 3-4 semanas adicionales.  
> **Resultado:** Dashboard avanzado con métricas de negocio y herramientas de análisis.

### 6.1. Métricas clave (KPIs)

El dashboard debe mostrar como mínimo:

**Métricas financieras:**
- Beneficio bruto total y por período (mes, trimestre, año).
- Margen medio por venta.
- ROI (Return on Investment) por categoría y por tema.
- Valor total del inventario (a precio de mercado).
- Capital invertido vs. valor de mercado (para ver la revalorización global).

**Métricas operativas:**
- Velocidad de rotación: días medios desde que se publica un producto hasta que se vende.
- Tasa de conversión por canal: qué porcentaje de lo publicado se vende en cada plataforma.
- Productos estancados: artículos publicados hace más de X días sin vender.

**Métricas de mercado:**
- Tendencias de revalorización por tema (¿Star Wars sube más que Technic?).
- Sets con mayor revalorización en los últimos 30/90/365 días.
- Alertas de oportunidad: sets que están bajando de precio en el mercado (oportunidad de compra).

### 6.2. Tecnologías adicionales

- **Recharts o Chart.js** para gráficos interactivos en el frontend.
- **Pandas** en el backend para cálculos analíticos complejos.
- **Exportación a PDF** de informes periódicos (usando WeasyPrint o similar).

### 6.3. Funcionalidades de análisis

**Calculadora de rentabilidad por producto:**
Antes de comprar un set, el fundador introduce el precio de compra y el sistema calcula automáticamente el margen potencial basándose en el precio de mercado actual, restando las comisiones estimadas de cada canal y los costes de envío medios.

**Simulador de precios:**
Permite simular "¿qué pasa si vendo este set a X euros?" mostrando el beneficio neto después de comisiones en cada canal, ayudando a decidir dónde publicarlo.

**Informe de revalorización del inventario:**
Informe mensual automático que muestra cuánto ha cambiado el valor total del inventario respecto al mes anterior, desglosado por categoría y tema.

### 6.4. Pasos de implementación

1. **Crear endpoints analíticos** en la API:
   - `GET /analytics/summary` — Resumen general del negocio.
   - `GET /analytics/profitability?groupBy=theme` — Rentabilidad agrupada.
   - `GET /analytics/trends?period=90d` — Tendencias de precios.
   - `GET /analytics/slow-movers?days=60` — Productos estancados.
2. **Construir el dashboard** como nueva sección del panel de gestión.
3. **Implementar la generación de informes PDF** programada (mensual) y bajo demanda.
4. **Crear el simulador de precios** como herramienta interactiva en la ficha de cada producto.

---

## 7. Versión 5 — Facturación, logística y CRM

> **Objetivo:** Profesionalizar completamente la operativa del negocio.  
> **Tiempo estimado:** 5-7 semanas adicionales.  
> **Resultado:** Facturación legal automatizada, gestión de envíos integrada y relación con clientes.

### 7.1. Facturación

#### Contexto legal España

A partir de la Ley Antifraude (Ley 11/2021) y el futuro Reglamento Verifactu, los sistemas de facturación deben cumplir requisitos específicos: las facturas no pueden ser alteradas después de emitidas, deben tener numeración secuencial, y el software debe estar homologado. Esto es crítico y hay que tenerlo en cuenta desde el diseño.

#### Opciones de implementación

**Opción recomendada: integración con software de facturación existente.**
En lugar de construir un sistema de facturación desde cero (complejo legalmente), se recomienda integrarse con un software ya homologado. Opciones:

- **Holded** — Software español de facturación con API REST completa. Plan desde ~10 €/mes.
- **Facturas en Nube / Billin** — Alternativas españolas con API.
- **Stripe Invoicing** — Si ya se usa Stripe para pagos, puede generar facturas automáticas.

**Flujo de integración:**
1. Se vende un producto (en cualquier canal).
2. La API central envía los datos de la venta al software de facturación vía API.
3. El software genera la factura legal (con NIF, numeración, etc.).
4. Se envía la factura al cliente por email automáticamente.
5. Se guarda la referencia de la factura en la base de datos.

**Tabla `invoices`:**

| Campo               | Tipo          | Descripción                                    |
|---------------------|---------------|------------------------------------------------|
| id                  | UUID          | Identificador único                            |
| sale_id             | UUID (FK)     | Referencia a la venta                          |
| external_invoice_id | VARCHAR(100)  | ID de la factura en el software externo        |
| invoice_number      | VARCHAR(50)   | Número de factura                              |
| invoice_url         | TEXT          | URL para descargar la factura                  |
| total_amount        | DECIMAL(10,2) | Importe total con IVA                          |
| tax_amount          | DECIMAL(10,2) | Importe del IVA                                |
| issued_at           | TIMESTAMP     | Fecha de emisión                               |

### 7.2. Gestión de envíos

#### Tecnologías

- **Integración con APIs de agencias de transporte:** Correos Express, SEUR, MRW, GLS tienen APIs que permiten generar etiquetas, solicitar recogidas y hacer seguimiento.
- **Plataformas intermediarias:** Servicios como Packlink, Sendcloud o Shippo agregan múltiples transportistas en una sola API y negocian tarifas. Son muy recomendables para empezar.

#### Flujo de envío

1. Se confirma el pago de un pedido.
2. El sistema calcula automáticamente el peso y dimensiones del paquete (basándose en datos del producto).
3. Se consultan tarifas de envío a las agencias disponibles.
4. Se genera la etiqueta de envío y se solicita la recogida (o se indica la oficina de envío más cercana).
5. Se envía al cliente el número de seguimiento por email.
6. El estado del envío se actualiza automáticamente consultando la API del transportista.

#### Pasos de implementación

1. **Registrarse en una plataforma intermediaria** (Sendcloud es popular en España y tiene buenas tarifas).
2. **Integrar la API de la plataforma** con la API central.
3. **Añadir al panel de gestión** una sección de "Envíos pendientes" y "En tránsito".
4. **Configurar el envío automático de emails** con número de seguimiento.

### 7.3. CRM (Gestión de relaciones con clientes)

En el mundo del coleccionismo, los clientes recurrentes son la base del negocio. Un comprador satisfecho volverá si encuentra sets que le interesan.

#### Funcionalidades del CRM

**Perfiles de cliente:**
- Historial de compras completo.
- Temas y categorías que le interesan.
- Notas del fundador sobre el cliente.
- Valoración como comprador (pagos rápidos, etc.).

**Comunicación proactiva:**
- Cuando llega al inventario un set del tema favorito de un cliente, enviarle una notificación por email.
- Newsletter periódica con novedades del inventario.
- Descuentos personalizados para clientes recurrentes.

**Tabla `customers`:**

| Campo            | Tipo          | Descripción                                    |
|------------------|---------------|------------------------------------------------|
| id               | UUID          | Identificador único                            |
| name             | VARCHAR(255)  | Nombre del cliente                             |
| email            | VARCHAR(255)  | Email                                          |
| phone            | VARCHAR(50)   | Teléfono (opcional)                            |
| preferred_themes | JSONB         | Temas que le interesan                         |
| total_purchases  | INTEGER       | Número total de compras                        |
| total_spent      | DECIMAL(10,2) | Gasto total acumulado                          |
| notes            | TEXT          | Notas libres                                   |
| created_at       | TIMESTAMP     | Fecha de registro                              |

#### Tecnologías para email marketing

- **Resend** o **Brevo (Sendinblue)** — Servicios de email con API, planes gratuitos para bajo volumen (hasta 300 emails/día en Brevo). Permiten enviar emails transaccionales (confirmaciones) y campañas de marketing (newsletters).

---

## 8. Versión 6 — Automatización avanzada e inteligencia

> **Objetivo:** Llevar el negocio al siguiente nivel con automatización y análisis predictivo.  
> **Tiempo estimado:** Variable, mejora continua.  
> **Resultado:** Sistema que sugiere cuándo comprar, cuándo vender y a qué precio.

### 8.1. Alertas inteligentes de oportunidad

El sistema monitoriza no solo los precios de los sets que están en el inventario, sino también sets potencialmente interesantes que no se poseen. Si detecta que un set cotizado está a un precio inusualmente bajo (por ejemplo, en BrickLink o eBay), lanza una alerta de oportunidad de compra.

**Implementación:**
- Mantener una lista de "sets de interés" (wishlist de inversión).
- El scraper de precios también consulta estos sets.
- Si el precio actual cae por debajo del precio medio histórico menos un porcentaje (configurable), se genera una alerta.

### 8.2. Predicción de precios (machine learning)

Con suficiente histórico de datos (mínimo 6-12 meses de captura de precios), se pueden construir modelos predictivos que estimen la evolución futura de precios.

#### Tecnologías

- **scikit-learn** para modelos básicos (regresión lineal, random forest).
- **Prophet (de Meta/Facebook)** para series temporales, especialmente bueno para detectar estacionalidades (los precios LEGO suben en Navidad).
- **Jupyter Notebooks** para exploración y desarrollo de modelos.

#### Factores que influyen en el precio

El modelo debería considerar:
- Año de lanzamiento y de descatalogación del set.
- Tema (algunos temas se revalorizan más).
- Número de piezas y presencia de minifiguras exclusivas.
- Época del año (estacionalidad: Navidad, Black Friday).
- Tiempo desde descatalogación.
- Tendencias de búsqueda (se puede integrar Google Trends API).

### 8.3. Reconocimiento de imágenes para inventario

Si se tiene un gran volumen de minifiguras o piezas sueltas, catalogarlas manualmente es lento. Se puede entrenar o usar un modelo de reconocimiento de imágenes para identificar minifiguras a partir de una foto.

#### Tecnologías

- **API de Rebrickable** para datos de referencia de piezas y minifiguras.
- **TensorFlow/PyTorch** si se quiere un modelo propio.
- **OpenAI Vision API o similares** como alternativa más rápida sin necesidad de entrenar modelo propio.

**Flujo:** Se hace una foto a una minifigura → el sistema la identifica → sugiere la referencia correcta → se añade al inventario con un solo clic.

### 8.4. Automatización de publicaciones

El sistema puede generar automáticamente las descripciones de los productos para cada canal, adaptando el formato y el tono:
- BrickLink: técnico, con referencia de set y condición precisa.
- eBay: más comercial, con palabras clave para SEO.
- Web propia: mixto, con fotos grandes y descripción atractiva.

Se puede usar una API de LLM (como la de Claude) para generar descripciones optimizadas automáticamente a partir de los datos estructurados del inventario.

---

## 9. Infraestructura, hosting y DevOps

### 9.1. Entorno de desarrollo

- **Git + GitHub/GitLab** para control de versiones. Imprescindible desde el día uno.
- **Docker + Docker Compose** para levantar todo el entorno localmente con un solo comando:
  ```yaml
  # docker-compose.yml (simplificado)
  services:
    api:
      build: ./api
      ports: ["8000:8000"]
      depends_on: [db, redis]
    db:
      image: postgres:16
      volumes: ["pgdata:/var/lib/postgresql/data"]
    redis:
      image: redis:7
    admin-panel:
      build: ./admin-panel
      ports: ["3000:3000"]
  ```

### 9.2. Hosting para producción

#### Opción económica (para empezar, ~20-40 €/mes)

- **VPS (Virtual Private Server):** Un servidor virtual en Hetzner, DigitalOcean o Contabo. Hetzner tiene excelente relación calidad/precio en Europa (servidores en Alemania/Finlandia, baja latencia a España).
- Todo corre en un solo servidor con Docker Compose.
- Se añade un proxy inverso con **Nginx** o **Caddy** para gestionar los dominios y certificados HTTPS.

**Especificaciones mínimas recomendadas:**
- 4 GB RAM, 2 vCPUs, 80 GB SSD.
- Coste aproximado: 10-20 €/mes en Hetzner.

#### Opción escalable (cuando crezca el negocio)

- **Railway, Render o Fly.io** — Plataformas PaaS (Platform as a Service) que simplifican el despliegue. Se sube el código y ellos gestionan la infraestructura.
- **Supabase** como alternativa gestionada para PostgreSQL (tiene plan gratuito generoso).
- **Vercel** para el frontend Next.js (plan gratuito para proyectos pequeños, integración nativa con Next.js).

### 9.3. Backups y seguridad

- **Backups diarios automáticos** de la base de datos PostgreSQL. Almacenar en un servicio de almacenamiento como Backblaze B2 o S3 (muy económico).
- **HTTPS obligatorio** en todos los servicios web (Let's Encrypt proporciona certificados gratuitos, Caddy los gestiona automáticamente).
- **Variables de entorno** para todas las credenciales (nunca hardcodear contraseñas en el código).
- **Actualizaciones de seguridad** del servidor operativo periódicas.

### 9.4. Monitorización

- **Uptime Kuma** (gratuito, self-hosted) para monitorizar que los servicios estén funcionando.
- **Sentry** (plan gratuito) para capturar errores de la aplicación automáticamente.
- **Logs centralizados** con la utilidad de Docker (o Loki/Grafana si se quiere más sofisticación).

---

## 10. Resumen de stack tecnológico por versión

| Componente             | Tecnología                    | Versión de introducción |
|------------------------|-------------------------------|------------------------|
| Lenguaje backend       | Python 3.11+                  | V1                     |
| Framework API          | FastAPI                       | V1                     |
| Base de datos          | PostgreSQL 16                 | V1                     |
| ORM                    | SQLAlchemy + Alembic          | V1                     |
| Caché / broker tareas  | Redis                         | V1                     |
| Tareas programadas     | APScheduler → Celery          | V1                     |
| Scraping               | httpx + BeautifulSoup4        | V1                     |
| Frontend framework     | Next.js + React               | V1                     |
| CSS                    | Tailwind CSS                  | V1                     |
| Gráficos               | Recharts                      | V1                     |
| Pasarela de pago       | Stripe                        | V2                     |
| Almacenamiento imágenes| Cloudinary o S3               | V2                     |
| Email transaccional    | Resend o Brevo                | V2                     |
| APIs de marketplaces   | BrickLink API, eBay API       | V3                     |
| Analítica              | Pandas                        | V4                     |
| Informes PDF           | WeasyPrint                    | V4                     |
| Facturación            | Holded API (o similar)        | V5                     |
| Envíos                 | Sendcloud API                 | V5                     |
| ML / predicción        | scikit-learn, Prophet         | V6                     |
| Visión artificial      | TensorFlow / APIs externas    | V6                     |
| Contenedores           | Docker + Docker Compose       | Todas                  |
| Control de versiones   | Git + GitHub                  | Todas                  |
| Hosting                | VPS Hetzner → PaaS            | Todas                  |
| Proxy / HTTPS          | Caddy o Nginx                 | Todas                  |

---

## 11. Cronograma orientativo

Este cronograma asume un ingeniero dedicado a tiempo parcial (20-25h/semana):

| Fase     | Duración estimada | Hito al completar                              |
|----------|-------------------|-------------------------------------------------|
| V1 MVP   | 4-6 semanas       | Inventario digital + precios de mercado         |
| V2 Tienda| 3-5 semanas       | Tienda web operativa, primeras ventas online    |
| V3 Multi | 4-6 semanas       | Venta en BrickLink + eBay sincronizada          |
| V4 Datos | 3-4 semanas       | Dashboard analítico con métricas de negocio     |
| V5 Pro   | 5-7 semanas       | Facturación legal + envíos automatizados + CRM  |
| V6 IA    | Continuo          | Predicción de precios, alertas inteligentes     |

**Total hasta tener un sistema profesional completo (V1-V5): ~5-7 meses.**

La V6 es un proceso continuo de mejora que nunca termina realmente: siempre se pueden refinar los modelos y añadir automatizaciones.

---

## 12. Glosario técnico

- **API (Application Programming Interface):** Interfaz que permite a diferentes programas comunicarse entre sí. En este proyecto, la API central es el "cerebro" al que todos los demás sistemas se conectan.
- **Backend:** La parte del sistema que funciona en el servidor: lógica de negocio, base de datos, procesamiento.
- **Frontend:** La parte visible del sistema: las pantallas, botones y formularios con los que interactúa el usuario.
- **Endpoint:** Una dirección específica de la API que realiza una función concreta (por ejemplo, `/products` para obtener la lista de productos).
- **ORM (Object-Relational Mapper):** Herramienta que permite trabajar con la base de datos usando objetos de Python en lugar de escribir consultas SQL directamente.
- **Webhook:** Mecanismo por el cual una plataforma externa (como Stripe o eBay) envía automáticamente una notificación a nuestra API cuando ocurre un evento (por ejemplo, un pago completado).
- **Scraping:** Técnica de extracción automática de datos de páginas web.
- **Polling:** Consultar periódicamente un servicio externo para comprobar si hay novedades.
- **Soft delete:** En lugar de borrar un registro de la base de datos, marcarlo como eliminado. Permite recuperar datos y mantener histórico.
- **PaaS (Platform as a Service):** Servicio de hosting donde subes tu código y la plataforma se encarga del servidor, actualizaciones, escalado, etc.
- **VPS (Virtual Private Server):** Servidor virtual que tú gestionas completamente (instalas sistema operativo, configuras todo).
- **HTTPS:** Protocolo de comunicación seguro (cifrado) entre el navegador y el servidor.
- **Rate limiting:** Limitar el número de peticiones que se hacen a un servicio en un período de tiempo, para no sobrecargarlo.
- **UUID:** Identificador único universal, una cadena de caracteres que identifica cada registro de forma inequívoca.
- **JSONB:** Tipo de dato de PostgreSQL que almacena datos en formato JSON de forma eficiente y permite hacer consultas sobre ellos.
- **Docker:** Herramienta que empaqueta una aplicación con todas sus dependencias en un "contenedor" que funciona igual en cualquier máquina.
- **CI/CD:** Integración y despliegue continuos. Automatización del proceso de probar y publicar nuevas versiones del código.
- **ENUM:** Tipo de dato que solo permite un conjunto fijo de valores (por ejemplo, el estado de un producto solo puede ser SEALED, OPEN_COMPLETE, etc.).
- **FK (Foreign Key):** Clave foránea, un campo en una tabla que referencia el identificador de otra tabla, creando una relación entre ambas.
- **Migración:** Cambio controlado y versionado en la estructura de la base de datos (añadir tablas, columnas, etc.).
- **Proxy inverso:** Servidor intermedio que recibe las peticiones de internet y las redirige al servicio interno adecuado. También gestiona HTTPS.
- **Redis:** Base de datos en memoria, muy rápida, usada como caché y como sistema de colas de tareas.

---

*Este documento es una guía viva. Debe actualizarse conforme se tomen decisiones de implementación y el negocio evolucione.*
