import { test, expect, type Page } from '@playwright/test';
import { transform } from 'ol/proj.js';
import '../../src/gis/projections';

const linkedView = '/?x=-743278.9625297&y=-1042840.64667544&r=2&crs=EPSG%3A5514';
async function ready(page: Page, url = linkedView) {
  await page.goto(url);
  await expect(page.getByText('Mapa je připravena', { exact: true })).toBeVisible();
  await expect(page.getByText('Připojuji vrstvy', { exact: true })).toHaveCount(0);
}
const view = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('gisview.view.v1')!));

test('kolečko zoomuje před prvním kliknutím a po použití hledání', async ({ page }) => {
  await ready(page);
  const box = (await page.locator('.map-canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  expect(await page.locator('.map-canvas').evaluate((el) => el === document.activeElement)).toBe(false);
  const start = await view(page);
  await page.mouse.wheel(0, -250);
  await expect.poll(async () => (await view(page)).resolution).toBeLessThan(start.resolution * .8);
  const near = await view(page);
  await page.mouse.wheel(0, 250);
  await expect.poll(async () => (await view(page)).resolution).toBeGreaterThan(near.resolution * 1.2);
  await page.getByRole('textbox', { name: 'Hledat město nebo souřadnice' }).focus();
  await page.getByRole('textbox', { name: 'Hledat město nebo souřadnice' }).press('Escape');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const before = await view(page);
  await page.mouse.wheel(0, -250);
  await expect.poll(async () => (await view(page)).resolution).toBeLessThan(before.resolution * .8);
});

test('první tah myší posouvá mapu všemi čtyřmi směry', async ({ page }) => {
  await ready(page);
  const box = (await page.locator('.map-canvas').boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  for (const [dx, dy] of [[90, 0], [-90, 0], [0, 90], [0, -90]]) {
    const before = await view(page);
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 15 }); await page.mouse.up();
    const axis = dx ? 0 : 1;
    await expect.poll(async () => Math.abs((await view(page)).center[axis] - before.center[axis])).toBeGreaterThan(40);
  }
});

test('tlačítka zoomují ihned a resize panelu nepřeruší ovládání', async ({ page }) => {
  await ready(page);
  const initial = await view(page);
  await page.getByRole('button', { name: 'Přiblížit mapu', exact: true }).click();
  await expect.poll(async () => (await view(page)).resolution).toBeCloseTo(initial.resolution / 2, 2);
  await page.getByRole('button', { name: 'Oddálit mapu', exact: true }).click();
  await expect.poll(async () => (await view(page)).resolution).toBeCloseTo(initial.resolution, 2);
  await page.getByRole('button', { name: 'Skrýt panel vrstev' }).click();
  const box = (await page.locator('.map-canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -250);
  await expect.poll(async () => (await view(page)).resolution).toBeLessThan(initial.resolution * .8);
});

test('široký viewport po sbalení panelu využije celou šířku mapy', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await ready(page);
  await page.getByRole('button', { name: 'Skrýt panel vrstev' }).click();
  await expect(page.locator('.sidebar')).toBeHidden();
  const sizes = await page.evaluate(() => {
    const workspace = document.querySelector('.workspace')!.getBoundingClientRect();
    const map = document.querySelector('.map-panel')!.getBoundingClientRect();
    return { workspace: workspace.width, map: map.width };
  });
  expect(sizes.map).toBeGreaterThan(sizes.workspace - 10);
});

test('grafitová je výchozí, barva se přepíná a přetrvá obnovení', async ({ page }) => {
  await ready(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'graphite');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'artifacts/desktop-graphite.png', fullPage: true });
  await page.getByRole('button', { name: 'Barevné téma', exact: true }).click();
  for (const [name, id] of [['Lesní', 'forest'], ['Oceánská', 'ocean'], ['Švestková', 'plum'], ['Písková', 'sand']]) {
    await page.getByRole('button', { name: new RegExp(name) }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', id);
  }
  await page.getByRole('button', { name: /Lesní/ }).click();
  await page.getByRole('button', { name: 'Zavřít výběr tématu' }).click();
  await page.screenshot({ path: 'artifacts/desktop-forest.png', fullPage: true });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'forest');
});

test('povolená poloha automaticky zobrazí skutečné okolí', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ longitude: 16.608, latitude: 49.195, accuracy: 25 });
  await ready(page, '/');
  await expect(page.getByText('Vaše poloha je označená', { exact: true })).toBeVisible();
  const expected = transform([16.608, 49.195], 'EPSG:4326', 'EPSG:5514');
  await expect.poll(async () => Math.hypot((await view(page)).center[0] - expected[0], (await view(page)).center[1] - expected[1])).toBeLessThan(1);
  await expect(page.locator('.location-context')).toContainText('25 m');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'artifacts/location-graphite.png', fullPage: true });
});

test('odmítnutá poloha ponechá uložený výřez a mapa není blokovaná', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gisview.view.v1', JSON.stringify({ center: [-743278.96, -1042840.64], crs: 'EPSG:5514', resolution: 2 }));
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (_success: unknown, failure: (e: unknown) => void) => failure({ code: 1 }) } });
  });
  await ready(page, '/');
  await expect(page.getByText('Poloha není povolena', { exact: true })).toBeVisible();
  expect((await view(page)).center[0]).toBeCloseTo(-743278.96, 1);
  await page.getByRole('button', { name: 'Přiblížit mapu', exact: true }).click();
  await expect.poll(async () => (await view(page)).resolution).toBeLessThan(1.1);
});

test('opožděná poloha nepřesune již ovládanou mapu', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (success: (p: unknown) => void) => {
      (window as any).deliverTestLocation = () => success({ coords: { longitude: 16.608, latitude: 49.195, accuracy: 30 } });
    } } });
  });
  await ready(page, '/');
  await expect(page.getByText('Hledám vaši polohu', { exact: true })).toBeVisible();
  const initial = await view(page);
  await page.getByRole('button', { name: 'Přiblížit mapu', exact: true }).click();
  await expect.poll(async () => (await view(page)).resolution).toBeLessThan(initial.resolution * .8);
  const before = await view(page);
  await page.evaluate(() => (window as any).deliverTestLocation());
  await expect(page.getByText('Vaše poloha je označená', { exact: true })).toBeVisible();
  expect((await view(page)).center).toEqual(before.center);
});

test('sdílený výřez má přednost před GPS', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ longitude: 16.608, latitude: 49.195, accuracy: 10 });
  await ready(page);
  await expect(page.locator('.location-context')).toContainText('Sdílený výřez');
  expect((await view(page)).center[0]).toBeCloseTo(-743278.9625297, 1);
});

test('vyhledá adresu RÚIAN a GPS s hemisférami', async ({ page }) => {
  await ready(page);
  const search = page.getByRole('textbox', { name: 'Hledat město nebo souřadnice' });
  await search.fill('Lidická 10');
  const address = page.getByRole('button', { name: /Lidická 10, 33021 Líně/ }).first();
  await expect(address).toBeVisible({ timeout: 20000 });
  await address.click();
  await expect(search).toHaveValue('Lidická 10, 33021 Líně');
  const addressCenter = transform([13.26029111982515, 49.69196522299213], 'EPSG:4326', 'EPSG:5514');
  await expect.poll(async () => Math.hypot((await view(page)).center[0] - addressCenter[0], (await view(page)).center[1] - addressCenter[1])).toBeLessThan(2);

  await search.fill('48.9510717N, 14.5156139E');
  await search.press('Enter');
  const gpsCenter = transform([14.5156139, 48.9510717], 'EPSG:4326', 'EPSG:5514');
  await expect.poll(async () => Math.hypot((await view(page)).center[0] - gpsCenter[0], (await view(page)).center[1] - gpsCenter[1])).toBeLessThan(2);
});
