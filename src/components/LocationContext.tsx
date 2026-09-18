import { useState } from 'react';
import { Focus, LoaderCircle, MapPin, X } from 'lucide-react';

interface Props {
  status: string;
  accuracy?: number;
  outsideCoverage: boolean;
  source: 'link' | 'saved' | 'country';
  locate: () => void;
}
export function LocationContext({ status, accuracy, outsideCoverage, source, locate }: Props) {
  const [dismissed, setDismissed] = useState<string>();
  if (dismissed === status) return null;
  let title = source === 'link' ? 'Sdílený výřez mapy' : source === 'saved' ? 'Váš poslední výřez' : 'Přehled České republiky';
  let description = source === 'link' ? 'Pro okolí své polohy použijte zaměřovač.' : 'Kolečkem přibližte, tažením posuňte mapu.';
  if (status === 'locating') { title = 'Hledám vaši polohu'; description = 'Povolte polohu v prohlížeči. Mapu už můžete ovládat.'; }
  if (status === 'located') { title = 'Vaše poloha je označená'; description = outsideCoverage ? 'Jste mimo oblast pokrytí daty ČÚZK. Prohlédněte si mapu ČR.' : `Přesnost přibližně ± ${Math.max(1, Math.round(accuracy || 0)).toLocaleString('cs-CZ')} m. Zaměřovačem se vrátíte zpět.`; }
  if (status === 'denied') { title = 'Poloha není povolena'; description = 'Použijte hledání nebo povolte polohu v nastavení prohlížeče.'; }
  if (status === 'unavailable' || status === 'timeout') { title = 'Polohu se nepodařilo zjistit'; description = 'Můžete ji zkusit znovu nebo místo vyhledat.'; }
  return <div className={`location-context ${status}`} role="status">
    {status === 'locating' ? <LoaderCircle size={18} className="spin" /> : <MapPin size={18} />}
    <div><strong>{title}</strong><small>{description}</small></div>
    {status !== 'locating' && <button className="icon-button" title="Zaměřit moji polohu" aria-label="Zaměřit moji polohu" onClick={locate}><Focus size={17} /></button>}
    <button className="icon-button" title="Skrýt informaci o poloze" aria-label="Skrýt informaci o poloze" onClick={() => setDismissed(status)}><X size={15} /></button>
  </div>;
}
