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

    # Extraer primera secuencia de números con comas/puntos
    match = re.search(r"(\d+(?:[.,]\d+)*)", raw_price)
    if not match:
        return None
        
    cleaned_price = match.group(1)

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


def _clean_val_text(val_div) -> str:
    """Extrae texto de un div de valor eliminando scripts (sparklines) para evitar contaminación."""
    for script in val_div.find_all('script'):
        script.decompose()
    return val_div.get_text(" ", strip=True)


def extract_brickeconomy_data(html: str) -> dict:
    """Extrae precio retail, precio de mercado nuevo, precio usado y estado EOL
    desde el HTML de BrickEconomy, centrandose en la seccion 'Set Pricing'."""
    soup = BeautifulSoup(html, "html.parser")

    retail_price = None
    market_price = None
    used_price = None
    year_eol = None

    # --- 1. Extraer precios SOLO de la seccion "Set Pricing" ---
    pricing_section = soup.find('div', class_='setpricing')
    if pricing_section:
        body = pricing_section.find('div', class_='side-box-body')
        if body:
            # Rastrear sub-seccion actual: None → antes de cabeceras,
            # 'new' → New/Sealed, 'used' → Used
            current_subsection = None

            for el in body.find_all('div', recursive=False):
                classes = el.get('class', [])

                # Detectar cabeceras de sub-seccion (New/Sealed, Used)
                if 'semibold' in classes:
                    header_text = el.get_text(" ", strip=True).lower()
                    if 'new' in header_text or 'sealed' in header_text:
                        current_subsection = 'new'
                    elif 'used' in header_text:
                        current_subsection = 'used'
                    continue

                # Solo procesar filas de tipo rowlist
                if 'rowlist' not in classes:
                    continue

                label_div = el.find('div', class_='col-xs-5')
                val_div = el.find('div', class_='col-xs-7')

                if not label_div or not val_div:
                    continue

                label = label_div.get_text(" ", strip=True).lower()
                val = _clean_val_text(val_div)

                if "retail price" in label and retail_price is None:
                    retail_price = normalize_price_number(val)
                elif label == "value":
                    price_val = normalize_price_number(val)
                    if price_val is not None:
                        if current_subsection == 'new' and market_price is None:
                            market_price = price_val
                        elif current_subsection == 'used' and used_price is None:
                            used_price = price_val

    # --- 2. Fallback: si no se encontro la seccion setpricing, buscar globalmente ---
    if market_price is None and used_price is None and retail_price is None:
        for row in soup.find_all('div', class_='rowlist'):
            label_div = row.find('div', class_='col-xs-5')
            val_div = row.find('div', class_='col-xs-7')
            if not label_div or not val_div:
                continue
            label = label_div.get_text(" ", strip=True).lower()
            val = _clean_val_text(val_div)

            if "retail price" in label and retail_price is None:
                retail_price = normalize_price_number(val)
            elif ("market price" in label or "new/sealed" in label) and market_price is None:
                market_price = normalize_price_number(val)
            elif "used" in label and "price" in label and used_price is None:
                used_price = normalize_price_number(val)

    # --- 3. Extraer estado EOL (puede estar fuera de Set Pricing) ---
    for row in soup.find_all('div', class_='rowlist'):
        label_div = row.find('div', class_='col-xs-5')
        val_div = row.find('div', class_='col-xs-7')
        if not label_div or not val_div:
            continue
        label = label_div.get_text(" ", strip=True).lower()
        val = val_div.get_text(" ", strip=True)

        if label == "retired":
            match = re.search(r"\d{4}", val)
            if match:
                year_eol = f"Retired ({match.group()})"
        elif "availability" in label and "retired" in val.lower():
            if not year_eol:
                year_eol = "Retired"

    return {
        "retail_price": retail_price,
        "current_price": market_price if market_price is not None else retail_price,
        "used_price": used_price,
        "year_eol": year_eol
    }

# Compatibilidad con los nombres de funciones antiguas por si acaso se usan en otros sitios
def extract_brickeconomy_prices(html: str) -> Tuple[Optional[float], Optional[float]]:
    data = extract_brickeconomy_data(html)
    return data["retail_price"], data["current_price"]

def extract_brickeconomy_status(html: str) -> Optional[str]:
    return extract_brickeconomy_data(html)["year_eol"]