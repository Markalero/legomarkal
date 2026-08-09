import os
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
from price_utils import extract_brickeconomy_data
import urllib.request
from bs4 import BeautifulSoup

url = 'https://www.brickeconomy.com/set/75337-1/'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    html = urllib.request.urlopen(req).read().decode('utf-8')
    print("Downloaded HTML.")
    
    # Let's print what rows it's finding
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
except Exception as e:
    print("Error:", e)
