import TileLayer from 'ol/layer/Tile.js';
import ImageLayer from 'ol/layer/Image.js';
import VectorLayer from 'ol/layer/Vector.js';
import XYZ from 'ol/source/XYZ.js';
import ImageArcGISRest from 'ol/source/ImageArcGISRest.js';
import ImageWMS from 'ol/source/ImageWMS.js';
import WMTS, { optionsFromCapabilities } from 'ol/source/WMTS.js';
import VectorSource from 'ol/source/Vector.js';
import TileGrid from 'ol/tilegrid/TileGrid.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import WFS from 'ol/format/WFS.js';
import GML32 from 'ol/format/GML32.js';
import GML3 from 'ol/format/GML3.js';
import GML2 from 'ol/format/GML2.js';
import { Fill, Stroke, Style, Circle as CircleStyle } from 'ol/style.js';
import type Feature from 'ol/Feature.js';
import type Geometry from 'ol/geom/Geometry.js';
import type { LayerSpec, MapLayer, ServiceInfo } from '../types';
import { discover, fetchText, requestUrl } from './services';
import { normalizeCrs, pickCrs, requireProjection, wfsBbox } from './projections';

export const selectionStyle = new Style({
  fill: new Fill({ color: 'rgba(221, 255, 148, 0.28)' }),
  stroke: new Stroke({ color: '#e2ff96', width: 4 }),
  image: new CircleStyle({ radius: 9, fill: new Fill({ color: '#385d3c' }), stroke: new Stroke({ color: '#e2ff96', width: 4 }) }),
});

function createEsriFeatureLayer(spec: LayerSpec, info: ServiceInfo, crs: string, common: { visible: boolean; opacity: number; properties: { id: string; title: string } }, signal: AbortSignal, onNotice: (id: string, notice?: string) => void) {
  let requestId = 0;
  let activeRequest: AbortController | undefined;
  let previousExtent: number[] | undefined;
  let previousKey = '';
  const source = new VectorSource<Feature<Geometry>>({
    attributions: '© <a href="https://csu.gov.cz/" target="_blank" rel="noopener noreferrer">ČSÚ</a>',
    wrapX: false,
    strategy: (extent, resolution) => {
      const key = `${extent.join(',')}:${resolution}`;
      if (key !== previousKey && previousExtent) source.removeLoadedExtent(previousExtent);
      previousExtent = extent.slice(); previousKey = key;
      return [extent];
    },
    loader: async (extent, resolution, projection) => {
      const current = ++requestId;
      activeRequest?.abort();
      activeRequest = new AbortController();
      const meters = resolution * (projection.getMetersPerUnit() || 1);
      if (meters > 15) {
        onNotice(spec.id, 'Pro zobrazení adresních bodů ČSÚ přibližte mapu (rozlišení nejvýše 15 m/px).');
        source.clear();
        return [];
      }
      onNotice(spec.id, 'Načítání adresních bodů ČSÚ…');
      try {
        const url = requestUrl(`${info.url}/query`, {
          where: '1=1', geometry: extent.join(','), geometryType: 'esriGeometryEnvelope', inSR: crs.replace(/^EPSG:/, ''),
          spatialRel: 'esriSpatialRelIntersects', outFields: '*', returnGeometry: true, outSR: '4326',
          f: 'geojson', resultRecordCount: 1000,
        });
        const text = await fetchText(url, AbortSignal.any([signal, activeRequest.signal]));
        if (current !== requestId || signal.aborted) return [];
        const payload = JSON.parse(text);
        if (payload.error) throw new Error(payload.error.message || 'ČSÚ odmítlo dotaz na adresní body.');
        const features = new GeoJSON().readFeatures(text, { dataProjection: 'EPSG:4326', featureProjection: crs }) as Feature<Geometry>[];
        source.clear();
        onNotice(spec.id, payload.properties?.exceededTransferLimit ? `Zobrazeno prvních ${features.length.toLocaleString('cs-CZ')} adresních bodů. Přibližte mapu pro podrobnější výřez.` : `${features.length.toLocaleString('cs-CZ')} adresních bodů ČSÚ`);
        return features;
      } catch (error) {
        if (current === requestId && !signal.aborted) onNotice(spec.id, error instanceof Error ? error.message : 'Načtení adresních bodů ČSÚ se nezdařilo.');
        throw error;
      }
    },
  });
  return new VectorLayer({
    ...common,
    source,
    style: new Style({ image: new CircleStyle({ radius: 4, fill: new Fill({ color: '#5c8569' }), stroke: new Stroke({ color: '#f4f7df', width: 1.2 }) }) }),
  });
}

export async function createMapLayer(spec: LayerSpec, preferred: string | undefined, signal: AbortSignal, onNotice: (id: string, notice?: string) => void): Promise<MapLayer> {
  const info = await discover(spec.protocol, spec.url, signal);
  const choices = spec.layerNames?.length ? spec.layerNames.map((name) => {
    const found = info.choices.find((c) => c.name === name);
    if (!found) throw new Error(`Vrstva „${name}“ není ve službě dostupná.`);
    return found;
  }) : (spec.protocol === 'Esri' ? info.choices : [info.choices[0]]);
  const names = choices.map((c) => c.name);
  const crs = spec.protocol === 'Esri' ? preferred || normalizeCrs(info.raw.spatialReference.latestWkid || info.raw.spatialReference.wkid) : pickCrs(choices[0].crs, preferred);
  requireProjection(crs);
  if (spec.protocol !== 'Esri') choices.forEach((c) => pickCrs(c.crs, crs));
  const hostname = new URL(info.url).hostname;
  const attribution = /(^|\.)cuzk\.(gov\.)?cz$/.test(hostname) ? '© <a href="https://cuzk.gov.cz/" target="_blank" rel="noopener noreferrer">ČÚZK</a>' : /(^|\.)csu\.gov\.cz$/.test(hostname) ? '© <a href="https://csu.gov.cz/" target="_blank" rel="noopener noreferrer">ČSÚ</a>' : hostname;
  const common = { visible: spec.visible ?? true, opacity: spec.opacity ?? 1, properties: { id: spec.id, title: spec.title } };
  let layer: MapLayer['layer'];
  if (spec.protocol === 'Esri') {
    if (info.raw.type === 'Feature Layer') {
      layer = createEsriFeatureLayer(spec, info, crs, common, signal, onNotice);
    } else {
    const tile = info.raw.tileInfo;
    const native = normalizeCrs(info.raw.spatialReference.latestWkid || info.raw.spatialReference.wkid);
    if (tile && native === crs && !spec.layerNames?.length) {
      const source = new XYZ({
        url: `${info.url}/tile/{z}/{y}/{x}`, projection: crs, crossOrigin: 'anonymous', attributions: attribution,
        tileGrid: new TileGrid({ origin: [tile.origin.x, tile.origin.y], resolutions: tile.lods.map((l: any) => l.resolution), tileSize: [tile.cols, tile.rows] }),
        wrapX: false,
      });
      layer = new TileLayer({ ...common, source });
    } else {
      layer = new ImageLayer({ ...common, source: new ImageArcGISRest({ url: info.url, projection: crs, crossOrigin: 'anonymous', attributions: attribution, ratio: 1, params: { FORMAT: 'png32', TRANSPARENT: true, ...(spec.layerNames?.length ? { LAYERS: `show:${names.join(',')}` } : {}) } }) });
    }
    }
  } else if (spec.protocol === 'WMS') {
    layer = new ImageLayer({ ...common, source: new ImageWMS({ url: info.url, projection: crs, crossOrigin: 'anonymous', attributions: attribution, ratio: 1, params: { LAYERS: names.join(','), VERSION: info.version, FORMAT: 'image/png', TRANSPARENT: true } }) });
  } else if (spec.protocol === 'WMTS') {
    const rawLayer = info.raw.Contents.Layer.find((l: any) => l.Identifier === names[0]);
    const matrix = info.raw.Contents.TileMatrixSet.find((s: any) => normalizeCrs(s.SupportedCRS) === crs && rawLayer.TileMatrixSetLink.some((link: any) => link.TileMatrixSet === s.Identifier));
    if (!matrix) throw new Error(`WMTS nenabízí dlaždicovou matici v ${crs}.`);
    const options = optionsFromCapabilities(info.raw, { layer: names[0], matrixSet: matrix.Identifier });
    if (!options) throw new Error('Nelze sestavit WMTS zdroj z jeho capabilities.');
    options.urls = options.urls?.map((url) => url.replace(/^http:\/\//, 'https://'));
    layer = new TileLayer({ ...common, source: new WMTS({ ...options, attributions: attribution, crossOrigin: 'anonymous', wrapX: false }) });
  } else {
    const selected = choices[0];
    const srsName = selected.crs.find((c) => normalizeCrs(c) === crs)!;
    const formats: string[] = info.raw.formats;
    const output = formats.find((s) => /json/i.test(s)) || formats.find((s) => /3\.2/.test(s)) || formats[0];
    const json = output && /json/i.test(output);
    const prefix = names[0].split(':')[0];
    const gmlOptions = { featureNS: info.raw.namespaces[prefix], featureType: names[0].split(':').pop(), srsName: crs };
    const gml = info.version.startsWith('2') ? new GML32(gmlOptions) : info.version.startsWith('1.0') ? new GML2(gmlOptions) : new GML3(gmlOptions);
    const format = json ? new GeoJSON() : new WFS({ version: info.version, gmlFormat: gml });
    let requestId = 0;
    let activeRequest: AbortController | undefined;
    let previousExtent: number[] | undefined;
    let previousKey = '';
    const source = new VectorSource<Feature<Geometry>>({
      attributions: attribution, wrapX: false,
      strategy: (extent, resolution) => {
        const key = `${extent.join(',')}:${resolution}`;
        if (key !== previousKey && previousExtent) source.removeLoadedExtent(previousExtent);
        previousExtent = extent.slice(); previousKey = key;
        return [extent];
      },
      loader: async (extent, resolution, projection) => {
        const current = ++requestId;
        activeRequest?.abort();
        activeRequest = new AbortController();
        const meters = resolution * (projection.getMetersPerUnit() || 1);
        if (meters > 3) {
          onNotice(spec.id, 'Pro vektorové prvky přibližte mapu (rozlišení nejvýše 3 m/px).');
          source.clear();
          return [];
        }
        onNotice(spec.id, 'Načítání vektorových prvků…');
        try {
          const url = requestUrl(info.url, { SERVICE: 'WFS', REQUEST: 'GetFeature', VERSION: info.version, [info.version.startsWith('2') ? 'TYPENAMES' : 'TYPENAME']: names.join(','), SRSNAME: srsName, BBOX: wfsBbox(extent, crs, info.version, srsName), [info.version.startsWith('2') ? 'COUNT' : 'MAXFEATURES']: 1000, ...(output ? { OUTPUTFORMAT: output } : {}) });
          const text = await fetchText(url, AbortSignal.any([signal, activeRequest.signal]));
          if (current !== requestId || signal.aborted) return [];
          let document: Document | undefined;
          if (!json) {
            document = new DOMParser().parseFromString(text, 'text/xml');
            if (document.getElementsByTagName('parsererror').length) throw new Error('WFS vrátil neplatný dokument GML.');
            // GML from ČÚZK uses OGC HTTP CRS identifiers. OL natively handles
            // EPSG and URNs, so normalize geometry and envelope identifiers.
            document.querySelectorAll('[srsName]').forEach((node) => node.setAttribute('srsName', normalizeCrs(node.getAttribute('srsName')!)));
          }
          const features = format.readFeatures(document || text, { dataProjection: crs, featureProjection: crs }) as Feature<Geometry>[];
          for (const feature of features) {
            // INSPIRE may contain both a polygon and a referencePoint. Prefer
            // the actual feature geometry over the last geometry property.
            if (feature.get('geometry')?.getType) feature.setGeometryName('geometry');
          }
          // Keep only the latest viewport: memory stays bounded while panning.
          source.clear();
          onNotice(spec.id, features.length >= 1000 ? 'Zobrazeno prvních 1 000 prvků. Pro úplný detail přibližte mapu.' : `${features.length.toLocaleString('cs-CZ')} vektorových prvků`);
          return features;
        } catch (error) {
          if (current === requestId && !signal.aborted) onNotice(spec.id, error instanceof Error ? error.message : 'Načtení WFS se nezdařilo.');
          throw error;
        }
      },
    });
    layer = new VectorLayer({ ...common, source, style: new Style({ stroke: new Stroke({ color: '#f6d297', width: 2 }), fill: new Fill({ color: 'rgba(246,210,151,0.07)' }), image: new CircleStyle({ radius: 5, fill: new Fill({ color: '#f6d297' }), stroke: new Stroke({ color: '#4c3f23', width: 1.5 }) }) }) });
  }
  const source = (layer as TileLayer<XYZ> | ImageLayer<ImageWMS> | VectorLayer<VectorSource<Feature<Geometry>>>).getSource();
  // Surface raster failures instead of leaving the user with a silent blank map.
  source?.on(['tileloaderror', 'imageloaderror'] as any, () => onNotice(spec.id, 'Mapový obraz se nepodařilo načíst. Zkuste vrstvu obnovit.'));
  source?.on(['tileloadend', 'imageloadend'] as any, () => onNotice(spec.id, undefined));
  return { spec: { ...spec, visible: common.visible, opacity: common.opacity, ...(spec.protocol !== 'Esri' ? { layerNames: names } : {}) }, layer, info, crs, queryable: choices.some((c) => c.queryable) };
}
