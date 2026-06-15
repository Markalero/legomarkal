import os
import sys
import pytest
from playwright.async_api import async_playwright

# Ensure backend modules are available before importing strategies
BACKEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from strategies.full_data import FullDataScrapeStrategy
from strategies.price_only import PriceOnlyScrapeStrategy

@pytest.mark.asyncio
async def test_full_data_strategy():
    strategy = FullDataScrapeStrategy()
    async with async_playwright() as p:
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
        
        try:
            # We use a well-known set ID, e.g., 75192 (Millennium Falcon)
            result = await strategy.scrape("75192", page)
            assert result is not None, "Expected a result, got None"
            assert result["product_id"] == "75192"
            assert "current_price" in result
            assert isinstance(result["current_price"], (int, float))
            assert result["current_price"] > 0
        finally:
            await browser.close()

@pytest.mark.asyncio
async def test_price_only_strategy():
    strategy = PriceOnlyScrapeStrategy()
    async with async_playwright() as p:
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
        
        try:
            # We use another well-known set ID, e.g., 42115 (Lamborghini)
            result = await strategy.scrape("42115", page)
            assert result is not None, "Expected a result, got None"
            assert result["product_id"] == "42115"
            assert "current_price" in result
            assert isinstance(result["current_price"], (int, float))
            assert result["current_price"] > 0
        finally:
            await browser.close()

@pytest.mark.asyncio
async def test_invalid_set_id():
    strategy = PriceOnlyScrapeStrategy()
    async with async_playwright() as p:
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
        
        try:
            # An ID that likely doesn't exist
            result = await strategy.scrape("999999999", page)
            assert result is None, "Expected None for invalid set, got a result"
        finally:
            await browser.close()
