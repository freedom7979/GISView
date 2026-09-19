// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { transform } from 'ol/proj.js';
import { normalizeCrs, pickCrs, wfsBbox } from '../src/gis/projections';
import { cleanUrl, discover, fetchText, requestUrl } from '../src/gis/services';
import { parseCoordinateQuery, resolveAddress, suggestAddresses } from '../src/gis/addressSearch';

afterEach(() => vi.unstubAllGlobals());
describe('souřadnicové systémy', () => {
  it('rozpozná Esri, OGC URN a URI varianty stejného CRS', () => {
    expect(normalizeCrs(102067)).toBe('EPSG:5514');
    expect(normalizeCrs('urn:ogc:def:crs:EPSG::5514')).toBe('EPSG:5514');
    expect(normalizeCrs('http://www.opengis.net/def/crs/EPSG/0/5514')).toBe('EPSG:5514');
    expect(normalizeCrs(102100)).toBe('EPSG:3857');
  });
  it('odmítne nekompatibilní vrstvu místo tichého změnění souřadnic', () => {
    expect(() => pickCrs(['EPSG:3857'], 'EPSG:5514')).toThrow('nepodporuje');
    expect(pickCrs(['EPSG:3857', 'EPSG:5514'])).toBe('EPSG:5514');
  });
  it('transformuje Prahu do očekávaného kvadrantu JTSK a zpět', () => {
    const point = transform([14.42, 50.09], 'EPSG:4326', 'EPSG:5514');
    expect(point[0]).toBeGreaterThan(-750000); expect(point[0]).toBeLessThan(-730000);
    expect(point[1]).toBeGreaterThan(-1050000); expect(point[1]).toBeLessThan(-1030000);
    const back = transform(point, 'EPSG:5514', 'EPSG:4326');
    expect(back[0]).toBeCloseTo(14.42, 6); expect(back[1]).toBeCloseTo(50.09, 6);
  });
  it('respektuje pořadí os WFS 2.0 i 1.0', () => {
    expect(wfsBbox([14, 49, 15, 50], 'EPSG:4326', '2.0.0', 'urn:ogc:def:crs:EPSG::4326')).toBe('49,14,50,15,urn:ogc:def:crs:EPSG::4326');
    expect(wfsBbox([14, 49, 15, 50], 'EPSG:4326', '1.0.0', 'EPSG:4326')).toBe('14,49,15,50,EPSG:4326');
    expect(wfsBbox([-750000, -1050000, -740000, -1040000], 'EPSG:5514', '2.0.0', 'EPSG:5514')).toBe('-750000,-1050000,-740000,-1040000,EPSG:5514');
  });
});
describe('připojení služeb', () => {
  it('přijme URL GetCapabilities a neponechá duplicitní parametry', () => {
    const base = cleanUrl('https://example.org/wms?service=WMS&request=GetCapabilities&version=1.3.0&key=public');
    const result = new URL(requestUrl(base, { SERVICE: 'WMS', REQUEST: 'GetMap' }));
    expect(result.searchParams.get('key')).toBe('public');
    expect(result.searchParams.get('REQUEST')).toBe('GetMap');
    expect(result.searchParams.has('request')).toBe(false);
    expect(() => cleanUrl('javascript:alert(1)')).toThrow();
  });
  it('dědí CRS a queryable z rodičovské WMS vrstvy', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(`<WMS_Capabilities xmlns="http://www.opengis.net/wms" version="1.3.0"><Service><Title>Test</Title></Service><Capability><Layer queryable="1"><Title>Root</Title><CRS>EPSG:5514</CRS><Layer><Name>parcels</Name><Title>Parcely</Title></Layer></Layer></Capability></WMS_Capabilities>`)));
    const info = await discover('WMS', 'https://example.org/inheritance');
    expect(info.choices[0]).toMatchObject({ name: 'parcels', crs: ['EPSG:5514'], queryable: true });
  });
  it('rozpozná WFS s namespace definovaným až u FeatureType', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(`<WFS_Capabilities xmlns="http://www.opengis.net/wfs/2.0" version="2.0.0"><FeatureTypeList><FeatureType xmlns:cp="http://inspire.ec.europa.eu/schemas/cp/4.0"><Name>cp:CadastralParcel</Name><Title>Parcely</Title><DefaultCRS>http://www.opengis.net/def/crs/EPSG/0/5514</DefaultCRS><OutputFormats><Format>application/gml+xml;version=3.2</Format></OutputFormats></FeatureType></FeatureTypeList></WFS_Capabilities>`)));
    const info = await discover('WFS', 'https://example.org/wfs-ns');
    expect(info.raw.namespaces.cp).toBe('http://inspire.ec.europa.eu/schemas/cp/4.0');
    expect(info.choices[0].crs[0]).toContain('5514');
  });
  it('zobrazí chybu služby i při HTTP 200 s OGC ExceptionReport', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<ows:ExceptionReport xmlns:ows="http://www.opengis.net/ows"><ows:Exception><ows:ExceptionText>Invalid CRS</ows:ExceptionText></ows:Exception></ows:ExceptionReport>')));
    await expect(fetchText('https://example.org/failure')).rejects.toThrow('Invalid CRS');
  });
  it('nezahodí částečnou WFS kolekci s oznámením o překročení limitu', async () => {
    const text = '<FeatureCollection><member>valid feature</member><truncatedResponse><ExceptionReport><ExceptionText>Response truncated</ExceptionText></ExceptionReport></truncatedResponse></FeatureCollection>';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(text)));
    await expect(fetchText('https://example.org/truncated')).resolves.toBe(text);
  });
});
describe('vyhledávání adres a souřadnic', () => {
  it('převede GPS s hemisférami ve tvaru šířka, délka na WGS 84 lon/lat', () => {
    expect(parseCoordinateQuery('48.9510717N, 14.5156139E')).toEqual({ lonLat: [14.5156139, 48.9510717], format: 'hemisphere' });
    expect(parseCoordinateQuery('48.9510717° N, 14.5156139° E')).toEqual({ lonLat: [14.5156139, 48.9510717], format: 'hemisphere' });
    expect(parseCoordinateQuery('14.5156139E, 48.9510717N')?.lonLat).toEqual([14.5156139, 48.9510717]);
  });
  it('zachová dosavadní pořadí desetinných souřadnic délka, šířka', () => {
    expect(parseCoordinateQuery('14.42, 50.09')).toEqual({ lonLat: [14.42, 50.09], format: 'decimal' });
    expect(parseCoordinateQuery('181, 50.09')).toBeNull();
  });
  it('načte našeptávač a souřadnice adresy z RÚIAN služby', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ suggestions: [{ text: 'Lidická 10, 33021 Líně', magicKey: '1424587' }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ locations: [{ name: 'Lidická 10, 33021 Líně', feature: { geometry: { x: 13.2602911198, y: 49.691965223 }, attributes: {} } }] })));
    vi.stubGlobal('fetch', fetchMock);
    const suggestions = await suggestAddresses('Lidická 10');
    expect(suggestions).toEqual([{ text: 'Lidická 10, 33021 Líně', magicKey: '1424587' }]);
    await expect(resolveAddress(suggestions[0])).resolves.toMatchObject({ coordinates: [13.2602911198, 49.691965223] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('outSR=4326');
  });
});
