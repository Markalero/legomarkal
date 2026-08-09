"""Tests para price_utils.extract_brickeconomy_data — focalizados en la seccion Set Pricing."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from price_utils import extract_brickeconomy_data, normalize_price_number


# ─── HTML que simula la estructura real de BrickEconomy para el set 75337 ───
HTML_75337 = """
<html><body>
<!-- Otras secciones con rowlist que NO son Set Pricing -->
<div class="side-box mt-30">
  <div class="side-box-head"><h4>Set Details</h4></div>
  <div class="side-box-body">
    <div class="row rowlist"><div class="col-xs-5 text-muted">Theme</div><div class="col-xs-7">Star Wars</div></div>
    <div class="row rowlist"><div class="col-xs-5 text-muted">Year</div><div class="col-xs-7">2022</div></div>
    <div class="row rowlist"><div class="col-xs-5 text-muted">Pieces</div><div class="col-xs-7">1234</div></div>
  </div>
</div>

<!-- SECCION SET PRICING — esta es la que importa -->
<div id="ContentPlaceHolder1_PanelSetPricing" class="side-box mt-30 setpricing">
  <div class="side-box-head"><h4>Set Pricing</h4></div>
  <div class="side-box-body position-relative">
    <div class="row rowlist">
      <div class="col-xs-5 text-muted">Retail price</div>
      <div class="col-xs-7">&euro;139.99</div>
    </div>
    <div class="semibold bdr-b-l pb-2" style="margin: 20px 0px 6px 0px;">New/Sealed</div>
    <div class="row rowlist">
      <div class="col-xs-5 text-muted">Value</div>
      <div class="col-xs-7"><b>&euro;153.98</b></div>
    </div>
    <div class="row rowlist">
      <div class="col-xs-5 text-muted">Growth</div>
      <div class="col-xs-7"><span class="text-success">+10.0%</span></div>
    </div>
    <div class="row rowlist" id="premium_shortterm_growth">
      <div class="col-xs-5 text-muted">90-day change</div>
      <div class="col-xs-7">
        <span id="90daygrowthline"></span>
        <script>try{ createSparkline([120.88,125.00,130.50,145.20,160.00,174.98], 7, 16, '#00b94d', '90daygrowthline'); }catch(e){}</script>
      </div>
    </div>
    <div class="semibold bdr-b-l pb-2" style="margin: 20px 0px 6px 0px;">Used</div>
    <div class="row rowlist">
      <div class="col-xs-5 text-muted">Value</div>
      <div class="col-xs-7">&euro;127.81</div>
    </div>
    <div class="row rowlist">
      <div class="col-xs-5 text-muted">Range</div>
      <div class="col-xs-7">&euro;125.37 - &euro;142.24</div>
    </div>
  </div>
</div>

<!-- Seccion Set Predictions con "Value" que NO deberia capturarse -->
<div class="side-box mt-30">
  <div class="side-box-head"><h4>Set Predictions</h4></div>
  <div class="side-box-body">
    <div class="row rowlist">
      <div class="col-xs-5 text-muted">Value</div>
      <div class="col-xs-7">&euro;999.99</div>
    </div>
  </div>
</div>

<!-- Seccion con disponibilidad -->
<div class="side-box mt-30">
  <div class="side-box-body">
    <div class="row rowlist">
      <div class="col-xs-5 text-muted">Availability</div>
      <div class="col-xs-7">Retired (Dec 2024)</div>
    </div>
  </div>
</div>
</body></html>
"""


def test_75337_new_price():
    """El precio nuevo debe ser 153.98, NO 174.98 del sparkline."""
    data = extract_brickeconomy_data(HTML_75337)
    assert data["current_price"] == 153.98, f"Expected 153.98, got {data['current_price']}"


def test_75337_used_price():
    """El precio usado debe ser 127.81."""
    data = extract_brickeconomy_data(HTML_75337)
    assert data["used_price"] == 127.81, f"Expected 127.81, got {data['used_price']}"


def test_75337_retail_price():
    """El retail price debe ser 139.99."""
    data = extract_brickeconomy_data(HTML_75337)
    assert data["retail_price"] == 139.99, f"Expected 139.99, got {data['retail_price']}"


def test_75337_eol():
    """El estado EOL debe detectarse como Retired."""
    data = extract_brickeconomy_data(HTML_75337)
    assert data["year_eol"] is not None
    assert "Retired" in data["year_eol"]


def test_ignores_predictions_section():
    """No debe capturar el valor 999.99 de la seccion Set Predictions."""
    data = extract_brickeconomy_data(HTML_75337)
    assert data["current_price"] != 999.99
    assert data["used_price"] != 999.99


def test_sparkline_not_captured():
    """El valor 174.98 del sparkline JavaScript NO debe aparecer como precio."""
    data = extract_brickeconomy_data(HTML_75337)
    assert data["current_price"] != 174.98
    assert data["used_price"] != 174.98


# ─── HTML sin seccion setpricing (fallback) ───
HTML_FALLBACK = """
<html><body>
<div class="side-box mt-30">
  <div class="side-box-body">
    <div class="row rowlist">
      <div class="col-xs-5 text-muted">Retail price</div>
      <div class="col-xs-7">$99.99</div>
    </div>
    <div class="row rowlist">
      <div class="col-xs-5 text-muted">Market price</div>
      <div class="col-xs-7">$189.50</div>
    </div>
  </div>
</div>
</body></html>
"""


def test_fallback_market_price():
    """Sin seccion setpricing, el fallback debe capturar market price."""
    data = extract_brickeconomy_data(HTML_FALLBACK)
    assert data["current_price"] == 189.50
    assert data["retail_price"] == 99.99


# ─── HTML vacío ───
def test_empty_html():
    """Con HTML vacío no debe crashear."""
    data = extract_brickeconomy_data("<html><body></body></html>")
    assert data["current_price"] is None
    assert data["used_price"] is None
    assert data["retail_price"] is None
    assert data["year_eol"] is None


# ─── normalize_price_number ───
def test_normalize_euro():
    assert normalize_price_number("€153.98") == 153.98

def test_normalize_comma_decimal():
    assert normalize_price_number("€153,98") == 153.98

def test_normalize_thousands():
    assert normalize_price_number("€1.234,56") == 1234.56

def test_normalize_none():
    assert normalize_price_number(None) is None

def test_normalize_empty():
    assert normalize_price_number("") is None


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])