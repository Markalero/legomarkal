import asyncio
from playwright.async_api import async_playwright
async def test():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto('https://www.brickeconomy.com/set/10221-1/')
        content = await page.content()
        with open('brick_retired.html', 'w', encoding='utf-8') as f:
            f.write(content)
        await browser.close()
asyncio.run(test())
