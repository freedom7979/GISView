import { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import { defaults as defaultControls, ScaleLine } from 'ol/control.js';
import { defaults as defaultInteractions } from 'ol/interaction/defaults.js';
import { transform, transformExtent, getPointResolution } from 'ol/proj.js';
import { CATALOG } from '../catalog';
import { createMapLayer, selectionStyle } from '../gis/layers';
import { identifyLayer, featureHit } from '../gis/identify';
import { COUNTRY_EXTENT, createView, initialNavigation, saveView } from '../gis/navigation';
import { useLocation } from './useLocation';
import type { Hit, LayerSpec, MapLayer } from '../types';

const STORAGE = 'gisview.layers.v1';
const message = (e: unknown) => e instanceof Error ? e.message : 'Operace se nezdařila.';

function storedLayers(): LayerSpec[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE) || 'null');
    if (Array.isArray(parsed) && parsed.length && parsed.some((s) => s.kind === 'base')) {
      return parsed.filter((s) => s && typeof s.id === 'string' && typeof s.url === 'string' && ['Esri', 'WMS', 'WMTS', 'WFS'].includes(s.protocol));
    }
  } catch { /* Storage can be disabled by the browser. */ }
  return [CATALOG[0], { ...CATALOG[2], opacity: 0.8 }];
}

export function useMap() {
  const target = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const [mapInstance, setMapInstance] = useState<Map | null>(null);
  const [navigation] = useState(initialNavigation);
  const navigationVersion = useRef(0);
  const entriesRef = useRef<MapLayer[]>([]);
  const lifetime = useRef<AbortController>(new AbortController());
  const identifyAbort = useRef<AbortController | null>(null);
  const selection = useRef(new VectorSource());
  const locked = useRef(false);
  const [layers, setLayers] = useState<MapLayer[]>([]);
  const [busy, setBusy] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [notices, setNotices] = useState<Record<string, string | undefined>>({});
  const [crs, setCrs] = useState('');
  const [coordinate, setCoordinate] = useState<number[] | null>(null);
  const [scale, setScale] = useState(0);
  const [hits, setHits] = useState<Hit[]>([]);
  const [selectedHit, setSelectedHit] = useState(0);
  const [inspecting, setInspecting] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [queryNote, setQueryNote] = useState('');
  const [loadingMap, setLoadingMap] = useState(false);
  const location = useLocation(mapInstance, ready, navigation.source === 'link', navigationVersion);
  const markNavigation = () => { navigationVersion.current++; };

  const notice = (id: string, text?: string) => {
    if (!lifetime.current.signal.aborted) setNotices((old) => old[id] === text ? old : { ...old, [id]: text });
  };
  const publish = (entries: MapLayer[], persist = true) => {
    entriesRef.current = entries;
    setLayers([...entries]);
    entries.forEach((entry, i) => entry.layer.setZIndex(i));
    if (persist) try { localStorage.setItem(STORAGE, JSON.stringify(entries.map((e) => e.spec))); } catch { /* optional */ }
  };
  const clearSelection = () => {
    identifyAbort.current?.abort();
    selection.current.clear();
    setHits([]); setHasSelection(false); setInspecting(false); setQueryNote('');
  };

  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    const selectedSource = selection.current;
    const map = new Map({
      target: target.current!,
      interactions: defaultInteractions({ onFocusOnly: false }),
      controls: defaultControls({ zoom: false, rotate: false, attributionOptions: { collapsible: false } }).extend([new ScaleLine({ units: 'metric', minWidth: 100 })]),
      view: createView(navigation.view),
      layers: [new VectorLayer({ source: selectedSource, zIndex: 10000, style: selectionStyle })],
    });
    mapRef.current = map;
    setMapInstance(map);
    if (navigation.source === 'country') map.getView().fit(transformExtent(COUNTRY_EXTENT, 'EPSG:4326', map.getView().getProjection()), { padding: [45, 45, 45, 45] });
    const canvas = target.current!;
    const onMapKey = (event: KeyboardEvent) => { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '+', '-', '='].includes(event.key)) markNavigation(); };
    canvas.addEventListener('pointerdown', markNavigation);
    canvas.addEventListener('wheel', markNavigation, { passive: true });
    canvas.addEventListener('keydown', onMapKey);
    const resize = new ResizeObserver(() => map.updateSize());
    resize.observe(canvas);
    map.on('loadstart', () => setLoadingMap(true));
    map.on('loadend', () => setLoadingMap(false));
    map.on('pointermove', (event) => { if (!event.dragging) setCoordinate(event.coordinate); });
    const updateScale = () => {
      const view = map.getView();
      setScale(getPointResolution(view.getProjection(), view.getResolution()!, view.getCenter()!, 'm') / 0.00028);
    };
    map.on('moveend', () => { updateScale(); saveView(map.getView()); });
    map.on('singleclick', async (event) => {
      if (locked.current) return;
      identifyAbort.current?.abort();
      const queryController = new AbortController();
      identifyAbort.current = queryController;
      const signal = AbortSignal.any([controller.signal, queryController.signal]);
      setHasSelection(true); setInspecting(true); setHits([]); setQueryNote(''); setSelectedHit(0);
      selectedSource.clear();
      selectedSource.addFeature(new Feature(new Point(event.coordinate)));
      const entries = entriesRef.current.filter((entry) => entry.layer.getVisible() && (entry.spec.opacity ?? 1) > 0 && entry.queryable);
      const local: Hit[] = [];
      map.forEachFeatureAtPixel(event.pixel, (feature, layer) => {
        const entry = entries.find((e) => e.layer === layer && e.spec.protocol === 'WFS');
        if (entry && feature instanceof Feature) local.push(featureHit(feature, entry.spec.title, local.length));
      }, { hitTolerance: 6 });
      const remote = entries.filter((e) => ['Esri', 'WMS'].includes(e.spec.protocol));
      const results = await Promise.allSettled(remote.map((entry) => identifyLayer(entry, map, event.coordinate, signal)));
      if (signal.aborted) return;
      const found = [...local, ...results.flatMap((result) => result.status === 'fulfilled' ? result.value : [])];
      const failures = results.flatMap((r, i) => r.status === 'rejected' ? [`${remote[i].spec.title}: ${message(r.reason)}`] : []);
      setHits(found); setInspecting(false);
      setQueryNote(failures.length ? failures.join(' · ') : !entries.length ? 'Zapnuté vrstvy neposkytují vlastnosti prvků. Přidejte například Parcely · RÚIAN nebo vektorovou vrstvu WFS.' : '');
      if (found[0]?.feature?.getGeometry()) {
        selectedSource.clear(); selectedSource.addFeature(found[0].feature);
      }
    });
    async function start() {
      locked.current = true;
      const saved = storedLayers();
      const baseSpec = saved.find((s) => s.kind === 'base') || CATALOG[0];
      try {
        let base: MapLayer;
        try { base = await createMapLayer(baseSpec, undefined, controller.signal, notice); }
        catch (e) {
          if (controller.signal.aborted) return;
          if (baseSpec.id === 'ortho') throw e;
          setError(`Uložený podklad není dostupný. Načítám Ortofoto ČR. ${message(e)}`);
          base = await createMapLayer(CATALOG[0], undefined, controller.signal, notice);
        }
        if (controller.signal.aborted) return;
        const current = map.getView();
        current.cancelAnimations();
        map.setView(createView({ center: current.getCenter()!, resolution: current.getResolution()!, crs: current.getProjection().getCode() }, base.crs));
        map.addLayer(base.layer); publish([base], false); setCrs(base.crs); setReady(true); updateScale();
        const overlayResults = await Promise.allSettled(saved.filter((s) => s.kind !== 'base').map((spec) => createMapLayer(spec, base.crs, controller.signal, notice)));
        if (controller.signal.aborted) return;
        const overlays = overlayResults.flatMap((r) => r.status === 'fulfilled' ? [r.value] : []);
        overlays.forEach((entry) => map.addLayer(entry.layer));
        publish([base, ...overlays], false);
        const failed = overlayResults.find((r) => r.status === 'rejected');
        if (failed?.status === 'rejected') setError(message(failed.reason));
      } catch (e) { if (!controller.signal.aborted) setError(message(e)); }
      finally { if (!controller.signal.aborted) { locked.current = false; setBusy(false); } }
    }
    void start();
    return () => { controller.abort(); identifyAbort.current?.abort(); resize.disconnect(); canvas.removeEventListener('pointerdown', markNavigation); canvas.removeEventListener('wheel', markNavigation); canvas.removeEventListener('keydown', onMapKey); map.setTarget(undefined); map.dispose(); mapRef.current = null; selectedSource.clear(); };
    // Map listeners intentionally read mutable refs rather than capturing React state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addLayer(spec: LayerSpec) {
    if (locked.current || !mapRef.current) return false;
    if (entriesRef.current.some((e) => e.spec.id === spec.id)) return true;
    locked.current = true; setBusy(true); setError('');
    markNavigation();
    const signal = lifetime.current.signal;
    try {
      const map = mapRef.current;
      if (spec.kind === 'base') {
        const base = await createMapLayer(spec, undefined, signal, notice);
        const overlays = await Promise.all(entriesRef.current.filter((e) => e.spec.kind === 'overlay').map((e) => createMapLayer(e.spec, base.crs, signal, notice)));
        if (signal.aborted) return false;
        const old = map.getView();
        old.cancelAnimations();
        entriesRef.current.forEach((e) => map.removeLayer(e.layer));
        map.setView(createView({ center: old.getCenter()!, resolution: old.getResolution()!, crs: old.getProjection().getCode() }, base.crs));
        [base, ...overlays].forEach((e) => map.addLayer(e.layer));
        publish([base, ...overlays]); setCrs(base.crs); setReady(true);
      } else {
        const layer = await createMapLayer(spec, map.getView().getProjection().getCode(), signal, notice);
        if (signal.aborted) return false;
        map.addLayer(layer.layer); publish([...entriesRef.current, layer]);
      }
      clearSelection();
      return true;
    } catch (e) { if (!signal.aborted) setError(message(e)); return false; }
    finally { if (!signal.aborted) { locked.current = false; setBusy(false); } }
  }

  function updateLayer(id: string, changes: Partial<LayerSpec>) {
    const entries = entriesRef.current.map((entry) => {
      if (entry.spec.id !== id) return entry;
      if (changes.visible !== undefined) entry.layer.setVisible(changes.visible);
      if (changes.opacity !== undefined) entry.layer.setOpacity(changes.opacity);
      return { ...entry, spec: { ...entry.spec, ...changes } };
    });
    publish(entries); clearSelection();
  }
  function removeLayer(id: string) {
    const entry = entriesRef.current.find((e) => e.spec.id === id);
    if (!entry || entry.spec.kind === 'base') return;
    mapRef.current?.removeLayer(entry.layer);
    publish(entriesRef.current.filter((e) => e !== entry)); clearSelection();
  }
  function reorder(id: string, direction: number) {
    const entries = [...entriesRef.current];
    const from = entries.findIndex((e) => e.spec.id === id), to = from + direction;
    if (from < 1 || to < 1 || to >= entries.length) return;
    [entries[from], entries[to]] = [entries[to], entries[from]];
    publish(entries);
  }
  function focusHit(index: number) {
    setSelectedHit(index);
    const feature = hits[index]?.feature;
    if (feature?.getGeometry()) { selection.current.clear(); selection.current.addFeature(feature); }
  }
  function zoomToHit() {
    markNavigation();
    const geometry = hits[selectedHit]?.feature?.getGeometry();
    if (geometry) mapRef.current?.getView().fit(geometry.getExtent(), { padding: [100, 100, 100, 100], duration: 500, maxZoom: 20 });
  }
  function goTo(lonLat: number[], resolution = 2) {
    markNavigation();
    const view = mapRef.current?.getView();
    view?.cancelAnimations();
    view?.animate({ center: transform(lonLat, 'EPSG:4326', view.getProjection()), resolution: resolution / (view.getProjection().getMetersPerUnit() || 1), duration: 650 });
    clearSelection();
  }
  function zoom(delta: number) { markNavigation(); const view = mapRef.current?.getView(); view?.cancelAnimations(); view?.animate({ resolution: view.getResolution()! / 2 ** delta, duration: 250 }); }
  function fitCountry() {
    markNavigation();
    const map = mapRef.current;
    if (map) { map.getView().cancelAnimations(); map.getView().fit(transformExtent(COUNTRY_EXTENT, 'EPSG:4326', map.getView().getProjection()), { padding: [50, 50, 50, 50], duration: 650 }); }
    clearSelection();
  }
  function refresh(id: string) {
    const entry = entriesRef.current.find((e) => e.spec.id === id);
    if (entry && 'getSource' in entry.layer) (entry.layer as VectorLayer).getSource()?.refresh();
    notice(id, undefined);
  }
  async function share() {
    const view = mapRef.current?.getView();
    if (!view) return;
    const url = new URL(window.location.href);
    const center = view.getCenter()!;
    Object.entries({ x: center[0], y: center[1], r: view.getResolution()!, crs: view.getProjection().getCode() }).forEach(([key, value]) => url.searchParams.set(key, String(value)));
    try { await navigator.clipboard.writeText(url.toString()); return true; }
    catch { setError('Odkaz nelze zkopírovat do schránky v tomto prohlížeči.'); return false; }
  }
  return { target, mapRef, layers, busy, ready, error, setError, notices, crs, coordinate, scale, hits, selectedHit, inspecting, hasSelection, queryNote, loadingMap, addLayer, updateLayer, removeLayer, reorder, clearSelection, focusHit, zoomToHit, goTo, zoom, fitCountry, refresh, share, location, initialViewSource: navigation.source };
}
