const { chromium } = require('playwright');
const { mkdirSync, existsSync } = require('fs');

const OUT = 'C:/tmp/screenshots';
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJtYXJrYWxhbGFkcmVuQGdtYWlsLmNvbSIsImV4cCI6MTc3NTEzNDUwNX0.8ei_QRM_KVWgK7_NiA5Ah6tUMfbJWj6Fb6ME7GEBx4w';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  
  // Set auth token in localStorage before navigating
  const page = await context.newPage();
  await page.goto('http://localhost:3000');
  await page.evaluate((token) => {
    localStorage.setItem('token', token);
  }, TOKEN);
  
  // Dashboard
  await page.goto('http://localhost:3000/dashboard');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/02_dashboard.png`, fullPage: true });
  console.log('Dashboard captured. URL:', page.url());

  // Inventory
  await page.goto('http://localhost:3000/inventory');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/03_inventory.png`, fullPage: true });
  console.log('Inventory captured');

  // Prices
  await page.goto('http://localhost:3000/prices');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/04_prices.png`, fullPage: true });
  console.log('Prices captured');

  await browser.close();
})();
