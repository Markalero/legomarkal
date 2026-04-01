# Prueba temporal de BrickLink Price Guide en modo Group by Currency
import asyncio
import re

from app.scraper.bricklink_scraper import BrickLinkScraper


async def main() -> None:
    scraper = BrickLinkScraper()
    try:
        set_key = scraper._to_bricklink_set_key("9495")
        url = f"https://www.bricklink.com/catalogPG.asp?S={set_key}-&colorID=0&viewExclude=N&v=D&cID=N"
        r = await scraper.client.get(url)
        r.raise_for_status()
        t = r.text
        print("URL", str(r.url))
        print("HAS_EUR", "EUR" in t)
        print("HAS_USD", "USD" in t or "US $" in t)
        print("HAS_RON", "RON" in t or "ROL" in t)
        for m in re.finditer(r".{0,90}Avg Price.{0,140}", t, re.I):
            s = m.group(0).replace("\n", " ")
            if any(x in s for x in ["EUR", "USD", "RON", "ROL", "US $"]):
                print("AVG", s[:260])
    finally:
        await scraper.close()


if __name__ == "__main__":
    asyncio.run(main())
