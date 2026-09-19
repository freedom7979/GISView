import { expect, test, type Page } from '@playwright/test';

async function ready(page: Page) {
  await page.goto('/?x=-743278.9625297&y=-1042840.64667544&r=2&crs=EPSG%3A5514');
  await expect(page.getByText('Mapa je připravena', { exact: true })).toBeVisible();
  await expect(page.getByText('Připojuji vrstvy', { exact: true })).toHaveCount(0);
}
async function catalog(page: Page) { await page.getByRole('button', { name: 'Katalog dat' }).click(); }

test('živé Ortofoto, Esri Identify, krytí a uložená kompozice', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  await expect(page.locator('.sidebar-footer')).toContainText('EPSG:5514');
  await expect(page.locator('.map-canvas canvas')).toBeVisible();
  const identified = page.waitForResponse((r) => r.url().includes('/RUIAN/MapServer/identify'));
  await page.locator('.map-canvas').click({ position: { x: 610, y: 430 } });
  const response = await identified;
  expect(response.ok()).toBeTruthy();
  const result = await response.json(); expect(result.results.length).toBeGreaterThan(0);
  await expect(page.getByRole('heading', { name: 'Vlastnosti prvku' })).toBeVisible();
  await expect(page.locator('.properties')).toContainText('Číslo parcely');
  await page.screenshot({ path: 'artifacts/desktop-selection.png', fullPage: true });
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'JSON', exact: true }).click();
  expect((await downloadEvent).suggestedFilename()).toBe('gisview-vlastnosti.json');
  await page.getByRole('button', { name: 'Zavřít vlastnosti' }).click();
  await page.getByLabel('Krytí vrstvy').fill('45');
  await expect(page.getByText('45 %')).toBeVisible();
  await page.getByRole('button', { name: 'Skrýt Parcely · RÚIAN' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Zobrazit Parcely · RÚIAN' })).toBeVisible();
  await expect(page.getByText('45 %')).toBeVisible();
  expect(errors).toEqual([]);
});

test('změna podkladu, katalog WMTS a WMS v JTSK', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  await page.getByRole('button', { name: 'Topografická', exact: true }).click();
  await expect(page.locator('.basemap-bottom h2')).toHaveText('Základní topografická mapa');
  await catalog(page);
  await page.getByRole('button', { name: 'WMTS', exact: true }).click();
  await page.getByRole('button', { name: 'Přidat Ortofoto ČR · WMTS', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Přidat Ortofoto ČR · WMTS', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'WMS', exact: true }).click();
  await page.getByRole('button', { name: 'Přidat Katastrální mapa', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Přidat Katastrální mapa', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Zavřít dialog' }).click();
  await expect(page.locator('.basemap-bottom h2')).toHaveText('Ortofoto ČR · WMTS');
  await expect(page.locator('.layers-list')).toContainText('Katastrální mapa');
  await expect(page.locator('.sidebar-footer')).toContainText('EPSG:5514');
  await page.screenshot({ path: 'artifacts/wmts-wms.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('živé adresní body RSO z ČSÚ se načtou jako vektorová vrstva', async ({ page }) => {
  await ready(page);
  await catalog(page);
  await page.getByRole('button', { name: 'Esri', exact: true }).click();
  const layer = page.getByRole('button', { name: 'Přidat Adresní body · ČSÚ RSO', exact: true });
  await expect(layer).toBeVisible();
  const response = page.waitForResponse((r) => r.url().includes('/Open_data_RSO/FeatureServer/1/query') && new URL(r.url()).searchParams.get('f') === 'geojson');
  await layer.click();
  await expect(layer).toBeDisabled();
  await page.getByRole('button', { name: 'Zavřít dialog' }).click();
  expect((await response).ok()).toBeTruthy();
  await expect(page.locator('.layers-list')).toContainText('Adresní body · ČSÚ RSO');
  await expect(page.locator('.layer-notice')).toContainText(/adresních bodů ČSÚ/);
});

test('živé WFS GML parcely se načtou a lze je vybrat', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  await page.getByRole('button', { name: 'Skrýt Parcely · RÚIAN' }).click();
  const search = page.getByRole('textbox', { name: 'Hledat město nebo souřadnice' });
  await search.fill('14.4207, 50.087'); await search.press('Enter');
  await expect(page.locator('.map-live-badge')).toContainText('Živá data');
  await page.getByRole('button', { name: 'Přiblížit mapu', exact: true }).click();
  await expect(page.locator('.status-scale')).not.toContainText('7 131');
  await page.getByRole('button', { name: 'Přiblížit mapu', exact: true }).click();
  await catalog(page);
  await page.getByRole('button', { name: 'WFS', exact: true }).click();
  const wfsResponse = page.waitForResponse((r) => r.url().includes('REQUEST=GetFeature') && r.url().includes('SERVICE=WFS'));
  await page.getByRole('button', { name: 'Přidat Parcely · INSPIRE', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Přidat Parcely · INSPIRE', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Zavřít dialog' }).click();
  expect((await wfsResponse).ok()).toBeTruthy();
  await expect(page.locator('.layer-notice').filter({ hasText: /^\d[\d\s\u00a0]* vektorových prvků|Zobrazeno prvních/ })).toBeVisible();
  const notice = await page.locator('.layer-notice').allTextContents();
  expect(notice.join(' ')).not.toMatch(/^0 vektorových/);
  await page.locator('.map-canvas').click({ position: { x: 530, y: 450 } });
  await expect(page.getByRole('heading', { name: 'Vlastnosti prvku' })).toBeVisible();
  await expect(page.locator('.feature-selector')).toContainText('Parcely · INSPIRE');
  await expect(page.locator('.properties')).toContainText('nationalCadastralReference');
  await expect(page.locator('.properties')).not.toContainText('disposed');
  await page.screenshot({ path: 'artifacts/wfs-selection.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('vlastní služba a změna EPSG podle podkladu', async ({ page }) => {
  await ready(page);
  await catalog(page);
  await page.getByRole('button', { name: 'Vlastní služba' }).click();
  await page.getByLabel('Adresa služby').fill('https://ags.cuzk.gov.cz/arcgis1/rest/services/ORTOFOTO_WM/MapServer');
  await page.getByRole('button', { name: 'Načíst nabídku vrstev' }).click();
  await expect(page.getByText('Služba je dostupná', { exact: true })).toBeVisible();
  await page.getByLabel('Použít jako').selectOption('base');
  await page.getByRole('button', { name: 'Připojit vrstvu', exact: true }).click();
  await expect(page.locator('.layer-dialog')).toHaveCount(0);
  await expect(page.locator('.sidebar-footer')).toContainText('EPSG:3857');
  await expect(page.locator('.layer-title')).toContainText('EPSG:3857');
  const image = page.waitForResponse((r) => r.url().includes('/RUIAN/MapServer/export') && new URL(r.url()).searchParams.get('imageSR') === '3857');
  await page.getByRole('button', { name: 'Přiblížit mapu', exact: true }).click();
  expect((await image).ok()).toBeTruthy();
});

test('WMS GetFeatureInfo vrátí vlastnosti skutečné parcely', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'Skrýt Parcely · RÚIAN' }).click();
  await catalog(page);
  await page.getByRole('button', { name: 'Vlastní služba' }).click();
  await page.getByLabel('Typ služby').selectOption('WMS');
  await page.getByLabel('Adresa služby').fill('https://ags.cuzk.gov.cz/arcgis/services/RUIAN/MapServer/WMSServer');
  await page.getByRole('button', { name: 'Načíst nabídku vrstev' }).click();
  await expect(page.getByText('Služba je dostupná', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Vrstva', exact: true }).selectOption('Parcela');
  await page.getByRole('button', { name: 'Připojit vrstvu', exact: true }).click();
  await expect(page.locator('.layer-dialog')).toHaveCount(0);
  const info = page.waitForResponse((r) => r.url().includes('REQUEST=GetFeatureInfo'));
  await page.locator('.map-canvas').click({ position: { x: 610, y: 430 } });
  const response = await info; expect(response.ok()).toBeTruthy();
  await expect(page.getByRole('heading', { name: 'Vlastnosti prvku' })).toBeVisible();
  await expect(page.locator('.feature-selector')).toContainText('Parcela');
  await expect(page.locator('.properties')).toContainText(/cisloparcely|Číslo parcely/);
});

test('mobilní rozhraní, hledání a dialog bez vodorovného přetečení', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await expect(page.locator('.sidebar')).toBeHidden();
  const search = page.getByRole('textbox', { name: 'Hledat město nebo souřadnice' });
  await search.fill('Brno'); await search.press('Enter');
  await expect(search).toHaveValue('Brno');
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLCanvasElement>('.map-canvas canvas')].some((canvas) => {
    const context = canvas.getContext('2d');
    return context && context.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data[3] > 0;
  }));
  await page.screenshot({ path: 'artifacts/mobile-map.png', fullPage: true });
  await page.getByRole('button', { name: 'Vrstvy', exact: true }).click();
  await expect(page.locator('.sidebar')).toBeVisible();
  await page.getByRole('button', { name: 'Přidat vrstvu WMS, WMTS, WFS, Esri' }).click();
  await expect(page.getByRole('heading', { name: 'Přidat vrstvu' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/mobile-catalog.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
