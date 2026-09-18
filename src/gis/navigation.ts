import View from 'ol/View.js';
import { getPointResolution, transform } from 'ol/proj.js';
import { requireProjection } from './projections';

export const VIEW_STORAGE = 'gisview.view.v1';
export const COUNTRY_EXTENT = [12.08, 48.55, 18.87, 51.06];
export interface SavedView { center: number[]; crs: string; resolution: number; }

export function validView(value: unknown): value is SavedView {
  if (!value || typeof value !== 'object') return false;
  const v = value as SavedView;
  if (!Array.isArray(v.center) || v.center.length !== 2 || !v.center.every(Number.isFinite) || !Number.isFinite(v.resolution) || v.resolution <= 0 || v.resolution > 1e7 || typeof v.crs !== 'string') return false;
  try {
    const lonLat = transform(v.center, requireProjection(v.crs), 'EPSG:4326');
    return lonLat.every(Number.isFinite) && Math.abs(lonLat[0]) <= 180 && Math.abs(lonLat[1]) <= 85;
  } catch { return false; }
}

export function initialNavigation() {
  const url = new URL(window.location.href);
  const linked = { center: [Number(url.searchParams.get('x')), Number(url.searchParams.get('y'))], resolution: Number(url.searchParams.get('r')), crs: url.searchParams.get('crs') || 'EPSG:5514' };
  if (['x', 'y', 'r'].every((key) => url.searchParams.has(key)) && validView(linked)) return { view: linked, source: 'link' as const };
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(VIEW_STORAGE) || 'null');
    if (validView(saved)) return { view: saved, source: 'saved' as const };
  } catch { /* Storage is optional. */ }
  return { view: { center: transform([15.45, 49.8], 'EPSG:4326', 'EPSG:5514'), crs: 'EPSG:5514', resolution: 750 }, source: 'country' as const };
}

export function createView(state: SavedView, targetCrs = state.crs) {
  const projection = requireProjection(targetCrs);
  const center = transform(state.center, requireProjection(state.crs), projection);
  const metersPerPixel = getPointResolution(state.crs, state.resolution, state.center, 'm');
  const metersPerUnit = getPointResolution(projection, 1, center, 'm');
  return new View({ projection, center, resolution: metersPerPixel / metersPerUnit, minResolution: .08 / (projection.getMetersPerUnit() || 1), maxResolution: 3000 / (projection.getMetersPerUnit() || 1) });
}

export function saveView(view: View) {
  const value = { center: view.getCenter(), crs: view.getProjection().getCode(), resolution: view.getResolution() };
  if (validView(value)) try { localStorage.setItem(VIEW_STORAGE, JSON.stringify(value)); } catch { /* optional */ }
}
