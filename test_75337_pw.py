import asyncio
import os
import sys
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
from price_utils import extract_brickeconomy_data

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto('https://www.brickeconomy.com/set/75337-1/')
        await page.wait_for_timeout(2000)
        html = await page.content()
        await browser.close()
        
        soup = BeautifulSoup(html, "html.parser")
        rowlists = soup.find_all('div', class_='rowlist')
        print("Found", len(rowlists), "rows.")
        for row in rowlists:
            label_div = row.find('div', class_='col-xs-5')
            val_div = row.find('div', class_='col-xs-7')
            if label_div and val_div:
                label = label_div.get_text(" ", strip=True).lower()
                val = val_div.get_text(" ", strip=True)
                print(f"[{label}] -> [{val}]")
                
        print("Result of extract:", extract_brickeconomy_data(html))

asyncio.run(main())
