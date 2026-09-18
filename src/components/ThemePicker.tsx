import { useEffect, useRef, useState } from 'react';
import { Check, Palette, X } from 'lucide-react';
import { applyTheme, readTheme, THEMES, type Theme } from '../theme';

export function ThemePicker() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(readTheme);
  const target = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const pointer = (event: PointerEvent) => { if (!target.current?.contains(event.target as Node)) setOpen(false); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', pointer); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', pointer); document.removeEventListener('keydown', key); };
  }, [open]);
  return <div className="theme-picker" ref={target}>
    <button ref={trigger} className="icon-button theme-trigger" title="Barevné téma" aria-label="Barevné téma" aria-expanded={open} aria-controls="theme-options" onClick={() => setOpen(!open)}><Palette size={21} /></button>
    {open && <div className="theme-popover" id="theme-options" role="region" aria-label="Výběr barevného tématu">
      <div className="theme-heading"><div><span className="eyebrow">PODLE VAŠEHO VKUSU</span><h2>Barvy vašeho světa</h2></div><button className="icon-button" aria-label="Zavřít výběr tématu" onClick={() => { setOpen(false); trigger.current?.focus(); }}><X size={17} /></button></div>
      <div className="theme-options">{THEMES.map((option) => <button key={option.id} aria-pressed={theme === option.id} onClick={() => { setTheme(option.id); applyTheme(option.id); }}><span className="theme-swatch" style={{ background: option.color }}>{theme === option.id && <Check size={18} />}</span><span><strong>{option.name}</strong><small>{option.description}</small></span>{theme === option.id && <span className="theme-selected">Vybráno</span>}</button>)}</div>
      <p>Vaše volba se uloží v tomto prohlížeči.</p>
    </div>}
  </div>;
}
