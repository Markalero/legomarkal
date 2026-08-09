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


def extract_brickeconomy_data(html: str) -> dict:
    """Extrae precio retail, precio de mercado, precio usado y estado EOL desde el HTML de BrickEconomy iterando sobre la tabla de propiedades."""
    soup = BeautifulSoup(html, "html.parser")
    
    retail_price = None
    market_price = None
    used_price = None
    year_eol = None
    
    value_count = 0
    
    rowlists = soup.find_all('div', class_='rowlist')
    for row in rowlists:
        label_div = row.find('div', class_='col-xs-5')
        val_div = row.find('div', class_='col-xs-7')
        
        if not label_div or not val_div:
            continue
            
        label = label_div.get_text(" ", strip=True).lower()
        val = val_div.get_text(" ", strip=True)
        
        if "retail price" in label and not retail_price:
            retail_price = normalize_price_number(val)
        elif ("market price" in label or "value" in label or "new/sealed" in label) and not any(x in label for x in ["part", "minifig", "piece"]):
            # The first value is usually the new price, the second is the used price
            price_val = normalize_price_number(val)
            if price_val is not None:
                if market_price is None:
                    market_price = price_val
                elif used_price is None and price_val != market_price:
                    used_price = price_val
        elif "used" in label and "price" in label and not used_price:
            used_price = normalize_price_number(val)
        elif label == "retired":
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