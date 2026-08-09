import requests
from typing import List, Dict, Any, Optional
from playwright.async_api import async_playwright

from strategies.base import LegoScraperStrategy

class ScraperOrchestrator:
    """
    Orchestrates the scraping process: fetching sets, launching browser,
    iterating safely, executing the injected strategy, and posting results.
    """
    def __init__(self, strategy: LegoScraperStrategy, api_base_url: str, api_key: Optional[str] = None):
        self.strategy = strategy
        self.api_base_url = api_base_url
        self.api_key = api_key

    async def get_sets_to_scrape(self) -> List[Dict[str, Any]]:
        print(f"Fetching sets from {self.api_base_url}/sets/")
        try:
            response = requests.get(f"{self.api_base_url}/sets/")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Failed to fetch sets: {e}")
            return []

    def send_webhook(self, results: List[Dict[str, Any]]):
        if not results:
            print("No results to send.")
            return

        print(f"Sending {len(results)} scraped prices back to API...")
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["X-Scraper-Api-Key"] = self.api_key
            
        try:
            res = requests.post(
                f"{self.api_base_url}/scraper/webhook",
                json={"prices": results},
                headers=headers
            )
            res.raise_for_status()
            print("Webhook sent successfully:", res.json())
        except Exception as e:
            print(f"Failed to send webhook: {e}")

    async def run(self, product_id: Optional[str] = None):
        sets_to_scrape = []
        if product_id:
            sets_to_scrape = [{"product_id": product_id, "status": "IN_STOCK"}]
        else:
            sets_to_scrape = await self.get_sets_to_scrape()
            
        if not sets_to_scrape:
            print("No sets found to scrape.")
            return

        results = []
        async with async_playwright() as p:
            # We can run headless=True for production, but it's set here internally.
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                ]
            )
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            page = await context.new_page()
            
            # Iterate sequentially to prevent memory saturation and rate limits
            for lego_set in sets_to_scrape:
                if lego_set.get("status") == "IN_STOCK" or lego_set.get("status") is None:
                    pid = lego_set["product_id"]
                    try:
                        # Delegation to the injected strategy
                        result = await self.strategy.scrape(pid, page)
                        if result:
                            results.append(result)
                    except Exception as e:
                        # Orchestrator catches failures of individual runs
                        # and ensures the loop continues.
                        print(f"[Orchestrator] CRITICAL ERROR scraping {pid}: {e}. Skipping to next set.")
                        
            await browser.close()
            
        self.send_webhook(results)
