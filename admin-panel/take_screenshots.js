const { chromium } = require('playwright');
const { mkdirSync, existsSync } = require('fs');

const OUT = 'C:/tmp/screenshots';
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto('http://localhost:3000/login');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${OUT}/00_login.png`, fullPage: true });
  console.log('Login captured');

  try {
    await page.locator('input[type="email"]').fill('admin@legomarkal.com');
    await page.locator('input[type="password"]').fill('admin123');
    await Promise.all([
      page.waitForNavigation({ timeout: 6000 }).catch(() => {}),
      page.locator('button[type="submit"]').click(),
    ]);
    await page.waitForTimeout(2500);
  } catch(e) { console.log('Login:', e.message); }

  console.log('URL after login:', page.url());
  await page.screenshot({ path: `${OUT}/01_after_login.png`, fullPage: true });

  await page.goto('http://localhost:3000/dashboard');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/02_dashboard.png`, fullPage: true });
  console.log('Dashboard captured');

  await page.goto('http://localhost:3000/inventory');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/03_inventory.png`, fullPage: true });
  console.log('Inventory captured');

  await page.goto('http://localhost:3000/prices');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/04_prices.png`, fullPage: true });
  console.log('Prices captured');

  await browser.close();
})();
