import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
const url = page.url();
const title = await page.title();
const bodyText = await page.locator('body').innerText().catch(() => 'err');
console.log('URL:', url);
console.log('Title:', title);
console.log('Body snippet:', bodyText.slice(0, 300));
const inputs = await page.locator('input').count();
console.log('Inputs found:', inputs);
await page.screenshot({ path: '../docs/debug_login.png' });
await browser.close();
