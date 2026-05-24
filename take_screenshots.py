import asyncio
from playwright.async_api import async_playwright
import os

ARTIFACTS_DIR = "C:\\Users\\Ander\\.gemini\\antigravity-ide\\brain\\53850e5d-3830-4691-af12-28a753d8c05c"

async def main():
    print("Launching browser...")
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        page.set_default_timeout(15000)
        
        print("Taking Dashboard screenshot...")
        await page.goto("http://localhost:3000")
        await asyncio.sleep(2) # Allow animations to settle
        await page.screenshot(path=os.path.join(ARTIFACTS_DIR, "dashboard.png"), full_page=True)
        
        print("Taking Inventory screenshot...")
        await page.goto("http://localhost:3000/inventory")
        await asyncio.sleep(2)
        await page.screenshot(path=os.path.join(ARTIFACTS_DIR, "inventory.png"), full_page=True)
        
        await browser.close()
    print("Done!")

if __name__ == "__main__":
    asyncio.run(main())
