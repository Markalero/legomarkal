import httpx
from bs4 import BeautifulSoup

def test_scrape():
    url = "https://www.brickeconomy.com/set/75192-1/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }
    with httpx.Client(follow_redirects=True) as client:
        r = client.get(url, headers=headers)
        print("Status:", r.status_code)
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, 'html.parser')
            title = soup.find('h1')
            print("Title:", title.text.strip() if title else "No title")
            
            # Find image
            img = soup.find('img')
            if img:
                print("Image:", img.get('src'))

if __name__ == "__main__":
    test_scrape()
