from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import sets, sales, metrics, scraper

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="LEGO Stock Manager PRO API",
    description="API for LEGO inventory management and sales.",
    version="1.0.0",
)

# CORS config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For production, change to specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(sets.router, prefix="/api")
app.include_router(sales.router, prefix="/api")
app.include_router(metrics.router, prefix="/api")
app.include_router(scraper.router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "LEGO Stock Manager PRO API is running"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
