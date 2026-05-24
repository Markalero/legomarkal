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
        # Dummy logic for scraping.
        # In the real world, you'd navigate and extract the price here.
        
        # Add a random delay to prevent rate limits
        await asyncio.sleep(random.uniform(1.0, 3.0))
        
        # Simulate a successful scrape 90% of the time, and a failure 10%
        if random.random() < 0.1:
            raise Exception("Simulated DOM change timeout")

        return {"product_id": product_id, "current_price": 99.99}
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
