import type { LayerSpec } from './types';

const ags = 'https://ags.cuzk.gov.cz';
const services = 'https://services.cuzk.gov.cz';
export const CATALOG: LayerSpec[] = [
  { id: 'ortho', title: 'Ortofoto ČR', description: 'Česko z ptačí perspektivy. Aktuální letecké snímky v přirozených barvách.', protocol: 'Esri', url: `${ags}/arcgis1/rest/services/ORTOFOTO/MapServer`, kind: 'base', tone: 'forest' },
  { id: 'ztm', title: 'Základní topografická mapa', description: 'Přehledná mapa krajiny, sídel, cest a vodních toků.', protocol: 'Esri', url: `${ags}/arcgis1/rest/services/ZTM/MapServer`, kind: 'base', tone: 'sand' },
  { id: 'parcels', title: 'Parcely · RÚIAN', description: 'Hranice parcel a jejich údaje. Zobrazení při přiblížení pod 1 : 15 000.', protocol: 'Esri', url: `${ags}/arcgis/rest/services/RUIAN/MapServer`, layerNames: ['5'], kind: 'overlay', tone: 'peach' },
  { id: 'buildings', title: 'Budovy · RÚIAN', description: 'Stavební objekty s možností výběru a prohlížení vlastností.', protocol: 'Esri', url: `${ags}/arcgis/rest/services/RUIAN/MapServer`, layerNames: ['3'], kind: 'overlay', tone: 'rose' },
  { id: 'addresses', title: 'Adresní místa', description: 'Adresní body RÚIAN. Přibližte mapu pod 1 : 2 500.', protocol: 'Esri', url: `${ags}/arcgis/rest/services/RUIAN/MapServer`, layerNames: ['1'], kind: 'overlay', tone: 'lavender' },
  { id: 'csu-addresses', title: 'Adresní body · ČSÚ RSO', description: 'Definiční body adresních míst s územními identifikacemi a atributy adresy.', protocol: 'Esri', url: 'https://geodata.csu.gov.cz/server/rest/services/Hosted/Open_data_RSO/FeatureServer/1', kind: 'overlay', tone: 'mint' },
  { id: 'boundaries', title: 'Katastrální území', description: 'Hranice a názvy katastrálních území z registru RÚIAN.', protocol: 'Esri', url: `${ags}/arcgis/rest/services/RUIAN/MapServer`, layerNames: ['7'], kind: 'overlay', tone: 'mint' },
  { id: 'zabaged', title: 'ZABAGED® · polohopis', description: 'Podrobná geografická databáze České republiky.', protocol: 'Esri', url: `${ags}/arcgis/rest/services/ZABAGED_POLOHOPIS/MapServer`, kind: 'overlay', tone: 'sand' },
  { id: 'kn-wms', title: 'Katastrální mapa', description: 'Oficiální kresba katastru nemovitostí. Detail je dostupný po přiblížení.', protocol: 'WMS', url: `${services}/wms/local-km-wms.asp`, layerNames: ['KN'], kind: 'overlay', tone: 'peach' },
  { id: 'ortho-wmts', title: 'Ortofoto ČR · WMTS', description: 'Letecké snímky jako dlaždicová služba v S-JTSK.', protocol: 'WMTS', url: `${ags}/arcgis1/rest/services/ORTOFOTO/MapServer/WMTS/1.0.0/WMTSCapabilities.xml`, layerNames: ['ORTOFOTO'], kind: 'base', tone: 'forest' },
  { id: 'parcels-wfs', title: 'Parcely · INSPIRE', description: 'Vektorové parcely WFS. Přibližte na malou oblast a vyberte prvek přímo v mapě.', protocol: 'WFS', url: `${services}/wfs/inspire-cp-wfs.asp`, layerNames: ['cp:CadastralParcel'], kind: 'overlay', tone: 'lavender' },
];

export const PLACES = [
  { name: 'Praha', detail: 'Hlavní město · Vltava a Staré Město', coordinates: [14.4145, 50.0885] },
  { name: 'Brno', detail: 'Jihomoravský kraj', coordinates: [16.608, 49.195] },
  { name: 'Ostrava', detail: 'Moravskoslezský kraj', coordinates: [18.292, 49.835] },
  { name: 'Plzeň', detail: 'Plzeňský kraj', coordinates: [13.378, 49.747] },
  { name: 'Olomouc', detail: 'Olomoucký kraj', coordinates: [17.252, 49.594] },
  { name: 'Liberec', detail: 'Liberecký kraj', coordinates: [15.056, 50.769] },
  { name: 'České Budějovice', detail: 'Jihočeský kraj', coordinates: [14.474, 48.975] },
  { name: 'Hradec Králové', detail: 'Královéhradecký kraj', coordinates: [15.832, 50.21] },
];
