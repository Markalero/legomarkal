from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sys
import traceback
from urllib.parse import urlparse
from database import engine, Base, DATABASE_URL
from routers import sets, sales, metrics, scraper

# Print masked database connection info to Render logs
try:
    if DATABASE_URL:
        parsed = urlparse(DATABASE_URL)
        print(f"INFO: Attempting database connection: scheme={parsed.scheme}, host={parsed.hostname}, port={parsed.port}, database={parsed.path.lstrip('/')}")
    else:
        print("WARNING: DATABASE_URL is not set!")
except Exception as e:
    print(f"ERROR: Failed to parse DATABASE_URL for logging: {e}", file=sys.stderr)

# Create database tables
try:
    print("INFO: Synchronizing database schema...")
    Base.metadata.create_all(bind=engine)
    print("INFO: Database schema sync complete.")
except Exception as e:
    print("CRITICAL: Failed to connect to database or create tables!", file=sys.stderr)
    traceback.print_exc()
    sys.exit(1)

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
