import asyncio
import requests
from typing import List, Dict, Any, Optional

from strategies.base import LegoScraperStrategy

class ScraperOrchestrator:
    """
    Orchestrates the scraping process: fetching sets, iterating safely, executing the injected strategy, and posting results.
    """
    def __init__(self, strategy: LegoScraperStrategy, api_base_url: str, api_key: Optional[str] = None):
        self.strategy = strategy
        self.api_base_url = api_base_url
        self.api_key = api_key

    async def get_sets_to_scrape(self) -> List[Dict[str, Any]]:
        print(f"Fetching sets from {self.api_base_url}/sets/")
        try:
            # Run requests.get asynchronously
            response = await asyncio.to_thread(requests.get, f"{self.api_base_url}/sets/", timeout=15)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Failed to fetch sets: {e}")
            return []

    async def send_webhook(self, results: List[Dict[str, Any]]):
        if not results:
            print("No results to send.")
            return

        print(f"Sending {len(results)} scraped prices back to API...")
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["X-Scraper-Api-Key"] = self.api_key
            
        try:
            # Run requests.post asynchronously
            res = await asyncio.to_thread(
                requests.post,
                f"{self.api_base_url}/scraper/webhook",
                json={"prices": results},
                headers=headers,
                timeout=15
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
        
        # Iterate sequentially to prevent memory saturation and rate limits
        for lego_set in sets_to_scrape:
            if lego_set.get("status") == "IN_STOCK" or lego_set.get("status") is None:
                pid = lego_set["product_id"]
                try:
                    # Delegation to the injected strategy
                    result = await self.strategy.scrape(pid)
                    if result:
                        results.append(result)
                except Exception as e:
                    # Orchestrator catches failures of individual runs
                    # and ensures the loop continues.
                    print(f"[Orchestrator] CRITICAL ERROR scraping {pid}: {e}. Skipping to next set.")
                        
        await self.send_webhook(results)
