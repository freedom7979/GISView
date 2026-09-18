import { useCallback, useEffect, useRef, useState } from 'react';
import type Map from 'ol/Map.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import { circular } from 'ol/geom/Polygon.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import { Circle, Fill, Stroke, Style } from 'ol/style.js';
import { transform } from 'ol/proj.js';

type Status = 'idle' | 'locating' | 'located' | 'denied' | 'unavailable' | 'timeout';
export function useLocation(map: Map | null, ready: boolean, sharedView: boolean, navigationVersion: React.RefObject<number>) {
  const [status, setStatus] = useState<Status>('idle');
  const [accuracy, setAccuracy] = useState<number>();
  const [outsideCoverage, setOutsideCoverage] = useState(false);
  const requestId = useRef(0);
  const autoRequested = useRef(false);
  const markerSource = useRef(new VectorSource());
  const lastPosition = useRef<GeolocationPosition | null>(null);
  const refreshMarker = useCallback(() => {
    const position = lastPosition.current;
    if (!map || !position) return;
    const { longitude, latitude, accuracy } = position.coords;
    const projection = map.getView().getProjection();
    markerSource.current.clear();
    const area = new Feature(circular([longitude, latitude], Math.min(accuracy, 100000)).transform('EPSG:4326', projection));
    area.setStyle(new Style({ fill: new Fill({ color: 'rgba(76,157,255,.12)' }), stroke: new Stroke({ color: 'rgba(76,157,255,.45)', width: 1 }) }));
    const point = new Feature(new Point(transform([longitude, latitude], 'EPSG:4326', projection)));
    point.setStyle(new Style({ image: new Circle({ radius: 7, fill: new Fill({ color: '#418dff' }), stroke: new Stroke({ color: '#ffffff', width: 3 }) }) }));
    markerSource.current.addFeatures([area, point]);
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const layer = new VectorLayer({ source: markerSource.current, zIndex: 9000, properties: { role: 'user-location' } });
    map.addLayer(layer);
    map.on('change:view', refreshMarker);
    return () => { requestId.current++; map.un('change:view', refreshMarker); map.removeLayer(layer); markerSource.current.clear(); };
  }, [map, refreshMarker]);

  const locate = useCallback((automatic = false) => {
    if (!map) return;
    if (!navigator.geolocation || !window.isSecureContext) { setStatus('unavailable'); return; }
    const id = ++requestId.current;
    const atStart = navigationVersion.current;
    setStatus('locating');
    navigator.geolocation.getCurrentPosition((position) => {
      if (id !== requestId.current) return;
      const { longitude, latitude, accuracy } = position.coords;
      lastPosition.current = position;
      setAccuracy(accuracy); setStatus('located');
      setOutsideCoverage(longitude < 12.08 || longitude > 18.87 || latitude < 48.55 || latitude > 51.06);
      refreshMarker();
      // A late permission dialog must not teleport a user who is exploring.
      if (navigationVersion.current !== atStart || (automatic && atStart > 0)) return;
      const view = map.getView();
      const center = transform([longitude, latitude], 'EPSG:4326', view.getProjection());
      if (!center.every(Number.isFinite)) return;
      view.cancelAnimations();
      view.animate({ center, resolution: Math.max(2, Math.min(accuracy / 120, 500)) / (view.getProjection().getMetersPerUnit() || 1), duration: automatic ? 450 : 600 });
    }, (error) => {
      if (id !== requestId.current) return;
      setStatus(error.code === 1 ? 'denied' : error.code === 3 ? 'timeout' : 'unavailable');
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  }, [map, navigationVersion, refreshMarker]);

  useEffect(() => {
    if (!ready || sharedView || autoRequested.current) return;
    autoRequested.current = true;
    locate(true);
  }, [ready, sharedView, locate]);
  return { status, accuracy, outsideCoverage, locate: () => locate(false) };
}
