import asyncio
import random
from typing import Dict, Any, Optional
from playwright.async_api import Page

from strategies.base import LegoScraperStrategy

try:
    from price_utils import extract_brickeconomy_prices
except ImportError:
    pass

class PriceOnlyScrapeStrategy(LegoScraperStrategy):
    """
    Strategy that focuses on extracting just the market price as fast as possible.
    For this example, it uses the same source but simulates a faster scrape with 
    a shorter delay and no extra HTML parsing (like beautifulsoup) beyond the price regex.
    """
    
    async def scrape(self, product_id: str, page: Page) -> Optional[Dict[str, Any]]:
        print(f"[PriceOnlyStrategy] Scraping ONLY price for product {product_id}...")
        try:
            set_num = product_id if "-" in product_id else f"{product_id}-1"
            url = f"https://www.brickeconomy.com/set/{set_num}/"
            
            response = await page.goto(url, wait_until="domcontentloaded")
            if response and response.status == 404:
                print(f"[PriceOnlyStrategy] Set {product_id} not found.")
                return None
                
            # Shorter delay for "fast" strategy
            await asyncio.sleep(random.uniform(1.0, 2.0))
            
            html = await page.content()
            
            # Using our backend regex-based utility which is fast
            retail_price_val, value_val = extract_brickeconomy_prices(html)
            final_price = value_val if value_val is not None else retail_price_val
            
            if final_price is not None:
                print(f"[PriceOnlyStrategy] Success! {product_id} price: {final_price}")
                return {
                    "product_id": product_id,
                    "current_price": final_price
                }
            else:
                print(f"[PriceOnlyStrategy] Could not find any price for {product_id}")
                return None
                
        except Exception as e:
            print(f"[PriceOnlyStrategy] Error scraping {product_id}: {e}")
            return None
