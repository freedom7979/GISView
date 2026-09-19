import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpRight, Check, ChevronDown, ChevronLeft, ChevronRight, Compass, Crosshair, Download, ExternalLink, Eye, EyeOff, Focus, Globe2, Info, Layers3, LoaderCircle, Map as MapIcon, MapPin, Maximize, Minus, Plus, RefreshCw, Search, Settings2, Share2, Trash2, X } from 'lucide-react';
import { AddLayerDialog } from './components/AddLayerDialog';
import { ThemePicker } from './components/ThemePicker';
import { LocationContext } from './components/LocationContext';
import { useMap } from './hooks/useMap';
import { CATALOG, PLACES } from './catalog';
import { parseCoordinateQuery, resolveAddress, suggestAddresses, type AddressSuggestion } from './gis/addressSearch';
import type { Hit, MapLayer } from './types';
import type { ReactNode } from 'react';

function IconButton({ label, children, onClick, className = '', disabled = false }: { label: string; children: ReactNode; onClick: () => void; className?: string; disabled?: boolean }) {
  return <button className={`icon-button ${className}`} title={label} aria-label={label} onClick={onClick} disabled={disabled}>{children}</button>;
}
function propertyText(value: unknown): string {
  if (value === null || value === undefined || value === '' || value === 'Null') return '—';
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (record['xsi:nil'] === 'true' || record['xsi:nil'] === true) return '—';
    if (record.__content__ !== undefined) return `${record.__content__}${record.uom ? ` ${String(record.uom).replace('m2', 'm²')}` : ''}`;
    if (record['xlink:title']) return String(record['xlink:title']);
    try { return JSON.stringify(value, null, 2); } catch { return String(value); }
  }
  return String(value);
}
function exportHit(hit: Hit) {
  const blob = new Blob([JSON.stringify({ vrstva: hit.layerTitle, vlastnosti: hit.properties }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'gisview-vlastnosti.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const map = useMap();
  const [dialog, setDialog] = useState(false);
  const [sidebar, setSidebar] = useState(() => window.matchMedia('(min-width: 761px)').matches);
  const [expanded, setExpanded] = useState<string | null>('parcels');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [addressResults, setAddressResults] = useState<AddressSuggestion[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState('');
  const [toast, setToast] = useState('');
  const [about, setAbout] = useState(false);
  const aboutDialog = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 3500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { if (about) aboutDialog.current?.showModal(); }, [about]);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (searchRef.current && !searchRef.current.contains(event.target as Node)) setSearchOpen(false); };
    document.addEventListener('pointerdown', close); return () => document.removeEventListener('pointerdown', close);
  }, []);
  useEffect(() => {
    const query = search.trim();
    setAddressResults([]);
    setAddressError('');
    if (query.length < 2 || parseCoordinateQuery(query)) { setAddressLoading(false); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setAddressLoading(true);
      void suggestAddresses(query, controller.signal).then((results) => {
        if (!controller.signal.aborted) setAddressResults(results);
      }).catch((error: unknown) => {
        if (!controller.signal.aborted) setAddressError(error instanceof Error ? error.message : 'Adresy se nepodařilo načíst.');
      }).finally(() => {
        if (!controller.signal.aborted) setAddressLoading(false);
      });
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [search]);
  const overlays = map.layers.filter((l) => l.spec.kind === 'overlay').reverse();
  const base = map.layers.find((l) => l.spec.kind === 'base');
  const hit = map.hits[map.selectedHit];
  const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const places = PLACES.filter((p) => fold(p.name).includes(fold(search)));
  const parsedCoordinate = parseCoordinateQuery(search);
  const lonLat = parsedCoordinate?.lonLat ?? null;
  function navigate(coordinates: number[], title: string) { map.goTo(coordinates); setSearch(title); setSearchOpen(false); }
  async function selectAddress(suggestion: AddressSuggestion) {
    setAddressLoading(true); setAddressError('');
    try {
      const result = await resolveAddress(suggestion);
      navigate(result.coordinates, result.name);
    } catch (error) {
      setAddressError(error instanceof Error ? error.message : 'Adresu se nepodařilo načíst.');
    } finally {
      setAddressLoading(false);
    }
  }
  function submitSearch() {
    if (lonLat) navigate(lonLat, search.trim());
    else if (addressResults[0]) void selectAddress(addressResults[0]);
    else if (places[0]) navigate(places[0].coordinates, places[0].name);
  }
  function layerCard(entry: MapLayer, index: number) {
    const spec = entry.spec;
    return <article className={`layer-card ${!spec.visible ? 'is-hidden' : ''}`} key={spec.id}>
      <div className="layer-main"><div className={`layer-symbol ${spec.tone}`}><Layers3 size={19} /></div><button className="layer-title" onClick={() => setExpanded(expanded === spec.id ? null : spec.id)} aria-expanded={expanded === spec.id}><strong>{spec.title}</strong><span>{spec.protocol} <span className="middle-dot">·</span> {entry.crs}</span></button><IconButton label={spec.visible ? `Skrýt ${spec.title}` : `Zobrazit ${spec.title}`} onClick={() => map.updateLayer(spec.id, { visible: !spec.visible })}>{spec.visible ? <Eye size={18} /> : <EyeOff size={18} />}</IconButton></div>
      {expanded === spec.id && <div className="layer-settings"><div className="opacity-label"><label htmlFor={`opacity-${spec.id}`}>Krytí vrstvy</label><span>{Math.round((spec.opacity ?? 1) * 100)} %</span></div><input id={`opacity-${spec.id}`} className="opacity-slider" type="range" min="0" max="100" step="5" value={Math.round((spec.opacity ?? 1) * 100)} onChange={(e) => map.updateLayer(spec.id, { opacity: Number(e.target.value) / 100 })} /><div className="layer-actions"><span className="layer-queryable"><span className={`tiny-dot ${entry.queryable ? '' : 'muted'}`} />{entry.queryable ? 'Výběr prvků' : 'Mapový obraz'}</span><IconButton label={`Posunout ${spec.title} výše`} disabled={index === 0 || map.busy} onClick={() => map.reorder(spec.id, 1)}><ArrowUp size={15} /></IconButton><IconButton label={`Posunout ${spec.title} níže`} disabled={index === overlays.length - 1 || map.busy} onClick={() => map.reorder(spec.id, -1)}><ArrowDown size={15} /></IconButton><IconButton label={`Obnovit ${spec.title}`} onClick={() => map.refresh(spec.id)}><RefreshCw size={15} /></IconButton><IconButton label={`Odebrat ${spec.title}`} disabled={map.busy} onClick={() => map.removeLayer(spec.id)}><Trash2 size={15} /></IconButton></div></div>}
      {map.notices[spec.id] && <p className="layer-notice">{map.notices[spec.id]}</p>}
    </article>;
  }
  return <div className="app-shell">
    <header className="app-header"><a href={window.location.pathname} className="brand" aria-label="GISView úvod"><span className="brand-icon"><Layers3 size={25} strokeWidth={1.8} /></span><span>GIS<span className="brand-light">View</span><small>PROSTOR PRO OBJEVOVÁNÍ</small></span></a><div className="header-nav"><span className="nav-active"><MapIcon size={17} /> Mapa</span><button onClick={() => setDialog(true)}><DatabaseIcon /> Katalog dat <ArrowUpRight size={14} /></button></div><div className="header-end"><span className="open-data"><span className="tiny-dot" /> Otevřená data ČÚZK</span><ThemePicker /><IconButton label="O aplikaci" onClick={() => setAbout(true)}><Info size={21} /></IconButton><button className="share-button" onClick={() => { void map.share().then((ok) => { if (ok) setToast('Odkaz na výřez mapy je ve schránce.'); }); }}><Share2 size={16} /><span>Sdílet výřez</span></button></div></header>
    <main className={`workspace ${sidebar ? '' : 'sidebar-closed'}`}>
      <aside className="sidebar" aria-label="Mapové vrstvy">
        <div className="sidebar-heading"><div className="eyebrow">VAŠE MAPOVÁ KOMPOZICE</div><div className="heading-row"><h1>Vrstvy mapy<span>.</span></h1><IconButton label="Skrýt panel vrstev" onClick={() => setSidebar(false)}><ChevronLeft size={19} /></IconButton></div><p>Objevujte místa. Propojujte souvislosti.</p></div>
        <div className="sidebar-scroll"><div className="section-label"><span>PODKLADOVÁ MAPA</span><span className="small-number">01</span></div>
          <div className={`basemap-preview ${base?.spec.tone || 'forest'}`}><div className="preview-contours" /><span className="basemap-chip"><span className="tiny-dot" /> AKTIVNÍ PODKLAD</span><div className="basemap-bottom"><div><h2>{base?.spec.title || 'Načítání podkladu…'}</h2><p>{base?.spec.protocol || 'Esri'} · {base?.crs || 'Ze zdroje'}</p></div><span className="round-check"><Check size={19} /></span></div></div>
          <div className="basemap-options"><button className={base?.spec.id === 'ortho' ? 'active' : ''} disabled={map.busy} onClick={() => { void map.addLayer(CATALOG[0]); }}><span className="mini-map ortho" /> Ortofoto</button><button className={base?.spec.id === 'ztm' ? 'active' : ''} disabled={map.busy} onClick={() => { void map.addLayer(CATALOG[1]); }}><span className="mini-map topo" /> Topografická</button></div>
          {base && map.notices[base.spec.id] && <div className="layer-notice base-notice">{map.notices[base.spec.id]} <button onClick={() => map.refresh(base.spec.id)}>Obnovit</button></div>}
          <div className="section-label data-label"><span>DATOVÉ VRSTVY</span><span className="small-number">{String(overlays.length).padStart(2, '0')}</span></div>
          <div className="layers-list">{overlays.map(layerCard)}{!overlays.length && <div className="no-layers"><Layers3 size={26} /><p>Přidejte první datovou vrstvu<br />a podívejte se pod povrch mapy.</p></div>}</div>
          <button className="add-layer-button" onClick={() => setDialog(true)}><Plus size={21} /> Přidat vrstvu <span>WMS, WMTS, WFS, Esri</span></button>
          <div className="map-tip"><div className="tip-icon"><Crosshair size={22} /></div><div><strong>Každé místo má svůj příběh.</strong><p>Klikněte na prvek v mapě<br />a prohlédněte si jeho vlastnosti.</p></div></div>
        </div>
        <footer className="sidebar-footer"><Globe2 size={19} /><div><strong>{map.crs === 'EPSG:5514' ? 'S-JTSK / Krovak' : map.crs || 'Souřadnicový systém'}</strong><span>{map.crs || 'Načítání…'} · podle podkladu</span></div><span className="auto-badge">AUTO</span></footer>
      </aside>
      <section className="map-panel" aria-label="Interaktivní mapa">
        <div ref={map.target} className="map-canvas" tabIndex={0} aria-label="Mapa. Posouvejte tažením, přibližujte kolečkem a kliknutím vyberte prvek." />
        <div className="map-top"><div className="search-container" ref={searchRef}><div className="map-search">{!sidebar && <IconButton label="Zobrazit panel vrstev" onClick={() => setSidebar(true)}><Layers3 size={20} /></IconButton>}<Search size={21} /><input aria-label="Hledat město nebo souřadnice" placeholder="Adresa, město nebo souřadnice" value={search} onFocus={() => setSearchOpen(true)} onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }} onKeyDown={(e) => { if (e.key === 'Escape') setSearchOpen(false); if (e.key === 'Enter') submitSearch(); }} />{search ? <IconButton label="Vymazat hledání" onClick={() => { setSearch(''); setSearchOpen(true); }}><X size={17} /></IconButton> : <span className="search-shortcut"><MapPin size={17} /></span>}</div>
          {searchOpen && <div className="search-results"><div className="eyebrow">{search ? 'VÝSLEDKY HLEDÁNÍ' : 'VYBRANÁ MĚSTA'}</div>{lonLat && <button onClick={() => navigate(lonLat, search.trim())}><Crosshair size={18} /><span><strong>{search}</strong><small>{parsedCoordinate?.format === 'hemisphere' ? 'GPS WGS 84 · převedu do mapy' : 'Souřadnice WGS 84 · délka, šířka'}</small></span><ChevronRight size={16} /></button>}{places.map((place) => <button key={place.name} onClick={() => navigate(place.coordinates, place.name)}><MapPin size={18} /><span><strong>{place.name}</strong><small>{place.detail}</small></span><ChevronRight size={16} /></button>)}{addressResults.map((address) => <button key={address.magicKey} disabled={addressLoading} onClick={() => void selectAddress(address)}><MapPin size={18} /><span><strong>{address.text}</strong><small>RÚIAN · adresní místo ČÚZK</small></span><ChevronRight size={16} /></button>)}{addressLoading && <p><LoaderCircle size={15} className="spin" /> Hledám adresy v RÚIAN…</p>}{addressError && <p role="alert">{addressError}</p>}{!addressLoading && !addressError && !places.length && !addressResults.length && !lonLat && <p>Zadejte město, adresu nebo GPS, např. 48.9510717N, 14.5156139E.</p>}<div className="search-hint">Adresy vyhledává RÚIAN ČÚZK · GPS WGS 84 se převede do aktuálního EPSG mapy</div></div>}
        </div><span className="map-live-badge">{map.loadingMap || map.busy ? <LoaderCircle size={14} className="spin" /> : <span className="tiny-dot" />}{map.busy ? 'Připojuji vrstvy' : map.loadingMap ? 'Načítání mapy' : 'Živá data ČÚZK'}</span></div>
        {!map.ready && <div className="map-loading"><div className="loading-symbol"><Globe2 size={34} /></div><h2>{map.busy ? 'Váš svět se načítá' : 'Podklad není dostupný'}</h2><p>{map.busy ? 'Připojujeme mapové služby ČÚZK…' : 'Zkontrolujte připojení a zkuste to znovu.'}</p>{!map.busy && <button className="button primary" onClick={() => window.location.reload()}><RefreshCw size={17} /> Zkusit znovu</button>}</div>}
        <div className="map-tools"><IconButton label="Celá Česká republika" onClick={map.fitCountry}><Maximize size={21} /></IconButton><IconButton label="Moje poloha" onClick={map.location.locate}>{map.location.status === 'locating' ? <LoaderCircle size={21} className="spin" /> : <Focus size={21} />}</IconButton><div className="zoom-controls"><IconButton label="Přiblížit mapu" onClick={() => map.zoom(1)}><Plus size={22} /></IconButton><span /><IconButton label="Oddálit mapu" onClick={() => map.zoom(-1)}><Minus size={22} /></IconButton></div><IconButton label="Otočit mapu na sever" className="compass-button" onClick={() => map.mapRef.current?.getView().animate({ rotation: 0, duration: 300 })}><Compass size={23} /><small>N</small></IconButton></div>
        {map.ready && <LocationContext {...map.location} source={map.initialViewSource} />}
        <div className="map-bottom-pill"><MapPin size={15} /><span>Kliknutím prozkoumejte mapu</span></div>
        {map.hasSelection && <aside className="feature-panel" aria-label="Vlastnosti prvku"><header><div className="feature-heading-icon"><Crosshair size={20} /></div><div><div className="eyebrow">DETAIL V MAPĚ</div><h2>{map.inspecting ? 'Hledám prvky…' : map.hits.length ? 'Vlastnosti prvku' : 'Vybrané místo'}</h2></div><IconButton label="Zavřít vlastnosti" onClick={map.clearSelection}><X size={19} /></IconButton></header>
          {map.inspecting ? <div className="feature-empty"><LoaderCircle size={28} className="spin" /><p>Dotazujeme se zapnutých vrstev.</p></div> : hit ? <><div className="feature-selector"><span>{hit.layerTitle}</span>{map.hits.length > 1 && <div><IconButton label="Předchozí prvek" disabled={map.selectedHit === 0} onClick={() => map.focusHit(map.selectedHit - 1)}><ChevronLeft size={17} /></IconButton><span>{map.selectedHit + 1} / {map.hits.length}</span><IconButton label="Další prvek" disabled={map.selectedHit === map.hits.length - 1} onClick={() => map.focusHit(map.selectedHit + 1)}><ChevronRight size={17} /></IconButton></div>}</div><h3 className="feature-name">{hit.title}</h3><dl className="properties">{Object.entries(hit.properties).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{propertyText(value)}</dd></div>)}</dl><footer><button className="button secondary" onClick={() => exportHit(hit)}><Download size={16} /> JSON</button><button className="button subtle" disabled={!hit.feature?.getGeometry()} onClick={map.zoomToHit}><Focus size={16} /> Přiblížit prvek</button></footer></> : <div className="feature-empty"><MapPin size={31} /><h3>Žádný prvek v tomto místě</h3><p>Zkuste přiblížit mapu nebo zapnout jinou datovou vrstvu. Samotné ortofoto nemá vlastnosti jednotlivých objektů.</p></div>}
          {map.queryNote && <p className="query-note">{map.queryNote}</p>}
        </aside>}
        {map.error && <div className="error-banner" role="alert"><Info size={20} /><span>{map.error}</span><IconButton label="Zavřít chybové hlášení" onClick={() => map.setError('')}><X size={18} /></IconButton></div>}
        <button className="mobile-layers" onClick={() => setSidebar(!sidebar)}><Layers3 size={19} /> Vrstvy <ChevronDown size={16} /></button>
      </section>
    </main>
    <footer className="status-bar"><span><span className={`tiny-dot ${map.ready ? '' : 'muted'}`} />{map.ready ? 'Mapa je připravena' : 'Připojování ke službám'}</span><span className="status-coordinates">{map.coordinate ? `${map.coordinate[0].toLocaleString('cs-CZ', { maximumFractionDigits: 2 })}, ${map.coordinate[1].toLocaleString('cs-CZ', { maximumFractionDigits: 2 })}` : 'Souřadnice kurzoru'}<span className="status-divider" />{map.crs || 'EPSG ze zdroje'}</span><span className="status-scale">{map.scale ? `1 : ${Math.round(map.scale).toLocaleString('cs-CZ')}` : '—'}<span className="status-divider" /><a href="https://openlayers.org/" target="_blank" rel="noreferrer">OpenLayers <ExternalLink size={11} /></a></span></footer>
    {toast && <div className="toast" role="status"><Check size={19} /> {toast}</div>}
    {dialog && <AddLayerDialog onClose={() => setDialog(false)} onAdd={map.addLayer} activeIds={map.layers.map((e) => e.spec.id)} busy={map.busy} crs={map.crs} />}
    {about && <dialog className="about-dialog" ref={aboutDialog} onCancel={() => setAbout(false)} onClick={(e) => { if (e.target === e.currentTarget) setAbout(false); }}><header><span className="brand-icon"><Layers3 size={26} /></span><IconButton label="Zavřít informace o aplikaci" onClick={() => setAbout(false)}><X size={21} /></IconButton></header><h2>Váš prostor<br />pro objevování<span>.</span></h2><p>GISView propojuje otevřená geodata ČÚZK v jedné mapě. Postaveno na Reactu a OpenLayers, s rozhraním inspirovaným Material 3 Expressive.</p><div className="about-details"><p><strong>Souřadnicové systémy</strong><br />Podklad určuje EPSG. Esri požaduje mapu v tomto systému, WMS a WFS ověřují podporu ve zdroji a WMTS vybírá odpovídající dlaždicovou matici.</p><p><strong>Výběr a vlastnosti</strong><br />Esri Identify, WMS GetFeatureInfo a výběr vektorových prvků WFS. Rastrové snímky samy o sobě neobsahují vlastnosti objektů.</p><p><strong>Vaše nastavení</strong><br />Skladba a krytí vrstev se ukládají pouze do tohoto prohlížeče. Sdílený odkaz obsahuje výřez mapy.</p></div><a className="button secondary" href="https://services.cuzk.gov.cz/" target="_blank" rel="noreferrer">Zdroje a podmínky ČÚZK <ArrowUpRight size={17} /></a><button className="button subtle" onClick={() => { localStorage.removeItem('gisview.layers.v1'); window.location.href = window.location.pathname; }}><RefreshCw size={16} /> Obnovit výchozí kompozici</button></dialog>}
  </div>;
}

function DatabaseIcon() { return <Settings2 size={17} />; }
