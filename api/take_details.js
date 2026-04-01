const { chromium } = require('playwright');
const { mkdirSync, existsSync } = require('fs');

const OUT = 'C:/tmp/screenshots';
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJtYXJrYWxhbGFkcmVuQGdtYWlsLmNvbSIsImV4cCI6MTc3NTEzNDU3Nn0.HKNVn9cp8I76bLwbcHYE-GVeM918zp4hSe4tTlq0_IY';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto('http://localhost:3000/login');
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate((token) => localStorage.setItem('lm_token', token), TOKEN);

  // Inventory - scroll to bottom to see Millennium Falcon (sold)
  await page.goto('http://localhost:3000/inventory');
  await page.waitForTimeout(3000);
  // Scroll to bottom
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/08_inventory_bottom.png`, fullPage: false });
  console.log('Inventory bottom captured');

  // Prices - scroll down to see table detail
  await page.goto('http://localhost:3000/prices');
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.scrollTo(0, 500)); // scroll past chart
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/09_prices_table.png`, fullPage: false });
  console.log('Prices table captured');

  // Product detail page - find a specific product ID
  // First get product list to find an ID
  await page.goto('http://localhost:3000/inventory');
  await page.waitForTimeout(2000);
  // Click first product row link
  const firstLink = page.locator('table tbody tr td a, table tbody tr a').first();
  const href = await firstLink.getAttribute('href').catch(() => null);
  console.log('First product href:', href);
  if (href) {
    await page.goto('http://localhost:3000' + href);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${OUT}/10_product_detail.png`, fullPage: true });
    console.log('Product detail captured');
  }

  await browser.close();
})();
