# Autocompletado Mágico mediante Web Scraping (Sin APIs)

El objetivo es eliminar la dependencia de la API de terceros (Rebrickable) en la ventana de "Añadir Set", y en su lugar, extraer el nombre y la foto directamente desde `brickeconomy.com` usando Web Scraping puro cada vez que pulses el botón de autocompletado.

## ⚠️ User Review Required

> [!WARNING]
> **Bloqueos Anti-Bot (Cloudflare):**
> BrickEconomy bloquea activamente los rastreadores simples. Para solucionarlo, debemos instalar un navegador invisible (Playwright) en el backend (FastAPI). 
> 
> **Consecuencias de usar Playwright en tiempo real:**
> 1. **Velocidad:** Al pulsar "Buscar", el backend tardará entre 3 y 8 segundos en abrir el navegador invisible, evadir el anti-bot, leer la página y cerrarlo. No será instantáneo.
> 2. **Consumo de Memoria:** Playwright consume mucha RAM. Si tu backend está alojado en la capa gratuita de Render (512MB de RAM), es posible que sufra apagones ocasionales por falta de memoria al abrir el navegador.

## Proposed Changes

---

### Backend (Python/FastAPI)

#### [MODIFY] [requirements.txt](file:///c:/Users/Ander/Desktop/juegos/yop/LegoMarkal/backend/requirements.txt)
- Añadir `playwright` y `beautifulsoup4`.

#### [NEW] [routers/autocomplete.py](file:///c:/Users/Ander/Desktop/juegos/yop/LegoMarkal/backend/routers/autocomplete.py)
- Crear un nuevo endpoint de API interna (`GET /api/autocomplete/{product_id}`).
- Este endpoint lanzará `async_playwright()`, navegará a `https://www.brickeconomy.com/set/{product_id}-1/`, esperará a que cargue el HTML saltándose el Cloudflare, extraerá el título (`h1`) y el link de la imagen principal.

#### [MODIFY] [main.py](file:///c:/Users/Ander/Desktop/juegos/yop/LegoMarkal/backend/main.py)
- Importar y registrar el nuevo enrutador `autocomplete.py`.

---

### Frontend (Next.js/React)

#### [MODIFY] [add-set-dialog.tsx](file:///c:/Users/Ander/Desktop/juegos/yop/LegoMarkal/frontend/src/components/add-set-dialog.tsx)
- Borrar toda la lógica de la API de Rebrickable.
- Redirigir el botón de búsqueda para que apunte a tu propio backend (`/api/autocomplete/${product_id}`).
- Añadir un estado de "Cargando..." más largo en el botón (con un *spinner*) para avisar al usuario de que el scraping en vivo puede tardar unos segundos.

## Verification Plan

### Manual Verification
1. Abrir la ventana de "Añadir Set" en el navegador local.
2. Introducir un ID (ej: `75192`).
3. Comprobar que en el terminal del backend arranca el navegador invisible y en unos segundos rellena el formulario con "75192 LEGO Star Wars Millennium Falcon" y su imagen oficial de BrickEconomy.
