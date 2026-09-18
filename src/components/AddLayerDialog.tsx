import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, Database, Globe2, Layers3, Link2, LoaderCircle, Plus, Search, X } from 'lucide-react';
import { CATALOG } from '../catalog';
import { discover } from '../gis/services';
import type { LayerSpec, Protocol, ServiceInfo } from '../types';

interface Props { onClose: () => void; onAdd: (spec: LayerSpec) => Promise<boolean>; activeIds: string[]; busy: boolean; crs: string; }

export function AddLayerDialog({ onClose, onAdd, activeIds, busy, crs }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<'catalog' | 'custom'>('catalog');
  const [filter, setFilter] = useState('Vše');
  const [search, setSearch] = useState('');
  const [protocol, setProtocol] = useState<Protocol>('Esri');
  const [url, setUrl] = useState('');
  const [info, setInfo] = useState<ServiceInfo | null>(null);
  const [selected, setSelected] = useState('');
  const [kind, setKind] = useState<'overlay' | 'base'>('overlay');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const discovery = useRef<AbortController | null>(null);
  useEffect(() => { dialog.current?.showModal(); return () => { discovery.current?.abort(); }; }, []);
  const filtered = CATALOG.filter((item) => (filter === 'Vše' || item.protocol === filter) && `${item.title} ${item.description}`.toLocaleLowerCase('cs').includes(search.toLocaleLowerCase('cs')));
  function reset() { discovery.current?.abort(); setInfo(null); setError(''); setLoading(false); }
  async function inspect() {
    discovery.current?.abort();
    const controller = new AbortController(); discovery.current = controller;
    setLoading(true); setError(''); setInfo(null);
    try {
      const result = await discover(protocol, url, controller.signal);
      if (!controller.signal.aborted) { setInfo(result); setSelected(result.choices[0].name); }
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Službu nelze načíst.'); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }
  async function addCustom() {
    if (!info) return;
    const choice = info.choices.find((c) => c.name === selected)!;
    const added = await onAdd({ id: `custom-${crypto.randomUUID()}`, title: choice.title, description: info.title, protocol, url: info.url, layerNames: [selected], kind, tone: 'mint' });
    if (added) onClose();
    else setError('Vrstva se nepřipojila. Zkontrolujte hlášení o kompatibilitě nebo dostupnosti služby v aplikaci.');
  }
  return <dialog ref={dialog} className="layer-dialog" onCancel={onClose} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="dialog-body">
      <header className="dialog-header"><div><div className="eyebrow">PROSTOR PRO DALŠÍ POHLED</div><h2>Přidat vrstvu</h2></div><button className="icon-button" onClick={onClose} aria-label="Zavřít dialog"><X /></button></header>
      <div className="segment-tabs"><button className={tab === 'catalog' ? 'selected' : ''} onClick={() => setTab('catalog')}><Database size={18} /> Katalog ČÚZK</button><button className={tab === 'custom' ? 'selected' : ''} onClick={() => setTab('custom')}><Link2 size={18} /> Vlastní služba</button></div>
      {tab === 'catalog' ? <>
        <div className="catalog-intro"><span>Otevřená data. Nové souvislosti.</span><a href="https://geoportal.cuzk.gov.cz/" target="_blank" rel="noreferrer">Geoportál ČÚZK <ArrowUpRight size={14} /></a></div>
        <label className="catalog-search"><Search size={19} /><input placeholder="Hledat v katalogu" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <div className="filter-chips">{['Vše', 'Esri', 'WMS', 'WMTS', 'WFS'].map((f) => <button className={filter === f ? 'active' : ''} key={f} onClick={() => setFilter(f)}>{f === filter && <Check size={14} />}{f}</button>)}</div>
        <div className="catalog-list">{filtered.map((item) => <article className="catalog-item" key={item.id}>
          <div className={`catalog-art ${item.tone}`}><Layers3 size={25} /></div><div className="catalog-item-text"><div className="catalog-item-title"><h3>{item.title}</h3><span className="protocol-tag">{item.protocol}</span></div><p>{item.description}</p><span className="catalog-type">{item.kind === 'base' ? 'Podkladová mapa' : 'Datová vrstva'} · ČÚZK</span></div>
          <button className={`icon-button add-item ${activeIds.includes(item.id) ? 'added' : ''}`} disabled={busy || activeIds.includes(item.id)} onClick={() => { void onAdd(item); }} aria-label={`Přidat ${item.title}`}>{activeIds.includes(item.id) ? <Check size={20} /> : <Plus size={20} />}</button>
        </article>)}{!filtered.length && <p className="empty-search">Žádná vrstva neodpovídá hledání.</p>}</div>
      </> : <div className="custom-form">
        <p>Připojte mapovou službu její URL. Dostupné vrstvy a souřadnicové systémy načteme přímo ze zdroje.</p>
        <label>Typ služby<select value={protocol} onChange={(e) => { setProtocol(e.target.value as Protocol); if (e.target.value === 'WFS') setKind('overlay'); reset(); }}>{(['Esri', 'WMS', 'WMTS', 'WFS'] as Protocol[]).map((p) => <option key={p}>{p}</option>)}</select></label>
        <label>Adresa služby<input type="url" placeholder={protocol === 'Esri' ? 'https://…/rest/services/…/MapServer' : 'https://…/sluzba?'} value={url} onChange={(e) => { setUrl(e.target.value); reset(); }} /></label>
        <button className="button secondary" disabled={!url.trim() || loading} onClick={() => { void inspect(); }}>{loading ? <LoaderCircle className="spin" size={18} /> : <Globe2 size={18} />} Načíst nabídku vrstev</button>
        {info && <div className="discovered-service"><div className="success-label"><Check size={17} /> Služba je dostupná</div><label>Vrstva<select value={selected} onChange={(e) => setSelected(e.target.value)}>{info.choices.map((c) => <option key={c.name} value={c.name}>{c.title} ({c.name})</option>)}</select></label><label>Použít jako<select value={kind} onChange={(e) => setKind(e.target.value as 'base' | 'overlay')}><option value="overlay">Datová vrstva nad mapou</option>{protocol !== 'WFS' && <option value="base">Podkladová mapa – určuje EPSG</option>}</select></label><button className="button primary" disabled={busy} onClick={() => { void addCustom(); }}>{busy ? <LoaderCircle className="spin" size={18} /> : <Plus size={18} />} Připojit vrstvu</button></div>}
        {error && <p className="inline-error" role="alert">{error}</p>}
        <p className="form-footnote">Vlastní služba musí povolovat přístup z prohlížeče (CORS). WMTS a WMS musí nabízet souřadnicový systém mapy; nekompatibilní vrstvu nepřipojíme.</p>
      </div>}
      <footer className="dialog-footer"><Globe2 size={16} /><span>Souřadnicový systém mapy <strong>{crs || 'načítání…'}</strong></span></footer>
    </div>
  </dialog>;
}
