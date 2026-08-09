import os
import sys

# Ensure backend modules are available
BACKEND_DIR = os.path.join(os.path.dirname(__file__), "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from price_utils import extract_brickeconomy_data

mock_html = """
<html>
  <body>
    <div class="rowlist">
      <div class="col-xs-5">Part value</div>
      <div class="col-xs-7">$174.98</div>
    </div>
    <div class="rowlist">
      <div class="col-xs-5">Retail price</div>
      <div class="col-xs-7">$139.99</div>
    </div>
    <div class="rowlist">
      <div class="col-xs-5">Value (New/Sealed)</div>
      <div class="col-xs-7">$153.98</div>
    </div>
    <div class="rowlist">
      <div class="col-xs-5">Used price</div>
      <div class="col-xs-7">$127.81</div>
    </div>
  </body>
</html>
"""

def test_extraction():
    data = extract_brickeconomy_data(mock_html)
    print("Extracted Data:", data)
    assert data["retail_price"] == 139.99
    assert data["current_price"] == 153.98
    assert data["used_price"] == 127.81
    print("Test passed! Part value was correctly ignored.")

if __name__ == "__main__":
    test_extraction()
