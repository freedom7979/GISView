import proj4 from 'proj4';
import { register } from 'ol/proj/proj4.js';
import { get } from 'ol/proj.js';

const jtsk = '+proj=krovak +lat_0=49.5 +lon_0=24.83333333333333 +alpha=30.28813975277778 +k=0.9999 +x_0=0 +y_0=0 +ellps=bessel +towgs84=589,76,480,0,0,0,0 +units=m +no_defs';
proj4.defs('EPSG:5514', jtsk);
proj4.defs('EPSG:102067', jtsk);
proj4.defs('EPSG:4258', '+proj=longlat +ellps=GRS80 +no_defs');
proj4.defs('EPSG:32633', '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs');
proj4.defs('EPSG:32634', '+proj=utm +zone=34 +datum=WGS84 +units=m +no_defs');
proj4.defs('EPSG:25833', '+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs');
register(proj4);
get('EPSG:5514')!.setExtent([-950000, -1300000, -350000, -850000]);

export function normalizeCrs(value: string | number): string {
  const text = String(value).trim();
  if (/CRS:?84$/i.test(text)) return 'EPSG:4326';
  const code = text.match(/(\d+)\s*$/)?.[1];
  if (!code) return text;
  if (code === '102067') return 'EPSG:5514';
  if (['102100', '102113', '900913'].includes(code)) return 'EPSG:3857';
  return `EPSG:${code}`;
}

export function requireProjection(crs: string) {
  const projection = get(normalizeCrs(crs));
  if (!projection) throw new Error(`Souřadnicový systém ${crs} zatím není zaregistrován. Přidejte jeho definici do src/gis/projections.ts.`);
  return projection;
}

export function pickCrs(values: string[], preferred?: string): string {
  const normalized = values.map(normalizeCrs);
  if (preferred) {
    if (!normalized.includes(preferred)) throw new Error(`Zdroj nepodporuje ${preferred}. Nabízí: ${[...new Set(normalized)].join(', ')}. Zvolte kompatibilní podklad.`);
    return preferred;
  }
  const selected = ['EPSG:5514', 'EPSG:3857', 'EPSG:4326', ...normalized].find((c) => normalized.includes(c) && get(c));
  if (!selected) throw new Error(`Žádný podporovaný souřadnicový systém: ${values.join(', ')}.`);
  return selected;
}

export function wfsBbox(extent: number[], crs: string, version: string, srsName: string): string {
  const axis = requireProjection(crs).getAxisOrientation();
  const swap = version !== '1.0.0' && axis.startsWith('ne') && !/CRS:?84$/i.test(srsName);
  const box = swap ? [extent[1], extent[0], extent[3], extent[2]] : extent;
  return [...box, srsName].join(',');
}
