import WMSCapabilities from 'ol/format/WMSCapabilities.js';
import WMTSCapabilities from 'ol/format/WMTSCapabilities.js';
import { normalizeCrs } from './projections';
import type { Choice, Protocol, ServiceInfo } from '../types';

export function cleanUrl(input: string): string {
  const url = new URL(input.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Zadejte veřejnou HTTP nebo HTTPS adresu služby bez přihlašovacích údajů.');
  if (url.hostname.endsWith('cuzk.cz') || url.hostname.endsWith('cuzk.gov.cz')) url.protocol = 'https:';
  for (const key of [...url.searchParams.keys()]) {
    if (['request', 'service', 'version', 'f'].includes(key.toLowerCase())) url.searchParams.delete(key);
  }
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

export function requestUrl(base: string, params: Record<string, string | number | boolean>) {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    for (const old of [...url.searchParams.keys()]) if (old.toLowerCase() === key.toLowerCase()) url.searchParams.delete(old);
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export async function fetchText(url: string, signal?: AbortSignal) {
  let response: Response;
  try {
    response = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000) });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('Služba neodpovídá nebo nepovoluje přístup z prohlížeče (CORS). Ověřte adresu a připojení.');
  }
  if (!response.ok) throw new Error(`Služba vrátila HTTP ${response.status}. Zkuste požadavek později.`);
  const text = await response.text();
  if (/<(?:\w+:)?(?:ExceptionReport|ServiceExceptionReport)\b/.test(text)) {
    const xml = new DOMParser().parseFromString(text, 'text/xml');
    // WFS can include a truncatedResponse/ExceptionReport after valid features.
    // Such a partial collection is useful; the loader reports the feature limit.
    if (['ExceptionReport', 'ServiceExceptionReport'].includes(xml.documentElement.localName)) {
      throw new Error(xml.documentElement.textContent?.trim().slice(0, 350) || 'Služba odmítla požadavek.');
    }
  }
  return text;
}

export async function fetchJson(url: string, signal?: AbortSignal) {
  const json = JSON.parse(await fetchText(url, signal));
  if (json.error) throw new Error(json.error.message || 'Chyba služby Esri.');
  return json;
}

export const elements = (root: Document | Element, name: string): Element[] => Array.from(root.getElementsByTagNameNS('*', name));
const direct = (root: Element, name: string) => Array.from(root.children).find((child) => child.localName === name)?.textContent?.trim() || '';
const cache = new Map<string, ServiceInfo>();

export async function discover(protocol: Protocol, input: string, signal?: AbortSignal): Promise<ServiceInfo> {
  const url = cleanUrl(input);
  const key = `${protocol}:${url}`;
  const cached = cache.get(key);
  if (cached) return cached;
  let info: ServiceInfo;
  if (protocol === 'Esri') {
    const raw = await fetchJson(requestUrl(url, { f: 'json' }), signal);
    if (!raw.spatialReference || !raw.layers) throw new Error('Zadejte kořenovou adresu služby Esri MapServer.');
    const crs = normalizeCrs(raw.spatialReference.latestWkid || raw.spatialReference.wkid);
    info = { protocol, url, title: raw.mapName || 'Esri MapServer', version: String(raw.currentVersion), raw, choices: raw.layers.filter((l: any) => !l.subLayerIds).map((l: any) => ({ name: String(l.id), title: l.name, crs: [crs], queryable: /Query|Data/i.test(raw.capabilities) })) };
  } else if (protocol === 'WMS') {
    const text = await fetchText(requestUrl(url, { SERVICE: 'WMS', REQUEST: 'GetCapabilities' }), signal);
    const raw = new WMSCapabilities().read(text);
    if (!raw?.Capability?.Layer) throw new Error('Adresa nevrací platný dokument WMS GetCapabilities.');
    // Preserve inheritance and explicit queryable="0"; some parsers default
    // missing queryable attributes to false before inheritance can be applied.
    const queryableByName = new Map<string, boolean>();
    const xml = new DOMParser().parseFromString(text, 'text/xml');
    const queryability = (node: Element, inherited: boolean) => {
      const value = node.hasAttribute('queryable') ? ['1', 'true'].includes(node.getAttribute('queryable')!) : inherited;
      const name = direct(node, 'Name');
      if (name) queryableByName.set(name, value);
      Array.from(node.children).filter((child) => child.localName === 'Layer').forEach((child) => queryability(child, value));
    };
    const rootLayer = elements(xml, 'Layer')[0];
    if (rootLayer) queryability(rootLayer, false);
    const choices: Choice[] = [];
    const walk = (layer: any, inherited: string[] = [], queryable = false) => {
      const crs = [...new Set<string>([...inherited, ...(layer.CRS || layer.SRS || [])])];
      const canQuery = queryableByName.get(layer.Name) ?? layer.queryable ?? queryable;
      if (layer.Name) choices.push({ name: layer.Name, title: layer.Title || layer.Name, crs, queryable: canQuery });
      layer.Layer?.forEach((l: any) => walk(l, crs, canQuery));
    };
    walk(raw.Capability.Layer);
    info = { protocol, url, title: raw.Service?.Title || 'WMS', choices, raw, version: raw.version || '1.3.0' };
  } else if (protocol === 'WMTS') {
    const endpoint = /\.xml($|\?)/i.test(url) ? url : requestUrl(url, { SERVICE: 'WMTS', REQUEST: 'GetCapabilities', VERSION: '1.0.0' });
    const raw = new WMTSCapabilities().read(await fetchText(endpoint, signal));
    if (!raw?.Contents?.Layer) throw new Error('Adresa nevrací platný dokument WMTS GetCapabilities.');
    raw.Contents.TileMatrixSet.forEach((s: any) => { s.SupportedCRS = normalizeCrs(s.SupportedCRS); });
    const choices = raw.Contents.Layer.map((l: any) => ({ name: l.Identifier, title: l.Title || l.Identifier, queryable: false, crs: l.TileMatrixSetLink.map((link: any) => raw.Contents.TileMatrixSet.find((s: any) => s.Identifier === link.TileMatrixSet)?.SupportedCRS).filter(Boolean) }));
    info = { protocol, url, title: raw.ServiceIdentification?.Title || 'WMTS', choices, raw, version: '1.0.0' };
  } else {
    const text = await fetchText(requestUrl(url, { SERVICE: 'WFS', REQUEST: 'GetCapabilities' }), signal);
    const xml = new DOMParser().parseFromString(text, 'text/xml');
    if (xml.getElementsByTagName('parsererror').length || !xml.documentElement.localName.includes('WFS_Capabilities')) throw new Error('Adresa nevrací platný dokument WFS GetCapabilities.');
    const choices = elements(xml, 'FeatureType').map((node) => ({ name: direct(node, 'Name'), title: direct(node, 'Title') || direct(node, 'Name'), queryable: true, crs: Array.from(node.children).filter((n) => ['DefaultCRS', 'OtherCRS', 'DefaultSRS', 'OtherSRS', 'SRS'].includes(n.localName)).map((n) => n.textContent!.trim()) }));
    const formats = [...elements(xml, 'OutputFormats').flatMap((el) => elements(el, 'Format').map((e) => e.textContent!.trim())), ...elements(xml, 'Parameter').filter((p) => p.getAttribute('name') === 'outputFormat').flatMap((p) => elements(p, 'Value').map((e) => e.textContent!.trim()))];
    const namespaces: Record<string, string> = {};
    for (const node of elements(xml, 'FeatureType')) { const prefix = direct(node, 'Name').split(':')[0]; namespaces[prefix] = node.lookupNamespaceURI(prefix) || ''; }
    info = { protocol, url, title: elements(xml, 'Title')[0]?.textContent?.trim() || 'WFS', choices, version: xml.documentElement.getAttribute('version') || '2.0.0', raw: { formats, namespaces } };
  }
  if (!info.choices.length) throw new Error('Služba nenabízí žádné dostupné vrstvy.');
  cache.set(key, info);
  return info;
}
