"""Utilidades para extraer precios normalizados desde HTML de BrickEconomy."""

from __future__ import annotations

import re
from typing import Optional, Tuple

from bs4 import BeautifulSoup

_PRICE_PATTERN = r"([0-9][0-9\.,]*)"
_SEALED_LABELS = (
    "Nuevo/Sellado",
    "New/Sealed",
    "For Sale (New/Sealed)",
    "Factory Sealed",
    "NISB",
    "MISB",
    "Sealed",
)


def normalize_price_number(raw_price: str | None) -> Optional[float]:
    """Convierte un importe con formato ES/EN a float."""

    if not raw_price:
        return None

    cleaned_price = re.sub(r"[^\d,\.]", "", raw_price).strip()
    if not cleaned_price:
        return None

    if "," in cleaned_price and "." in cleaned_price:
        if cleaned_price.rfind(",") > cleaned_price.rfind("."):
            cleaned_price = cleaned_price.replace(".", "").replace(",", ".")
        else:
            cleaned_price = cleaned_price.replace(",", "")
    elif "," in cleaned_price:
        cleaned_price = cleaned_price.replace(".", "").replace(",", ".")

    try:
        return float(cleaned_price)
    except ValueError:
        return None


def _find_price_near_labels(text: str, labels: Tuple[str, ...]) -> Optional[float]:
    for label in labels:
        match = re.search(
            rf"{re.escape(label)}[\s\S]{{0,160}}?(?:€|EUR|US\$|\$)?\s*{_PRICE_PATTERN}",
            text,
            flags=re.IGNORECASE,
        )
        if match:
            price = normalize_price_number(match.group(1))
            if price is not None:
                return price

    return None


def extract_brickeconomy_prices(html: str) -> Tuple[Optional[float], Optional[float]]:
    """Extrae precio retail y precio actual priorizando Nuevo/Sellado."""

    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(" ", strip=True)

    retail_price = _find_price_near_labels(text, ("Retail price",))
    current_price = _find_price_near_labels(text, _SEALED_LABELS)

    if current_price is None:
        current_price = _find_price_near_labels(text, ("Market price", "Value"))

    return retail_price, current_price