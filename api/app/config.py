# Configuración central de la aplicación usando Pydantic BaseSettings
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Carga variables de entorno y provee configuración tipada a toda la app."""

    database_url: str
    direct_url: str
    supabase_url: str
    supabase_anon_key: str
    supabase_service_key: str = ""
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24  # 24 horas
    admin_email: str
    admin_password: str
    scraper_schedule_hour: int = 3
    rebrickable_api_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
