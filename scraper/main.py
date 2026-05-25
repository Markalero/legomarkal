import asyncio
import os
import random
import requests
from playwright.async_api import async_playwright

API_BASE_URL = os.environ.get("API_BASE_URL", "http://127.0.0.1:8000/api")
API_KEY = os.environ.get("SCRAPER_API_KEY")

async def get_sets_to_scrape():
    print(f"Fetching sets from {API_BASE_URL}/sets/")
    try:
        response = requests.get(f"{API_BASE_URL}/sets/")
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Failed to fetch sets: {e}")
        return []

async def scrape_lego_price(page, product_id):
    print(f"Scraping price for product {product_id}...")
    try:
        set_num = product_id if "-" in product_id else f"{product_id}-1"
        url = f"https://www.brickeconomy.com/set/{set_num}/"
        
        response = await page.goto(url, wait_until="domcontentloaded")
        if response and response.status == 404:
            print(f"Set {product_id} not found in BrickEconomy")
            return None
            
        # Add a random delay to prevent rate limits and wait for any anti-bot
        await asyncio.sleep(random.uniform(2.0, 4.0))
        
        html = await page.content()
        from bs4 import BeautifulSoup
        import re
        soup = BeautifulSoup(html, 'html.parser')
        
        retail_price_val = None
        
        for div in soup.find_all('div', class_='row'):
            cols = div.find_all('div')
            if len(cols) >= 2:
                lbl = cols[0].get_text(strip=True)
                val = cols[1].get_text(separator=' ', strip=True)
                if lbl == "Retail price":
                    cleaned_price = re.sub(r'[^\d.]', '', val)
                    if cleaned_price:
                        retail_price_val = float(cleaned_price)
                        break
        
        if retail_price_val is not None:
            print(f"Success! {product_id} price: {retail_price_val}")
            return {"product_id": product_id, "current_price": retail_price_val}
        else:
            print(f"Could not find retail price for {product_id}")
            return None
            
    except Exception as e:
        print(f"Error scraping {product_id}: {e}")
        return None

async def main():
    if not API_KEY:
        print("ERROR: SCRAPER_API_KEY is not set.")
        return

    sets = await get_sets_to_scrape()
    if not sets:
        print("No sets found to scrape.")
        return

    results = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        # Iterate sequentially to prevent memory saturation and rate limits
        for lego_set in sets:
            if lego_set["status"] == "IN_STOCK":
                result = await scrape_lego_price(page, lego_set["product_id"])
                if result:
                    results.append(result)
                    
        await browser.close()
        
    if results:
        print(f"Sending {len(results)} scraped prices back to API...")
        headers = {"X-Scraper-Api-Key": API_KEY, "Content-Type": "application/json"}
        try:
            res = requests.post(
                f"{API_BASE_URL}/scraper/webhook",
                json={"prices": results},
                headers=headers
            )
            res.raise_for_status()
            print("Webhook sent successfully:", res.json())
        except Exception as e:
            print(f"Failed to send webhook: {e}")

if __name__ == "__main__":
    asyncio.run(main())
