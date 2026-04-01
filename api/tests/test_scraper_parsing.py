# Tests unitarios de parsing de precios para scrapers (normalización de moneda y decimales)
from decimal import Decimal

from bs4 import BeautifulSoup

from app.scraper.base_scraper import BaseScraper
from app.scraper.brickeconomy_scraper import BrickEconomyScraper
from app.scraper.bricklink_scraper import BrickLinkScraper
from app.scraper.ebay_scraper import EbayScraper


class TestPriceTokenNormalization:
    """Valida la conversión robusta de tokens numéricos con formato local mixto."""

    def test_normaliza_formato_europeo(self):
        assert BaseScraper._normalize_numeric_token("1.234,56") == Decimal("1234.56")

    def test_normaliza_formato_internacional(self):
        assert BaseScraper._normalize_numeric_token("1,234.56") == Decimal("1234.56")

    def test_rechaza_ceros_o_no_numericos(self):
        assert BaseScraper._normalize_numeric_token("0") is None
        assert BaseScraper._normalize_numeric_token("n/a") is None


class TestCurrencyExtraction:
    """Comprueba extracción con símbolo/código de moneda antes y después del importe."""

    def test_extrae_simbolo_antes(self):
        values = BaseScraper.extract_currency_amounts("Avg: EUR 499.99 | Min: € 420,00")
        assert values == [Decimal("499.99"), Decimal("420.00")]

    def test_extrae_simbolo_despues(self):
        values = BaseScraper.extract_currency_amounts("Precio vendido: 389,50 €")
        assert values == [Decimal("389.50")]

    def test_extrae_codigo_moneda_generico(self):
      values = BaseScraper.extract_currency_amounts("Avg Price: ROL 2,975.92")
      assert values == [Decimal("2975.92")]


class TestScraperParsers:
    """Valida que cada parser aprovecha la normalización común de importes."""

    def test_bricklink_parsea_avg_price(self):
        scraper = object.__new__(BrickLinkScraper)
        html = """
        <html><body>
          <table id='price-guide'>
            <tr><td>New Avg Price</td><td>US $ 512.40</td></tr>
            <tr><td>Used Avg Price</td><td>€ 401,15</td></tr>
          </table>
        </body></html>
        """

        data = scraper._parse(html, "75192")
        assert data is not None
        assert data.price_new == Decimal("471.41")
        assert data.price_used == Decimal("401.15")

    def test_brickeconomy_parsea_min_max(self):
        scraper = object.__new__(BrickEconomyScraper)
        html = """
        <html><body>
          Market value: EUR 620.00
          Last sale: 599,90 €
          Historic high: $ 715.20
        </body></html>
        """

        data = scraper._parse(html, "75192")
        assert data is not None
        assert data.min_price_new == Decimal("599.90")
        assert data.max_price_new == Decimal("715.20")

    def test_ebay_parsea_y_promedia(self):
        scraper = object.__new__(EbayScraper)
        html = """
        <html><body>
          <span class='s-item__price'>EUR 400.00</span>
          <span class='s-item__price'>399,99 €</span>
          <span class='s-item__price'>US $ 420.10</span>
        </body></html>
        """

        data = scraper._parse(html, "75192")
        assert data is not None
        assert data.min_price_new == Decimal("399.99")
        assert data.max_price_new == Decimal("420.10")
        assert data.price_used == Decimal("406.70")

    def test_bricklink_price_guide_fallback_solo_rol_retorna_none(self):
        scraper = object.__new__(BrickLinkScraper)
        html = """
        <html><body>
          <tr>
            <td>Last 6 Months Sales:</td>
            <td>Current Items for Sale:</td>
            <td>New</td><td>Used</td><td>New</td><td>Used</td>
          </tr>
          <tr bgcolor="#C0C0C0">
            <td>
              Times Sold: 58
              Avg Price: ROL 2,975.92
            </td>
            <td>
              Times Sold: 23
              Avg Price: ROL 2,415.36
            </td>
            <td>Avg Price: ROL 5,102.48</td>
            <td>Avg Price: ROL 2,977.43</td>
          </tr>
        </body></html>
        """

        data = scraper._parse_price_guide(html, "75192")
        assert data is None

    def test_bricklink_extrae_nombre_desde_h1_o_title(self):
        scraper = object.__new__(BrickLinkScraper)
        html = """
        <html>
          <head><title>Millennium Falcon : Set 7965-1 | BrickLink</title></head>
          <body><h1>Millennium Falcon</h1></body>
        </html>
        """

        soup = BeautifulSoup(html, "lxml")
        name = scraper._extract_set_name(soup)
        assert name == "Millennium Falcon"

    def test_bricklink_prioriza_eur_en_avg_price(self):
        scraper = object.__new__(BrickLinkScraper)
        html = """
        <html><body>
          <tr>
            <td>Avg Price: ROL 2,975.92 Avg Price: EUR 615.20</td>
            <td>Avg Price: ROL 2,415.36 Avg Price: EUR 475.71</td>
            <td>Avg Price: EUR 701.00</td>
            <td>Avg Price: EUR 520.10</td>
          </tr>
        </body></html>
        """

        soup = BeautifulSoup(html, "lxml")
        cols = soup.find_all("td")
        new_value, new_currency = scraper._extract_avg_price_from_cell(cols[0])
        used_value, used_currency = scraper._extract_avg_price_from_cell(cols[1])

        assert new_value == Decimal("615.20")
        assert used_value == Decimal("475.71")
        assert new_currency == "EUR"
        assert used_currency == "EUR"

    def test_bricklink_avg_price_usa_dataset_eur_usd(self):
        scraper = object.__new__(BrickLinkScraper)

        # EUR 100.00 y USD 110.00 (-> EUR 101.20 con 0.92), media => 100.60
        value, currency = scraper._extract_preferred_price_from_text(
            "Avg Price: EUR 100.00 Avg Price: USD 110.00"
        )

        assert value == Decimal("100.60")
        assert currency == "EUR"

    def test_bricklink_avg_price_ignora_ron(self):
        scraper = object.__new__(BrickLinkScraper)

        value, currency = scraper._extract_preferred_price_from_text(
            "Avg Price: RON 502.64"
        )

        assert value is None
        assert currency is None

    def test_bricklink_fallback_theme_year_y_imagen(self):
        scraper = object.__new__(BrickLinkScraper)
        html = """
        <html>
          <head><title>Millennium Falcon : Set 7965-1 | BrickLink</title></head>
          <body>
            <tr>
              <td>
                Catalog : Sets : Star Wars : Star Wars Episode 4/5/6 : 7965-1
                Item Info Year Released: 2011 Weight: 2250g
              </td>
            </tr>
          </body>
        </html>
        """

        soup = BeautifulSoup(html, "lxml")
        assert scraper._extract_theme_from_breadcrumb(soup) == "Star Wars"
        assert scraper._extract_year_from_text(soup) == 2011
        assert scraper._build_default_image_url("7965-1") == "https://img.bricklink.com/ItemImage/SN/0/7965-1.png"
