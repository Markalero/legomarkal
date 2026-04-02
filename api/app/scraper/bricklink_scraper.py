# Scraper de BrickLink — fuente principal de precios
import calendar
import logging
import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from bs4 import BeautifulSoup

from app.scraper.base_scraper import BaseScraper, PriceData

logger = logging.getLogger(__name__)

BRICKLINK_URL = "https://www.bricklink.com/v2/catalog/catalogitem.page?S={set_key}"
# Forzamos Group by Currency para obtener precios por moneda y poder trabajar con EUR+USD.
BRICKLINK_PRICE_GUIDE_URL = "https://www.bricklink.com/catalogPG.asp?S={set_key}&colorID=0&viewExclude=N&v=D&cID=N"
SET_NUMBER_REGEX = re.compile(r"^(?P<base>\d{3,8})(?:-(?P<variant>\d+))?$")
MONTH_HEADER_REGEX = re.compile(
    r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}",
    re.I,
)
MONTH_NAME_TO_NUMBER = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}


class BrickLinkScraper(BaseScraper):
    """
    Scraper de BrickLink para obtener precios nuevos y usados de sets LEGO.
    Usa scraping HTML como fallback (la API oficial requiere OAuth complejo).
    """

    USD_TO_EUR_RATE = Decimal("0.92")
    RON_TO_EUR_RATE = Decimal("0.196")

    def _to_bricklink_set_key(self, set_number: str) -> str:
        """Normaliza códigos de set para consultas BrickLink (ej. 7965 -> 7965-1)."""
        raw = (set_number or "").strip()
        match = SET_NUMBER_REGEX.fullmatch(raw)
        if match:
            base = match.group("base")
            variant = match.group("variant") or "1"
            return f"{base}-{variant}"
        if "-" in raw:
            return raw
        return f"{raw}-1"

    async def fetch_price(self, set_number: str) -> Optional[PriceData]:
        set_key = self._to_bricklink_set_key(set_number)

        # Fuente principal: Price Guide por moneda (EUR/USD normalizados a EUR).
        # La ficha de catálogo puede mostrar importes condicionados por sesión local.
        pg_url = BRICKLINK_PRICE_GUIDE_URL.format(set_key=set_key)
        try:
            pg_response = await self.client.get(pg_url)
            pg_response.raise_for_status()
        except Exception as e:
            logger.warning(f"BrickLink Price Guide request failed for {set_number}: {e}")
            pg_response = None

        if pg_response is not None:
            data = self._parse_price_guide(pg_response.text, set_number)
            if data is not None:
                return data

        # Fallback secundario: ficha de catálogo.
        url = BRICKLINK_URL.format(set_key=set_key)
        try:
            response = await self.client.get(url)
            response.raise_for_status()
        except Exception as e:
            logger.warning(f"BrickLink request failed for {set_number}: {e}")
            return None

        return self._parse(response.text, set_number)

    async def fetch_set_metadata(self, set_number: str) -> Optional[dict]:
        """Obtiene metadatos básicos de un set desde la ficha pública de BrickLink."""
        set_key = self._to_bricklink_set_key(set_number)
        url = BRICKLINK_URL.format(set_key=set_key)
        try:
            response = await self.client.get(url)
            response.raise_for_status()
        except Exception as e:
            logger.warning(f"BrickLink metadata request failed for {set_number}: {e}")
            return None

        soup = BeautifulSoup(response.text, "lxml")
        name = self._extract_set_name(soup)
        image_url = self._extract_image_url(soup) or self._build_default_image_url(set_key)
        theme = self._extract_field_value(soup, "Theme") or self._extract_theme_from_breadcrumb(soup)

        year = None
        year_raw = self._extract_field_value(soup, "Year Released") or self._extract_field_value(soup, "Year")
        if year_raw:
            year_match = re.search(r"(19|20)\d{2}", year_raw)
            if year_match:
                year = int(year_match.group(0))
        if year is None:
            year = self._extract_year_from_text(soup)

        if not name and not image_url:
            return None

        return {
            "set_number": set_number.strip(),
            "name": name,
            "theme": theme,
            "year_released": year,
            "image_url": image_url,
        }

    def _extract_set_name(self, soup: BeautifulSoup) -> Optional[str]:
        title_tag = soup.select_one("meta[property='og:title']")
        if title_tag and title_tag.get("content"):
            name = self._clean_name(title_tag.get("content", ""))
            if name:
                return name

        h1_tag = soup.find("h1")
        if h1_tag:
            name = self._clean_name(h1_tag.get_text(" ", strip=True))
            if name:
                return name

        if soup.title:
            name = self._clean_name(soup.title.get_text(" ", strip=True))
            if name:
                return name

        return None

    def _clean_name(self, raw_name: str) -> Optional[str]:
        raw = (raw_name or "").strip()
        if not raw:
            return None
        raw = re.sub(r"(?i)^lego\s+", "", raw)
        raw = re.sub(r"\s*:\s*Set\s+\d{3,8}(?:-\d+)?\s*\|\s*BrickLink\s*$", "", raw, flags=re.I)
        raw = raw.split(" - ")[0].strip()
        return raw or None

    def _extract_image_url(self, soup: BeautifulSoup) -> Optional[str]:
        image_tag = soup.select_one("meta[property='og:image']")
        if image_tag and image_tag.get("content"):
            return image_tag.get("content")

        candidates = [
            "img#item-main",
            "img[src*='/ItemImage/']",
            "img[src*='ItemImage']",
        ]
        for selector in candidates:
            node = soup.select_one(selector)
            if not node:
                continue
            src = (node.get("src") or "").strip()
            if not src:
                continue
            if src.startswith("//"):
                return f"https:{src}"
            if src.startswith("/"):
                return f"https://www.bricklink.com{src}"
            return src

        return None

    def _build_default_image_url(self, set_key: str) -> str:
        """Construye URL canónica de imagen principal de set en BrickLink."""
        return f"https://img.bricklink.com/ItemImage/SN/0/{set_key}.png"

    def _extract_theme_from_breadcrumb(self, soup: BeautifulSoup) -> Optional[str]:
        """Extrae tema desde breadcrumb textual tipo 'Catalog : Sets : Theme : Subtheme'."""
        text = soup.get_text(" ", strip=True)
        m = re.search(r"Catalog\s*:\s*Sets\s*:\s*([^:|]+)", text, re.I)
        if not m:
            return None
        theme = m.group(1).strip()
        if not theme:
            return None
        if theme.lower() in {"set", "sets"}:
            return None
        return theme

    def _extract_year_from_text(self, soup: BeautifulSoup) -> Optional[int]:
        """Extrae año de lanzamiento desde texto libre cuando no hay campo tabular."""
        text = soup.get_text(" ", strip=True)
        m = re.search(r"Year\s+Released\s*:\s*((?:19|20)\d{2})", text, re.I)
        if m:
            return int(m.group(1))
        return None

    def _extract_field_value(self, soup: BeautifulSoup, field_label: str) -> Optional[str]:
        pattern = re.compile(rf"\b{re.escape(field_label)}\b", re.I)
        for row in soup.find_all("tr"):
            cells = row.find_all("td", recursive=False)
            if len(cells) < 2:
                continue
            if pattern.search(cells[0].get_text(" ", strip=True)):
                value = cells[1].get_text(" ", strip=True)
                return value or None
        return None

    def _parse(self, html: str, set_number: str) -> Optional[PriceData]:
        soup = BeautifulSoup(html, "lxml")

        price_new = self._extract_price(soup, "new")
        price_used = self._extract_price(soup, "used")

        if price_new is None and price_used is None:
            logger.info(f"BrickLink: no se encontraron precios para {set_number}")
            return None

        return PriceData(
            source="bricklink",
            price_new=price_new,
            price_used=price_used,
            min_price_new=price_new,
            max_price_new=price_new,
            min_price_used=price_used,
            max_price_used=price_used,
            currency="EUR",
        )

    def _extract_price(self, soup: BeautifulSoup, condition: str) -> Optional[Decimal]:
        """Extrae precio medio de la tabla de precios de BrickLink."""
        try:
            # BrickLink muestra "Avg Price" en la tabla de precios del catálogo
            tables = soup.find_all("table", {"id": re.compile(r".*price.*", re.I)})
            for table in tables:
                for row in table.find_all("tr"):
                    row_text = row.get_text(" ", strip=True)
                    row_text_l = row_text.lower()
                    if condition.lower() in row_text_l and "avg" in row_text_l:
                        amount, _ = self._extract_preferred_price_from_text(row_text)
                        if amount is not None:
                            return amount

                # Fallback si la estructura por filas cambia en el HTML.
                text = table.get_text(" ", strip=True)
                if condition.lower() in text.lower():
                    amount, _ = self._extract_preferred_price_from_text(text)
                    if amount is not None:
                        return amount
        except Exception as e:
            logger.debug(f"Error extrayendo precio {condition}: {e}")
        return None

    def _parse_price_guide(self, html: str, set_number: str) -> Optional[PriceData]:
        """Extrae precios New/Used desde la página catalogPG.asp de BrickLink."""
        soup = BeautifulSoup(html, "lxml")

        try:
            header_row = None
            for row in soup.find_all("tr"):
                txt = row.get_text(" ", strip=True).lower()
                if "last 6 months sales" in txt and "current items for sale" in txt:
                    header_row = row
                    break

            if header_row is None:
                logger.info(f"BrickLink Price Guide: cabecera no encontrada para {set_number}")
                return None

            data_rows = self._find_currency_data_rows(header_row)
            if not data_rows:
                logger.info(f"BrickLink Price Guide: fila de métricas no encontrada para {set_number}")
                return None

            all_new_candidates: list[Decimal] = []
            all_used_candidates: list[Decimal] = []
            all_values: list[Decimal] = []

            # Acumulamos histórico mensual real de todos los bloques de moneda.
            monthly_map: dict[tuple[int, int], dict[str, list[Decimal]]] = {}

            for data_row in data_rows:
                cols = data_row.find_all("td", recursive=False)
                if len(cols) < 2:
                    continue

                # Orden esperado de columnas:
                # [Last 6 Months Sales: New, Last 6 Months Sales: Used, Current New, Current Used]
                sales_new, _ = self._extract_avg_price_from_cell(cols[0])
                sales_used, _ = self._extract_avg_price_from_cell(cols[1])
                current_new, _ = self._extract_avg_price_from_cell(cols[2]) if len(cols) > 2 else (None, None)
                current_used, _ = self._extract_avg_price_from_cell(cols[3]) if len(cols) > 3 else (None, None)

                block_price_new = sales_new or current_new
                block_price_used = sales_used or current_used

                if block_price_new is not None:
                    all_new_candidates.append(block_price_new)
                    all_values.append(block_price_new)
                if block_price_used is not None:
                    all_used_candidates.append(block_price_used)
                    all_values.append(block_price_used)

                monthly_row = self._find_monthly_row_for_currency_block(data_row)
                monthly_cols = monthly_row.find_all("td", recursive=False) if monthly_row else []
                monthly_new = self._extract_monthly_avg_points(monthly_cols[0]) if len(monthly_cols) > 0 else []
                monthly_used = self._extract_monthly_avg_points(monthly_cols[1]) if len(monthly_cols) > 1 else []

                for point in monthly_new:
                    key = (point["year"], point["month"])
                    slot = monthly_map.setdefault(key, {"new": [], "used": []})
                    slot["new"].append(point["avg_price_eur"])

                for point in monthly_used:
                    key = (point["year"], point["month"])
                    slot = monthly_map.setdefault(key, {"new": [], "used": []})
                    slot["used"].append(point["avg_price_eur"])

            price_new = None
            if all_new_candidates:
                price_new = (sum(all_new_candidates) / Decimal(len(all_new_candidates))).quantize(Decimal("0.01"))

            price_used = None
            if all_used_candidates:
                price_used = (sum(all_used_candidates) / Decimal(len(all_used_candidates))).quantize(Decimal("0.01"))

            if price_new is None and price_used is None:
                return None

            new_values = all_new_candidates + ([price_new] if price_new is not None else [])
            used_values = all_used_candidates + ([price_used] if price_used is not None else [])

            monthly_history: list[dict] = []
            for year, month in sorted(monthly_map.keys()):
                row = monthly_map[(year, month)]
                month_new_values = row.get("new", [])
                month_used_values = row.get("used", [])

                month_new = None
                if month_new_values:
                    month_new = (sum(month_new_values) / Decimal(len(month_new_values))).quantize(Decimal("0.01"))

                month_used = None
                if month_used_values:
                    month_used = (sum(month_used_values) / Decimal(len(month_used_values))).quantize(Decimal("0.01"))

                if month_new is None and month_used is None:
                    continue

                month_last_day = calendar.monthrange(year, month)[1]
                fetched_at = datetime(year, month, month_last_day, 23, 59, 59, tzinfo=timezone.utc)
                monthly_history.append(
                    {
                        "fetched_at": fetched_at,
                        "price_new": month_new,
                        "price_used": month_used,
                        "min_price_new": month_new,
                        "max_price_new": month_new,
                        "min_price_used": month_used,
                        "max_price_used": month_used,
                        "currency": "EUR",
                    }
                )

            return PriceData(
                source="bricklink",
                price_new=price_new,
                price_used=price_used,
                min_price_new=min(new_values) if new_values else (min(all_values) if all_values else None),
                max_price_new=max(new_values) if new_values else (max(all_values) if all_values else None),
                min_price_used=min(used_values) if used_values else None,
                max_price_used=max(used_values) if used_values else None,
                currency="EUR",
                monthly_history=monthly_history,
            )
        except Exception as e:
            logger.debug(f"Error parseando Price Guide de BrickLink para {set_number}: {e}")
            return None

    def _find_currency_data_rows(self, header_row) -> list:
        """Recoge todas las filas de métricas por moneda de la tabla Price Guide."""
        data_rows: list = []
        for row in header_row.find_all_next("tr"):
            cells = row.find_all("td", recursive=False)
            if len(cells) < 4:
                continue

            text = row.get_text(" ", strip=True)
            if self._has_avg_price_label(text):
                data_rows.append(row)

        return data_rows

    def _find_monthly_row_for_currency_block(self, summary_row):
        """Localiza la fila que contiene el detalle mensual New/Used para la moneda activa."""
        for row in summary_row.find_next_siblings("tr"):
            cells = row.find_all("td", recursive=False)
            text = row.get_text(" ", strip=True)

            # Al llegar a la siguiente cabecera de moneda, termina el bloque actual.
            if self._is_currency_header_row(cells, text):
                break

            if len(cells) >= 2 and MONTH_HEADER_REGEX.search(text):
                return row

        return None

    def _is_currency_header_row(self, cells, text: str) -> bool:
        if len(cells) != 1:
            return False
        if re.search(r"\d", text):
            return False
        normalized = re.sub(r"\s+", " ", (text or "").strip())
        return bool(
            re.search(
                r"(Dollar|Euro|Pound|Leu|Koruna|Krone|Franc|Yen|Zloty|Forint|Ruble|Krona|Peso)",
                normalized,
                re.I,
            )
        )

    def _extract_avg_price_from_cell(self, cell) -> tuple[Optional[Decimal], Optional[str]]:
        text = cell.get_text(" ", strip=True)
        return self._extract_preferred_price_from_text(text)

    def _extract_preferred_price_from_text(self, text: str) -> tuple[Optional[Decimal], Optional[str]]:
        """Extrae Avg Price en EUR usando datos EUR y USD (USD convertido a EUR)."""
        eur_values: list[Decimal] = []
        normalized_text = (text or "").replace("\u00A0", " ")

        # Formato típico: "Avg Price: EUR 95.00", "Precio promedio: RON 617.00".
        for match in re.finditer(
            r"(?:Avg\s*Price|Precio\s*promedio)\s*:?\s*([A-Z]{3}|US\s*\$|€|\$)\s*([0-9][0-9,\.]*)",
            normalized_text,
            re.I,
        ):
            token = self._normalize_currency_token(match.group(1))
            amount = self._normalize_numeric_token(match.group(2))
            if amount is None:
                continue

            amount_eur = self._convert_to_eur(amount, token)
            if amount_eur is not None:
                eur_values.append(amount_eur)

        if eur_values:
            # Trabajar con todo el conjunto EUR+USD (convertido a EUR), no solo una moneda.
            avg_eur = (sum(eur_values) / Decimal(len(eur_values))).quantize(Decimal("0.01"))
            return avg_eur, "EUR"

        return None, None

    def _has_avg_price_label(self, text: str) -> bool:
        return bool(re.search(r"(?:Avg\s*Price|Precio\s*promedio)", text or "", re.I))

    def _extract_monthly_avg_points(self, cell) -> list[dict]:
        """Extrae meses reales del bloque Price Guide con su Avg Price normalizado a EUR."""
        text = cell.get_text(" ", strip=True).replace("\u00A0", " ")
        month_matches = list(
            re.finditer(
                r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})",
                text,
                re.I,
            )
        )
        if not month_matches:
            return []

        points: list[dict] = []
        for idx, match in enumerate(month_matches):
            month_name = (match.group(1) or "").strip().lower()
            year = int(match.group(2))
            month = MONTH_NAME_TO_NUMBER.get(month_name)
            if month is None:
                continue

            chunk_start = match.start()
            chunk_end = month_matches[idx + 1].start() if idx + 1 < len(month_matches) else len(text)
            chunk = text[chunk_start:chunk_end]

            avg_value, _ = self._extract_preferred_price_from_text(chunk)
            if avg_value is None:
                continue

            points.append(
                {
                    "year": year,
                    "month": month,
                    "avg_price_eur": avg_value,
                }
            )

        return points

    def _normalize_currency_token(self, token: str) -> str:
        return re.sub(r"\s+", "", (token or "").upper())

    def _convert_to_eur(self, amount: Decimal, token: str) -> Optional[Decimal]:
        if token in {"EUR", "€"}:
            return amount.quantize(Decimal("0.01"))
        if token in {"USD", "US$", "$"}:
            return (amount * self.USD_TO_EUR_RATE).quantize(Decimal("0.01"))
        if token in {"RON", "ROL"}:
            return (amount * self.RON_TO_EUR_RATE).quantize(Decimal("0.01"))
        return None
