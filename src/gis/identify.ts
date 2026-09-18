import type Map from 'ol/Map.js';
import Feature from 'ol/Feature.js';
import Geometry from 'ol/geom/Geometry.js';
import EsriJSON from 'ol/format/EsriJSON.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import WMSGetFeatureInfo from 'ol/format/WMSGetFeatureInfo.js';
import ImageLayer from 'ol/layer/Image.js';
import ImageWMS from 'ol/source/ImageWMS.js';
import { fetchJson, fetchText, requestUrl } from './services';
import type { Hit, MapLayer } from '../types';

export function featureHit(feature: Feature<Geometry>, layerTitle: string, index: number): Hit {
  const props = { ...feature.getProperties() };
  delete props[feature.getGeometryName()];
  for (const [key, value] of Object.entries(props)) if (value instanceof Geometry) delete props[key];
  const display = props.nationalCadastralReference || props.label || props.NAZEV || props.Nazev || props.KmenoveCislo || feature.getId();
  return { id: `${layerTitle}-${index}`, layerTitle, title: display ? String(display) : layerTitle, properties: props, feature };
}

export async function identifyLayer(entry: MapLayer, map: Map, coordinate: number[], signal: AbortSignal): Promise<Hit[]> {
  const view = map.getView();
  const crs = view.getProjection().getCode();
  if (entry.spec.protocol === 'Esri') {
    const size = map.getSize()!;
    const json = await fetchJson(requestUrl(`${entry.info.url}/identify`, {
      f: 'json', geometry: JSON.stringify({ x: coordinate[0], y: coordinate[1], spatialReference: { wkid: Number(crs.split(':')[1]) } }), geometryType: 'esriGeometryPoint', sr: crs.split(':')[1], tolerance: 6,
      mapExtent: view.calculateExtent(size).join(','), imageDisplay: `${size[0]},${size[1]},96`, returnGeometry: true,
      layers: entry.spec.layerNames?.length ? `visible:${entry.spec.layerNames.join(',')}` : 'visible',
    }), signal);
    return (json.results || []).slice(0, 40).map((item: any, index: number) => {
      const feature = new EsriJSON().readFeature({ geometry: item.geometry, attributes: item.attributes }, { dataProjection: crs, featureProjection: crs }) as Feature<Geometry>;
      const parcel = item.attributes?.['Číslo parcely'] || item.attributes?.cisloparcely;
      return { ...featureHit(feature, entry.spec.title, index), title: parcel ? `Parcela ${parcel}` : String(item.value || item.layerName || entry.spec.title) };
    });
  }
  if (entry.spec.protocol === 'WMS' && entry.layer instanceof ImageLayer) {
    const source = entry.layer.getSource();
    if (!(source instanceof ImageWMS)) return [];
    const formats: string[] = entry.info.raw.Capability.Request.GetFeatureInfo?.Format || [];
    const infoFormat = formats.find((f) => /json/i.test(f)) || formats.find((f) => /gml/i.test(f)) || formats.find((f) => f === 'text/plain') || formats[0];
    if (!infoFormat) return [];
    const queryLayers = entry.info.choices.filter((c) => c.queryable && entry.spec.layerNames?.includes(c.name)).map((c) => c.name);
    if (!queryLayers.length) return [];
    const url = source.getFeatureInfoUrl(coordinate, view.getResolution()!, view.getProjection(), { INFO_FORMAT: infoFormat, QUERY_LAYERS: queryLayers.join(','), FEATURE_COUNT: 30 });
    if (!url) return [];
    const text = await fetchText(url, signal);
    if (/json|gml/i.test(infoFormat)) {
      const features = /json/i.test(infoFormat) ? new GeoJSON().readFeatures(text, { dataProjection: crs, featureProjection: crs }) : new WMSGetFeatureInfo().readFeatures(text, { dataProjection: crs, featureProjection: crs });
      return features.map((f, i) => featureHit(f as Feature<Geometry>, entry.spec.title, i));
    }
    // Remote HTML is treated as text, never injected into the application.
    let content = text.trim();
    if (/html/i.test(infoFormat)) {
      const doc = new DOMParser().parseFromString(text, 'text/html');
      doc.querySelectorAll('script,style,iframe').forEach((node) => node.remove());
      content = doc.body.textContent?.trim() || '';
    }
    return content ? [{ id: `${entry.spec.id}-info`, title: 'Informace ze služby', layerTitle: entry.spec.title, properties: { 'Odpověď služby': content } }] : [];
  }
  return [];
}
