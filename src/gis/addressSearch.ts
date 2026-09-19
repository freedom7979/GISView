const ADDRESS_SERVICE = 'https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE/tables/1';

export interface AddressSuggestion {
  text: string;
  magicKey: string;
}

export interface AddressLocation {
  name: string;
  coordinates: [number, number];
  magicKey: string;
}

export interface CoordinateQuery {
  lonLat: [number, number];
  format: 'decimal' | 'hemisphere';
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' ? value as JsonRecord : null;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numberValue(value: string): number {
  return Number(value.replace(',', '.'));
}

function inRange(lon: number, lat: number): boolean {
  return Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90;
}

/** Parse WGS 84 as longitude, latitude or latitude/longitude with hemispheres. */
export function parseCoordinateQuery(value: string): CoordinateQuery | null {
  const input = value.trim();
  const number = '[+-]?\\d+(?:[.,]\\d+)?';
  const hemisphere = new RegExp(`^(${number})\\s*°?\\s*([NSEW])\\s*[,;]\\s*(${number})\\s*°?\\s*([NSEW])$`, 'i').exec(input);
  if (hemisphere) {
    const first = numberValue(hemisphere[1]);
    const second = numberValue(hemisphere[3]);
    const firstDirection = hemisphere[2].toUpperCase();
    const secondDirection = hemisphere[4].toUpperCase();
    const firstIsLatitude = firstDirection === 'N' || firstDirection === 'S';
    const secondIsLatitude = secondDirection === 'N' || secondDirection === 'S';
    if (firstIsLatitude === secondIsLatitude) return null;
    const latitudeValue = firstIsLatitude ? first : second;
    const longitudeValue = firstIsLatitude ? second : first;
    const latitudeDirection = firstIsLatitude ? firstDirection : secondDirection;
    const longitudeDirection = firstIsLatitude ? secondDirection : firstDirection;
    const latitude = latitudeValue * (latitudeDirection === 'S' ? -1 : 1);
    const longitude = longitudeValue * (longitudeDirection === 'W' ? -1 : 1);
    return inRange(longitude, latitude) ? { lonLat: [longitude, latitude], format: 'hemisphere' } : null;
  }

  const decimal = new RegExp(`^(${number})\\s*[,;]\\s*(${number})$`).exec(input);
  if (!decimal) return null;
  const longitude = numberValue(decimal[1]);
  const latitude = numberValue(decimal[2]);
  return Math.abs(longitude) <= 180 && Math.abs(latitude) <= 90 ? { lonLat: [longitude, latitude], format: 'decimal' } : null;
}

async function requestJson(url: URL, signal?: AbortSignal): Promise<JsonRecord> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Služba adres ČÚZK odpověděla HTTP ${response.status}.`);
  const payload = asRecord(await response.json());
  if (!payload) throw new Error('Služba adres ČÚZK vrátila neočekávanou odpověď.');
  return payload;
}

export async function suggestAddresses(query: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  const url = new URL(`${ADDRESS_SERVICE}/suggest`);
  url.searchParams.set('text', query.trim());
  url.searchParams.set('location', '');
  url.searchParams.set('distance', '');
  url.searchParams.set('maxSuggestions', '8');
  url.searchParams.set('f', 'json');
  const payload = await requestJson(url, signal);
  if (!Array.isArray(payload.suggestions)) return [];
  return payload.suggestions.flatMap((item) => {
    const record = asRecord(item);
    const text = asText(record?.text);
    const magicKey = asText(record?.magicKey);
    return text && magicKey ? [{ text, magicKey }] : [];
  });
}

export async function resolveAddress(suggestion: AddressSuggestion, signal?: AbortSignal): Promise<AddressLocation> {
  const url = new URL(`${ADDRESS_SERVICE}/find`);
  url.searchParams.set('text', suggestion.text);
  url.searchParams.set('bbox', '');
  url.searchParams.set('location', '');
  url.searchParams.set('distance', '');
  url.searchParams.set('outSR', '4326');
  url.searchParams.set('outFields', '*');
  url.searchParams.set('maxLocations', '1');
  url.searchParams.set('magicKey', suggestion.magicKey);
  url.searchParams.set('f', 'json');
  const payload = await requestJson(url, signal);
  const locations = Array.isArray(payload.locations) ? payload.locations : [];
  const location = asRecord(locations[0]);
  const feature = asRecord(location?.feature);
  const geometry = asRecord(feature?.geometry);
  const longitude = typeof geometry?.x === 'number' ? geometry.x : Number(geometry?.x);
  const latitude = typeof geometry?.y === 'number' ? geometry.y : Number(geometry?.y);
  if (!location || !inRange(longitude, latitude)) throw new Error('Adresa nemá platné souřadnice WGS 84.');
  const attributes = asRecord(feature?.attributes);
  const name = asText(location.name) || asText(attributes?.Match_addr) || suggestion.text;
  return { name, coordinates: [longitude, latitude], magicKey: suggestion.magicKey };
}

export const addressServiceUrl = 'https://vdp.cuzk.gov.cz/vdp/ruian/overeniadresy';
