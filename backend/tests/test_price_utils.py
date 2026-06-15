from price_utils import extract_brickeconomy_prices, normalize_price_number


def test_normalize_price_number_supports_es_and_en_formats():
    assert normalize_price_number("131,99 €") == 131.99
    assert normalize_price_number("1.234,56 €") == 1234.56
    assert normalize_price_number("1,234.56 €") == 1234.56


def test_extract_brickeconomy_prices_prefers_new_sealed_value():
    html = """
    <html>
      <body>
        <div class="row"><div>Retail price</div><div>€99,99</div></div>
        <div class="row"><div>Value</div><div>abierto €89,99</div></div>
        <section>
          <h3>Nuevo/Sellado</h3>
          <p>Valor 131,99 €</p>
        </section>
      </body>
    </html>
    """

    retail_price, current_price = extract_brickeconomy_prices(html)

    assert retail_price == 99.99
    assert current_price == 131.99