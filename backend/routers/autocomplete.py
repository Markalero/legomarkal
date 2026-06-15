import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from playwright.sync_api import sync_playwright

from price_utils import extract_brickeconomy_prices

router = APIRouter(
    prefix="/autocomplete",
    tags=["autocomplete"]
)

class AutocompleteResponse(BaseModel):
    product_id: str
    name: str
    theme: Optional[str] = None
    image_url: Optional[str] = None
    year_eol: Optional[str] = None
    retail_price: Optional[str] = None
    current_price: Optional[str] = None

@router.get("/{product_id}", response_model=AutocompleteResponse)
def get_set_info(product_id: str):
    set_num = product_id if "-" in product_id else f"{product_id}-1"
    url = f"https://www.brickeconomy.com/set/{set_num}/"
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()
        
        try:
            # Add stealth scripts
            page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            # Go to page and wait for content
            response = page.goto(url, wait_until="domcontentloaded", timeout=30000)
            
            if response and response.status == 404:
                raise HTTPException(status_code=404, detail="Set not found")
                
            # Random delay
            import time
            import random
            time.sleep(random.uniform(1.0, 2.5))
            
            # Wait for main content to avoid cloudflare
            page.wait_for_selector("div.container", timeout=15000)
            
            html_content = page.content()
            
            # Find the title
            title_text = page.title()
            
            # Usually the title is something like "LEGO 75192 Star Wars Millennium Falcon | BrickEconomy"
            name = title_text.replace(" | BrickEconomy", "")
            
            # Remove the "LEGO 75192 " prefix if it exists
            prefix_to_remove = f"LEGO {product_id} "
            if name.startswith(prefix_to_remove):
                name = name[len(prefix_to_remove):]
            elif name.startswith("LEGO "):
                name = name[5:]

            # Try to get the image
            # Wait for img with src containing 'lego'
            image_url = None
            theme_val = "N/A"
            year_eol_val = ""
            retail_price_val = ""

            try:
                # Get the page html
                html = page.content()
                from bs4 import BeautifulSoup
                soup = BeautifulSoup(html, 'html.parser')
                
                # Image
                imgs = soup.find_all('img')
                for img in imgs:
                    src = img.get('src', '')
                    if 'sets' in src and 'lego' in src:
                        image_url = src
                        break
                
                if image_url and image_url.startswith('/'):
                    image_url = "https://www.brickeconomy.com" + image_url

                # Metadata
                data_dict = {}
                for div in soup.find_all('div', class_='row'):
                    cols = div.find_all('div')
                    if len(cols) >= 2:
                        lbl = cols[0].get_text(strip=True)
                        val = cols[1].get_text(separator=' ', strip=True)
                        data_dict[lbl] = val

                theme = data_dict.get("Theme", "")
                subtheme = data_dict.get("Subtheme", "")
                if theme and subtheme:
                    theme_val = f"{theme} / {subtheme}"
                elif theme:
                    theme_val = theme
                
                year = data_dict.get("Year", "")
                retire = data_dict.get("Retirement", "")
                if retire:
                    year_eol_val = f"{year} | EOL: {retire}"
                else:
                    year_eol_val = year

                retail_price_num, current_price_num = extract_brickeconomy_prices(html)
                if retail_price_num is not None:
                    retail_price_val = f"{retail_price_num:.2f}"
                if current_price_num is not None:
                    current_price_val = f"{current_price_num:.2f}"

            except Exception as metadata_err:
                print("Could not parse metadata:", metadata_err)

            return AutocompleteResponse(
                product_id=product_id,
                name=name.strip(),
                theme=theme_val,
                image_url=image_url,
                year_eol=year_eol_val,
                retail_price=retail_price_val,
                current_price=current_price_val
            )
            
        except HTTPException as he:
            raise he
        except Exception as e:
            print("Scraping error:", e)
            raise HTTPException(status_code=500, detail="Error scraping data")
        finally:
            browser.close()
