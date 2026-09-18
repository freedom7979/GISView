import type BaseLayer from 'ol/layer/Base.js';
import type Feature from 'ol/Feature.js';
import type Geometry from 'ol/geom/Geometry.js';

export type Protocol = 'Esri' | 'WMS' | 'WMTS' | 'WFS';
export interface LayerSpec {
  id: string;
  title: string;
  description: string;
  protocol: Protocol;
  url: string;
  layerNames?: string[];
  kind: 'base' | 'overlay';
  tone: string;
  visible?: boolean;
  opacity?: number;
}
export interface Choice {
  name: string;
  title: string;
  crs: string[];
  queryable: boolean;
}
export interface ServiceInfo {
  protocol: Protocol;
  url: string;
  title: string;
  choices: Choice[];
  version: string;
  // Capabilities have different, provider-defined structures for each protocol.
  raw: any;
}
export interface MapLayer {
  spec: LayerSpec;
  layer: BaseLayer;
  info: ServiceInfo;
  crs: string;
  queryable: boolean;
  notice?: string;
}
export interface Hit {
  id: string;
  layerTitle: string;
  title: string;
  properties: Record<string, unknown>;
  feature?: Feature<Geometry>;
}
