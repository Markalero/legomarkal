import re
from bs4 import BeautifulSoup
from backend.price_utils import normalize_price_number

def extract_brickeconomy_data(html: str):
    soup = BeautifulSoup(html, 'html.parser')
    
    retail_price = None
    market_price = None
    year_eol = None
    
    # Iterate over rowlists
    rowlists = soup.find_all('div', class_='rowlist')
    for row in rowlists:
        label_div = row.find('div', class_='col-xs-5')
        val_div = row.find('div', class_='col-xs-7')
        
        if not label_div or not val_div:
            continue
            
        label = label_div.get_text(" ", strip=True).lower()
        val = val_div.get_text(" ", strip=True)
        
        if "retail price" in label:
            retail_price = normalize_price_number(val)
        elif "market price" in label or "value" in label or "new/sealed" in label:
            # Sometime Value includes % changes, but normalize_price_number extracts the first float
            market_price = normalize_price_number(val)
        elif "availability" in label:
            if "retired" in val.lower():
                # Extract year if possible
                match = re.search(r"Retired\s*(?:\([a-zA-Z]+\s*(\d{4})\))?", val, flags=re.IGNORECASE)
                if match and match.group(1):
                    year_eol = f"Retired ({match.group(1)})"
                else:
                    year_eol = "Retired"
                    
    return retail_price, market_price, year_eol

print("75192:", extract_brickeconomy_data(open('75192.html', encoding='utf-8').read()))
print("10221:", extract_brickeconomy_data(open('10221.html', encoding='utf-8').read()))
