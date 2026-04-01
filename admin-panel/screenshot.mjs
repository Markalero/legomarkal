import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const SHOTS = '../docs';
const EMAIL = 'markalaladren@gmail.com';
const PASS  = 'markaleroputero69';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on('response', r => { if(r.status() >= 400 && !r.url().includes('_next')) console.log('HTTP err:', r.status(), r.url()); });
await page.setViewportSize({ width: 1400, height: 900 });

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
const inputs = page.locator('input');
await inputs.nth(0).fill(EMAIL);
await inputs.nth(1).fill(PASS);
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/dashboard`, { timeout: 20000 });
// Esperar que carguen todos los datos del dashboard
await page.waitForResponse(r => r.url().includes('/dashboard/summary'), { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(4000);
await page.screenshot({ path: `${SHOTS}/screen_dashboard.png` });
console.log('ok dashboard');

await page.goto(`${BASE}/inventory`, { waitUntil: 'networkidle' });
await page.waitForResponse(r => r.url().includes('/products'), { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(2000);
await page.screenshot({ path: `${SHOTS}/screen_inventory.png` });
console.log('ok inventory');

await page.goto(`${BASE}/prices`, { waitUntil: 'networkidle' });
await page.waitForResponse(r => r.url().includes('/dashboard/price-insights'), { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(3000);
await page.screenshot({ path: `${SHOTS}/screen_prices.png` });
console.log('ok prices');

await browser.close();
console.log('done');
