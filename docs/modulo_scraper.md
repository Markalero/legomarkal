# Informe Técnico: Módulo de Scraping y Actualización de Precios

## 1. Visión General y Arquitectura "Zero-Cost"
El módulo de scraping de **LEGO Stock Manager PRO** es el encargado de mantener actualizado en tiempo real el valor de mercado del inventario. 

Para evitar sobrecargar el servidor web principal con tareas intensivas de memoria (típicas del uso de navegadores *headless*), el sistema utiliza una arquitectura **desacoplada**.
- **Backend (FastAPI):** Expone la información necesaria y recibe los datos actualizados a través de un webhook seguro.
- **Worker Independiente (GitHub Actions):** Se levanta bajo demanda, ejecuta el script de scraping en una máquina virtual externa y se destruye al finalizar, garantizando un consumo de recursos mínimo en producción ("Zero-Cost").

---

## 2. El Worker del Scraper (`scraper/main.py`)

El script principal está escrito en Python asíncrono (`asyncio`) para manejar de forma eficiente las operaciones de entrada/salida (I/O) sin bloquear el hilo de ejecución.

### Flujo de Ejecución Interno:

1. **Recolección del Objetivo (`get_sets_to_scrape`)**
   - El script inicia haciendo una petición HTTP `GET` al endpoint `/api/sets/` del backend.
   - Extrae el catálogo completo y filtra localmente aquellos sets cuyo estado sea `IN_STOCK`. Los productos ya vendidos (`SOLD`) son ignorados para no gastar ciclos de procesamiento innecesarios.

2. **Navegación y Extracción (`scrape_lego_price`)**
   - Por cada producto en stock, el script instancia un navegador Chromium invisible usando **Playwright** (`async_playwright`).
   - Se navega a la URL oficial del producto en BrickEconomy (ej: `https://www.brickeconomy.com/set/{id}-1/`).
   - **Evasión de Antibots:** Se aplica una pausa asíncrona aleatoria (`asyncio.sleep` de 2 a 4 segundos) que simula el comportamiento de lectura humano, evitando bloqueos por *Rate Limiting* o servicios como Cloudflare.
   - **Análisis del DOM:** Una vez cargada la página, se extrae el código HTML crudo y se parsea utilizando **BeautifulSoup**.
   - **Limpieza de Datos:** El algoritmo busca iterativamente en los bloques los campos correspondientes a "Value" (valor actual de mercado) y, si no lo encuentra, retrocede al "Retail price". Se aplican Expresiones Regulares para limpiar divisas y quedarse con el valor numérico puro.

3. **Orquestación y Envío (`main`)**
   - El procesamiento de todos los sets se realiza de forma **secuencial** dentro del mismo contexto de navegador para mantener estable el uso de RAM.
   - Una vez concluido el bucle de extracción, los precios obtenidos se empaquetan en un array JSON.
   - Se realiza una petición `POST` final enviando todos los datos al webhook del backend.

---

## 3. Recepción en el Backend (`backend/routers/scraper.py`)

El servidor central recibe el payload masivo a través de la ruta `/api/scraper/webhook`.

### Características y Seguridades Implementadas:

- **Autenticación (Custom Header):** 
  El endpoint está protegido mediante una dependencia de inyección en FastAPI (`get_api_key`). El worker debe enviar el header `X-Scraper-Api-Key` con una contraseña que coincida exactamente con la variable de entorno `SCRAPER_API_KEY`. Cualquier intento sin esta llave es rechazado con un error HTTP 403.

- **Eficiencia en BBDD (Batch Querying):** 
  En vez de lanzar una consulta SQL individual para actualizar cada set (lo que causaría un cuello de botella N+1), SQLAlchemy busca mediante el operador `IN` todos los `product_ids` recibidos de una sola pasada.

- **Idempotencia e Histórico de Precios:**
  El servidor no solo actualiza el valor `current_price` de la tabla de sets, sino que también genera un registro estadístico para el panel analítico.
  - El sistema comprueba si ya existe una entrada con fecha de "hoy" en la tabla `price_history` para el set actual.
  - Si no existe, crea un nuevo punto en la curva de tiempo. Esto permite que el scraper se pueda ejecutar repetidas veces en un mismo día sin generar datos duplicados ni alterar gráficas de evolución a largo plazo.

- **Transacción Atómica (ACID):**
  Todos los cambios se realizan en memoria (`db_set.current_price = new_price`). Al finalizar el bucle, se emite un único comando `db.commit()`. Esto garantiza que si se produce una excepción a mitad del procesamiento, la base de datos se mantiene en su estado original sin actualizaciones parciales o corruptas.

---

## 4. Automatización con GitHub Actions

La ejecución de este módulo está automatizada en el archivo de pipeline `.github/workflows/scraper.yml`.
- Se activa mediante un cron configurado (generalmente a las 02:00 AM).
- Instala las dependencias, lanza los binarios de Playwright y ejecuta `python scraper/main.py`.
- No requiere mantenimiento manual una vez configuradas las variables de entorno (`API_BASE_URL` y `SCRAPER_API_KEY`) en los secretos del repositorio.
