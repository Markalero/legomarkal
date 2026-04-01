# Guia practica de lanzamiento y uso - LegoMarkal V1

## 1. Que es este proyecto en la practica

LegoMarkal V1 es un sistema interno para:
- gestionar inventario LEGO,
- importar y exportar productos,
- capturar precios de mercado,
- revisar alertas,
- ver KPIs de negocio en dashboard.

Se compone de:
- Backend API FastAPI en puerto 8000.
- Panel admin Next.js en puerto 3000.
- Base de datos PostgreSQL en Supabase (externa).

---

## 2. Requisitos previos

Necesitas tener instalado:
- Docker Desktop (opcion recomendada).
- Node.js 18+ (si vas a ejecutar frontend en local sin Docker).
- Python 3.11+ (si vas a ejecutar backend en local sin Docker).

Y ademas:
- Acceso a credenciales de Supabase/PostgreSQL.
- Variables de entorno configuradas.

---

## 3. Configuracion inicial de entorno

## 3.1 Backend (.env)

1. En `api/`, crea un fichero `.env` copiando `api/.env.example`.
2. Rellena valores reales.
3. Importante: `ADMIN_PASSWORD` debe ser un hash bcrypt, no texto plano.

Ejemplo para generar hash bcrypt en local:

```powershell
python -c "from passlib.context import CryptContext; print(CryptContext(schemes=['bcrypt'], deprecated='auto').hash('TuPasswordSegura123'))"
```

Copia el resultado en `ADMIN_PASSWORD`.

## 3.2 Frontend (.env.local)

1. En `admin-panel/`, crea `.env.local` copiando `admin-panel/.env.local.example`.
2. Verifica:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 4. Opcion A (recomendada): lanzar con Docker Compose

Desde la raiz del repo ejecuta:

```powershell
docker compose up --build
```

Resultado esperado:
- API en `http://localhost:8000`
- Swagger API en `http://localhost:8000/docs`
- Panel admin en `http://localhost:3000`

Para parar:

```powershell
docker compose down
```

---

## 5. Opcion B: lanzamiento manual (sin Docker)

## 5.1 Backend

```powershell
cd api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## 5.2 Frontend

En otra terminal:

```powershell
cd admin-panel
npm install
npm run dev
```

---

## 6. Comprobaciones rapidas de que todo esta bien

1. Health backend:
- URL: `http://localhost:8000/health`
- Respuesta esperada: `{"status":"ok","service":"LegoMarkal API"}`

2. Swagger:
- URL: `http://localhost:8000/docs`
- Debes ver endpoints de auth/products/categories/prices/alerts/dashboard.

3. Panel:
- URL: `http://localhost:3000`
- Debe redirigir a login si no hay sesion.

---

## 7. Primer uso paso a paso (flujo real)

1. Entra al panel `http://localhost:3000/login`.
2. Inicia sesion con `ADMIN_EMAIL` y la password en texto plano que corresponda al hash configurado.
3. Crea o revisa categorias.
4. Crea un producto manualmente o importa CSV/Excel.
5. Ejecuta scraping:
- Desde dashboard (trigger global), o
- desde vistas de producto/precios para scraping puntual.
6. Revisa:
- historico de precios,
- alertas activas,
- KPIs del dashboard.
7. Exporta inventario a CSV cuando necesites reporte.

---

## 8. Como se usa cada modulo (resumen util)

- Inventario:
  - alta, edicion, borrado logico, filtros y paginacion.
- Importacion masiva:
  - subida de CSV/Excel para cargar stock rapido.
- Precios:
  - historico por producto y scraping manual.
- Alertas:
  - reglas por umbral para detectar oportunidades/riesgos.
- Dashboard:
  - valor compra, valor mercado, margen potencial, top margen.

---

## 9. Operacion diaria recomendada

1. Revisar dashboard al inicio del dia.
2. Revisar alertas activas.
3. Ejecutar scraping manual si hay productos clave.
4. Registrar nuevas compras en inventario.
5. Exportar CSV semanal para control externo.

Nota:
- El scheduler del backend ya ejecuta scraping diario automaticamente (hora configurada con `SCRAPER_SCHEDULE_HOUR`).

---

## 10. Problemas comunes y solucion

1. Error de login con credenciales correctas:
- Verifica que `ADMIN_PASSWORD` en `.env` sea hash bcrypt valido.
- Regenera hash y reinicia servicios.

2. El frontend no conecta con API:
- Revisa `NEXT_PUBLIC_API_URL` en `admin-panel/.env.local`.
- Verifica que API este en `http://localhost:8000`.

3. Error de base de datos:
- Revisa `DATABASE_URL` y `DIRECT_URL`.
- Asegura conectividad a Supabase y credenciales correctas.

4. Scraping sin datos:
- Puede deberse a cambios en HTML de fuentes externas.
- Revisa logs del backend para cada scraper.

5. Cambios no se reflejan en Docker:
- Ejecuta `docker compose up --build` para reconstruir.

---

## 11. Comandos utiles

Arranque completo:

```powershell
docker compose up --build
```

Parada:

```powershell
docker compose down
```

Solo backend manual:

```powershell
cd api; .\.venv\Scripts\Activate.ps1; uvicorn app.main:app --reload
```

Solo frontend manual:

```powershell
cd admin-panel; npm run dev
```

---

## 12. Estado actual para cliente

A dia de hoy tienes un MVP interno usable para:
- controlar stock,
- valorar inventario con datos de mercado,
- detectar alertas,
- apoyar decisiones de compra/venta.

No es aun una tienda B2C publica final, pero si una base operativa real para gestion profesional interna.
