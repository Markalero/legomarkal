# Clase base abstracta para todos los scrapers de precios
import asyncio
import logging
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)


@dataclass
class PriceData:
    """Resultado normalizado de un scraper."""
    source: str
    price_new: Optional[Decimal] = None
    min_price_new: Optional[Decimal] = None
    max_price_new: Optional[Decimal] = None
    price_used: Optional[Decimal] = None
    min_price_used: Optional[Decimal] = None
    max_price_used: Optional[Decimal] = None
    currency: str = "EUR"
    # Puntos mensuales reales del Price Guide (si la fuente los expone).
    monthly_history: list[dict] = field(default_factory=list)


class BaseScraper(ABC):
    """Define la interfaz común para todos los scrapers. Incluye rate limiting y reintentos."""

    RATE_LIMIT_SECONDS: float = 2.0
    CURRENCY_TOKEN_REGEX = re.compile(
        r"(?:\b[A-Z]{3}\b|€|\$|£)\s*([0-9][0-9.,\s]{0,18})|([0-9][0-9.,\s]{0,18})\s*(?:\b[A-Z]{3}\b|€|\$|£)",
        re.IGNORECASE,
    )

    def __init__(self):
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={"User-Agent": "Mozilla/5.0 (compatible; LegoMarkal/1.0)"},
            follow_redirects=True,
        )

    @abstractmethod
    async def fetch_price(self, set_number: str) -> Optional[PriceData]:
        """Obtiene precios para un número de set. Devuelve None si no encuentra datos."""
        ...

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def fetch_with_retry(self, set_number: str) -> Optional[PriceData]:
        """Envuelve fetch_price con reintentos y rate limiting."""
        await asyncio.sleep(self.RATE_LIMIT_SECONDS)
        return await self.fetch_price(set_number)

    async def close(self):
        await self.client.aclose()

    @staticmethod
    def _normalize_numeric_token(raw: str) -> Optional[Decimal]:
        """Convierte tokens numéricos con separadores locales a Decimal."""
        if not raw:
            return None

        token = re.sub(r"\s+", "", raw)
        token = token.replace("\u00A0", "")
        token = re.sub(r"[^0-9,\.]", "", token)

        if not token or not any(ch.isdigit() for ch in token):
            return None

        has_dot = "." in token
        has_comma = "," in token

        if has_dot and has_comma:
            # El separador decimal suele ser el último de los dos.
            decimal_sep = "." if token.rfind(".") > token.rfind(",") else ","
            thousands_sep = "," if decimal_sep == "." else "."
            token = token.replace(thousands_sep, "")
            token = token.replace(decimal_sep, ".")
        elif has_comma:
            # Si la parte final tiene 1-2 dígitos, tratamos coma como decimal.
            tail = token.rsplit(",", 1)[-1]
            if token.count(",") == 1 and len(tail) <= 2:
                token = token.replace(",", ".")
            else:
                token = token.replace(",", "")
        elif has_dot:
            tail = token.rsplit(".", 1)[-1]
            if token.count(".") == 1 and len(tail) <= 2:
                pass
            else:
                token = token.replace(".", "")

        try:
            value = Decimal(token)
        except Exception:
            return None

        if value <= 0:
            return None

        # Evita outliers evidentes por parseo defectuoso.
        if value > Decimal("1000000"):
            return None

        return value

    @classmethod
    def extract_currency_amounts(cls, text: str) -> list[Decimal]:
        """Extrae importes detectando símbolo/código de moneda antes o después del número."""
        if not text:
            return []

        values: list[Decimal] = []
        for before, after in cls.CURRENCY_TOKEN_REGEX.findall(text):
            token = before or after
            amount = cls._normalize_numeric_token(token)
            if amount is not None:
                values.append(amount)
        return values
