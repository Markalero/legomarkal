import asyncio
import random
from typing import Dict, Any, Optional
from bs4 import BeautifulSoup
from playwright.async_api import Page

from strategies.base import LegoScraperStrategy

# Import from backend since sys.path is updated in main.py
try:
    from price_utils import extract_brickeconomy_prices
except ImportError:
    pass # Will be handled if not injected properly, but we trust main.py does it.

class FullDataScrapeStrategy(LegoScraperStrategy):
    """
    Strategy that aims to extract comprehensive data (price and potentially name/image/status)
    from a complex source like BrickEconomy.
    """
    
    async def scrape(self, product_id: str, page: Page) -> Optional[Dict[str, Any]]:
        print(f"[FullDataStrategy] Scraping comprehensive data for product {product_id}...")
        try:
            set_num = product_id if "-" in product_id else f"{product_id}-1"
            url = f"https://www.brickeconomy.com/set/{set_num}/"
            
            response = await page.goto(url, wait_until="domcontentloaded")
            if response and response.status == 404:
                print(f"[FullDataStrategy] Set {product_id} not found.")
                return None
                
            # Random delay for anti-bot
            await asyncio.sleep(random.uniform(2.0, 4.0))
            
            html = await page.content()
            
            # Extract price
            retail_price_val, value_val = extract_brickeconomy_prices(html)
            
            # Prefer 'Value' (market price), fallback to 'Retail price'
            final_price = value_val if value_val is not None else retail_price_val
            
            # Here we could also parse `html` with BeautifulSoup to get name, images, etc.
            # soup = BeautifulSoup(html, 'html.parser')
            # name_elem = soup.find('h1')
            # name = name_elem.text.strip() if name_elem else "Unknown"
            
            if final_price is not None:
                print(f"[FullDataStrategy] Success! {product_id} price: {final_price}")
                return {
                    "product_id": product_id,
                    "current_price": final_price,
                    # "name": name,
                }
            else:
                print(f"[FullDataStrategy] Could not find any price for {product_id}")
                return None
                
        except Exception as e:
            print(f"[FullDataStrategy] Error scraping {product_id}: {e}")
            return None
