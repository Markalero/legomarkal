import asyncio
import os
import requests
from playwright.async_api import async_playwright

API_BASE_URL = os.environ.get("API_BASE_URL", "http://127.0.0.1:8000/api")
API_KEY = os.environ.get("SCRAPER_API_KEY")

async def get_sets_to_scrape():
    # In a real scenario, this would query the API for sets IN_STOCK
    print(f"Fetching sets from {API_BASE_URL}/sets/")
    try:
        response = requests.get(f"{API_BASE_URL}/sets/")
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Failed to fetch sets: {e}")
        return []

async def scrape_lego_price(page, product_id):
    # Dummy logic for scraping.
    # In the real world, you'd navigate to lego.com or bricklink, search product_id, and extract price.
    print(f"Scraping price for product {product_id}...")
    # await page.goto(f"https://www.lego.com/en-es/product/{product_id}")
    # price_element = await page.locator("...").inner_text()
    
    # Simulating a fetched price
    return {"product_id": product_id, "current_price": 99.99}

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
