# Scraper de BrickEconomy — tendencias históricas y valoración
import logging
from typing import Optional

from bs4 import BeautifulSoup

from app.scraper.base_scraper import BaseScraper, PriceData

logger = logging.getLogger(__name__)

BRICKECONOMY_URL = "https://www.brickeconomy.com/set/{set_number}-1"


class BrickEconomyScraper(BaseScraper):
    """
    Scraper de BrickEconomy para valoración y rango de precios de mercado.
    Complementa a BrickLink con datos de tendencia y min/max.
    """

    async def fetch_price(self, set_number: str) -> Optional[PriceData]:
        url = BRICKECONOMY_URL.format(set_number=set_number)
        try:
            response = await self.client.get(url)
            response.raise_for_status()
        except Exception as e:
            logger.warning(f"BrickEconomy request failed for {set_number}: {e}")
            return None

        return self._parse(response.text, set_number)

    def _parse(self, html: str, set_number: str) -> Optional[PriceData]:
        soup = BeautifulSoup(html, "lxml")
        value_text = soup.get_text()

        decimals = self.extract_currency_amounts(value_text)

        if not decimals:
            return None

        return PriceData(
            source="brickeconomy",
            price_new=max(decimals),
            min_price_new=min(decimals),
            max_price_new=max(decimals),
            price_used=min(decimals),
            min_price_used=min(decimals),
            max_price_used=max(decimals),
            currency="EUR",
        )
