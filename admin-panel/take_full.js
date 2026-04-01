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

  // Dashboard - full page scroll
  await page.goto('http://localhost:3000/dashboard');
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/05_dashboard_full.png`, fullPage: true });
  console.log('Dashboard full captured');

  // Inventory - full
  await page.goto('http://localhost:3000/inventory');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/06_inventory_full.png`, fullPage: true });
  console.log('Inventory full captured');

  // Prices - full
  await page.goto('http://localhost:3000/prices');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/07_prices_full.png`, fullPage: true });
  console.log('Prices full captured');

  await browser.close();
})();
