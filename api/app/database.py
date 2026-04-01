# Motor SQLAlchemy y sesión de BD apuntando a Supabase PostgreSQL
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings

# Elimina el parámetro ?pgbouncer=true que psycopg2 no entiende
_db_url = settings.database_url.replace("?pgbouncer=true", "").replace("&pgbouncer=true", "")

engine = create_engine(
    _db_url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """Dependencia FastAPI: abre y cierra sesión de BD por request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
