# Inspeccion temporal de monedas y Avg Price en BrickLink para set 9495
import asyncio
import re

from app.scraper.bricklink_scraper import BRICKLINK_PRICE_GUIDE_URL, BrickLinkScraper


async def main() -> None:
    scraper = BrickLinkScraper()
    try:
        set_key = scraper._to_bricklink_set_key("9495")
        url = BRICKLINK_PRICE_GUIDE_URL.format(set_key=set_key)
        response = await scraper.client.get(url)
        response.raise_for_status()
        text = response.text

        print("URL", str(response.url))
        print("HAS_EUR", "EUR" in text)
        print("HAS_USD", "USD" in text or "US $" in text)
        print("HAS_RON", "RON" in text or "ROL" in text)

        for m in re.finditer(r"Avg Price:[^<\n]{0,120}", text, re.I):
            print("AVG", m.group(0).strip())

        # Mostrar un fragmento alrededor de la frase de moneda mostrada
        token = "Showing prices in"
        idx = text.find(token)
        if idx >= 0:
            print("CONTEXT", text[max(0, idx - 120): idx + 220].replace("\n", " "))
    finally:
        await scraper.close()


if __name__ == "__main__":
    asyncio.run(main())
