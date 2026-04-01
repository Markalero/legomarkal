const { chromium } = require('playwright');
const { mkdirSync, existsSync } = require('fs');

const OUT = 'C:/tmp/screenshots';
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJtYXJrYWxhbGFkcmVuQGdtYWlsLmNvbSIsImV4cCI6MTc3NTEzNDU3Nn0.HKNVn9cp8I76bLwbcHYE-GVeM918zp4hSe4tTlq0_IY';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // First visit the site to establish origin, then set localStorage
  await page.goto('http://localhost:3000/login');
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate((token) => {
    localStorage.setItem('lm_token', token);
  }, TOKEN);
  console.log('Token set. Navigating to dashboard...');

  // Dashboard
  await page.goto('http://localhost:3000/dashboard');
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/02_dashboard.png`, fullPage: true });
  console.log('Dashboard captured. URL:', page.url());

  // Inventory
  await page.goto('http://localhost:3000/inventory');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/03_inventory.png`, fullPage: true });
  console.log('Inventory captured');

  // Prices
  await page.goto('http://localhost:3000/prices');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/04_prices.png`, fullPage: true });
  console.log('Prices captured');

  await browser.close();
})();
