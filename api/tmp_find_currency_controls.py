# Busca pistas de selector de moneda en HTML BrickLink
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
        html = response.text

        patterns = [r"vcID", r"Currency", r"RON", r"EUR", r"USD", r"set.*curr", r"showing prices in", r"group by currency"]
        for p in patterns:
            found = bool(re.search(p, html, re.I))
            print(p, found)

        # imprimir líneas cortas que contengan currency/vcID
        for m in re.finditer(r".{0,120}(vcID|currency|showing prices in).{0,160}", html, re.I):
            line = m.group(0).replace("\n", " ")
            print("CTX", line[:320])
    finally:
        await scraper.close()


if __name__ == "__main__":
    asyncio.run(main())
