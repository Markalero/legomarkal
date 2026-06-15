from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from playwright.async_api import Page

class LegoScraperStrategy(ABC):
    """
    Abstract base class for all Lego scraping strategies.
    Enforces the implementation of the `scrape` method.
    """
    
    @abstractmethod
    async def scrape(self, product_id: str, page: Page) -> Optional[Dict[str, Any]]:
        """
        Scrapes data for a given Lego product ID.
        
        Args:
            product_id (str): The ID of the Lego set (e.g., '75192' or '75192-1').
            page (Page): An active Playwright Page instance to perform the scraping.
            
        Returns:
            Optional[Dict[str, Any]]: A dictionary containing scraped data, must include 
                                      at least 'product_id' and 'current_price' if successful.
                                      Should return None if the scrape fails or price is not found.
        """
        pass
