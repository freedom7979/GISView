import { chromium } from '@playwright/test';
console.log('Starting browser');
const browser = await chromium.launch({ headless: true, timeout: 20000 });
console.log('Browser ready');
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('pageerror', (error) => console.log('PAGE ERROR', error.message));
page.on('console', (msg) => { if (msg.type() === 'error') console.log('CONSOLE ERROR', msg.text()); });
page.on('requestfailed', (req) => console.log('REQUEST FAILED', req.url(), req.failure()?.errorText));
try {
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.getByText('Mapa je připravena', { exact: true }).waitFor({ timeout: 35000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'artifacts/desktop-initial.png', fullPage: true });
  console.log((await page.locator('body').innerText()).slice(0, 6500));
  console.log('canvases', await page.locator('canvas').count());
} finally { await browser.close(); }
