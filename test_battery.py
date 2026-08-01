import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'scraper')))

from playwright.async_api import async_playwright
from scraper.strategies.full_data import FullDataScrapeStrategy

SETS_TO_TEST = ["75337", "10221", "75192", "21309"]

async def main():
    strategy = FullDataScrapeStrategy()
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        
        print("Starting battery of tests...")
        for product_id in SETS_TO_TEST:
            print(f"\nTesting set {product_id}...")
            result = await strategy.scrape(product_id, page)
            if result:
                print(f"Result for {product_id}:")
                print(f"  Price: {result.get('current_price')} €")
                print(f"  Used Price: {result.get('used_price')} €")
                print(f"  EOL:   {result.get('year_eol', 'None')}")
            else:
                print(f"Result for {product_id}: No data extracted.")
                
            await asyncio.sleep(2)
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
