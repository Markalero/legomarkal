# Scraper de eBay — verificación secundaria (ventas completadas)
import logging
from decimal import Decimal
from typing import Optional
from urllib.parse import quote_plus

from bs4 import BeautifulSoup

from app.scraper.base_scraper import BaseScraper, PriceData

logger = logging.getLogger(__name__)

EBAY_URL = "https://www.ebay.es/sch/i.html?_nkw={query}&LH_Complete=1&LH_Sold=1&_sacat=0"


class EbayScraper(BaseScraper):
    """
    Scraper de eBay para ventas completadas — confirma el precio real de mercado.
    Usa la búsqueda pública de eBay España sin API key.
    """

    async def fetch_price(self, set_number: str) -> Optional[PriceData]:
        query = quote_plus(f"LEGO {set_number}")
        url = EBAY_URL.format(query=query)
        try:
            response = await self.client.get(url)
            response.raise_for_status()
        except Exception as e:
            logger.warning(f"eBay request failed for {set_number}: {e}")
            return None

        return self._parse(response.text, set_number)

    def _parse(self, html: str, set_number: str) -> Optional[PriceData]:
        soup = BeautifulSoup(html, "lxml")

        # eBay muestra precios de ventas completadas en spans con clase s-item__price
        price_spans = soup.select(".s-item__price")
        prices: list[Decimal] = []
        for span in price_spans[:20]:  # limitar a los 20 primeros resultados
            text = span.get_text()
            prices.extend(self.extract_currency_amounts(text))

        if not prices:
            return None

        avg = sum(prices) / len(prices)
        return PriceData(
            source="ebay",
            price_new=max(prices),
            min_price_new=min(prices),
            max_price_new=max(prices),
            price_used=round(avg, 2),
            min_price_used=min(prices),
            max_price_used=max(prices),
            currency="EUR",
        )
