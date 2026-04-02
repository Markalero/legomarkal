# Punto de entrada de FastAPI — registra routers, CORS y lifecycle del scheduler
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers import auth, products, prices, alerts, dashboard
from app.routers.dashboard import scraper_router
from app.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Arranca el scheduler al iniciar y lo para al apagar."""
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title="LegoMarkal API",
    description="API de gestión de inventario y precios de mercado LEGO",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — permite peticiones desde el panel de administración Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://legomarkal.vercel.app", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registro de routers
app.include_router(auth.router)
app.include_router(products.router)
app.include_router(prices.router)
app.include_router(alerts.router)
app.include_router(dashboard.router)
app.include_router(scraper_router)

# Archivos estáticos para imágenes de productos.
uploads_dir = Path(__file__).resolve().parents[1] / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")


@app.get("/health")
def health():
    return {"status": "ok", "service": "LegoMarkal API"}
