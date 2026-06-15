import argparse
import asyncio
import os
import sys

# Ensure backend modules are available before importing strategies
BACKEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from orchestrator import ScraperOrchestrator
from strategies.full_data import FullDataScrapeStrategy
from strategies.price_only import PriceOnlyScrapeStrategy

API_BASE_URL = os.environ.get("API_BASE_URL", "http://127.0.0.1:8000/api")
API_KEY = os.environ.get("SCRAPER_API_KEY")

async def main():
    parser = argparse.ArgumentParser(description="Lego Scraper Worker")
    parser.add_argument("--product-id", type=str, help="Product ID to scrape")
    parser.add_argument(
        "--strategy", 
        type=str, 
        choices=["full", "price_only"], 
        default="full",
        help="Which scraping strategy to use"
    )
    args = parser.parse_args()

    if not API_KEY:
        print("WARNING: SCRAPER_API_KEY is not set. Webhooks might fail if API requires it.")

    # 1. Instantiate the chosen strategy
    if args.strategy == "full":
        strategy = FullDataScrapeStrategy()
    elif args.strategy == "price_only":
        strategy = PriceOnlyScrapeStrategy()
    else:
        # Fallback theoretically impossible due to argparse choices
        strategy = FullDataScrapeStrategy()

    print(f"Initialized with strategy: {strategy.__class__.__name__}")

    # 2. Instantiate the orchestrator with the strategy
    orchestrator = ScraperOrchestrator(
        strategy=strategy,
        api_base_url=API_BASE_URL,
        api_key=API_KEY
    )

    # 3. Execute
    await orchestrator.run(product_id=args.product_id)

if __name__ == "__main__":
    asyncio.run(main())
