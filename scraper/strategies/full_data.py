import asyncio
import random
import requests
from typing import Dict, Any, Optional

from strategies.base import LegoScraperStrategy

try:
    from price_utils import extract_brickeconomy_data
except ImportError:
    pass

class FullDataScrapeStrategy(LegoScraperStrategy):
    """
    Strategy that aims to extract comprehensive data (price and potentially name/image/status)
    from a complex source like BrickEconomy.
    """
    
    async def scrape(self, product_id: str, session: Any = None) -> Optional[Dict[str, Any]]:
        print(f"[FullDataStrategy] Scraping comprehensive data for product {product_id}...")
        try:
            set_num = product_id if "-" in product_id else f"{product_id}-1"
            url = f"https://www.brickeconomy.com/set/{set_num}/"
            
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            
            # Use asyncio.to_thread to run requests.get synchronously without blocking the event loop
            response = await asyncio.to_thread(requests.get, url, headers=headers, timeout=15)
            
            if response.status_code == 404:
                print(f"[FullDataStrategy] Set {product_id} not found.")
                return None
            elif response.status_code != 200:
                print(f"[FullDataStrategy] Failed with status {response.status_code} for {product_id}")
                return None
                
            html = response.text
            
            # Extract all data
            data = extract_brickeconomy_data(html)
            
            final_price = data.get("current_price")
            used_price = data.get("used_price")
            year_eol = data.get("year_eol")
            
            if final_price is not None or year_eol is not None or used_price is not None:
                print(f"[FullDataStrategy] Success! {product_id} price: {final_price}, used: {used_price}, EOL: {year_eol}")
                return {
                    "product_id": product_id,
                    "current_price": final_price,
                    "used_price": used_price,
                    "year_eol": year_eol
                }
            else:
                print(f"[FullDataStrategy] Could not find any price or status for {product_id}")
                return None
                
        except Exception as e:
            print(f"[FullDataStrategy] Error scraping {product_id}: {e}")
            return None
