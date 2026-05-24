import asyncio
from playwright.async_api import async_playwright

async def test_scrape():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        try:
            await page.goto("https://www.brickeconomy.com/set/75192-1/", wait_until="domcontentloaded")
            
            # Wait a little bit for cloudflare check
            await asyncio.sleep(2)
            
            title = await page.title()
            print("Title:", title)
            
            # Find the h1
            h1 = await page.locator("h1").first.text_content()
            print("H1:", h1)
            
            # Find the main image
            # Usually in BrickEconomy the main image is inside a specific div or has a specific class
            img_element = await page.locator("img.img-responsive").first.get_attribute("src")
            print("Image:", img_element)
            
        except Exception as e:
            print("Error:", e)
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(test_scrape())
