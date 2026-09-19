# GISView

Webový prohlížeč GIS služeb v češtině. React s hooks, TypeScript, OpenLayers a Vite. Rozhraní inspirované Google Material 3 Expressive: výchozí grafitové téma v odstínech černé, volitelná zelená, modrá, fialová a písková, zaoblené panely a responzivní ovládání.

## Spuštění

Projekt je v `D:\dev\GISView`. Závislosti jsou nainstalované a produkční aplikace je sestavená v `dist`.

```powershell
cd D:\dev\GISView
npm start
```

Otevřete **http://127.0.0.1:4173**. `npm start` / `npm run preview` spouští lokální náhled hotové složky `dist`.

Pro vývoj s automatickým obnovením:

```powershell
npm run dev
```

Vývojová adresa je **http://127.0.0.1:5173**.

Nové sestavení:

```powershell
npm run build
```

Na jiném počítači nejprve spusťte `npm ci`. Doporučeno Node.js 24 LTS; projekt byl sestaven na Node.js 24.19.0. Přesné verze závislostí jsou v `package-lock.json`.

## Funkce

- Výchozí **Ortofoto ČR přes Esri** v S-JTSK / EPSG:5514 a průhledná vrstva parcel RÚIAN.
- Katalog deseti připojení ČÚZK: ortofoto, základní topografická mapa, parcely, budovy, adresy, katastrální území, ZABAGED, katastrální WMS, ortofoto WMTS a INSPIRE parcely WFS.
- Připojení vlastní veřejné služby Esri MapServer, WMS, WMTS nebo WFS; nabídka vrstev se čte z metadat / GetCapabilities.
- Zapínání, vypínání, krytí, pořadí, obnovení a odebrání datových vrstev.
- Výběr prvku, zvýraznění geometrie, tabulka vlastností, přechod mezi výsledky, přiblížení na prvek a export vlastností do JSON.
- Esri Identify; WMS GetFeatureInfo pro dotazovatelné vrstvy; výběr lokálně načtených vektorů WFS.
- Živé adresní body RSO z ČSÚ jako vektorová vrstva ArcGIS FeatureServeru v JTSK, včetně atributů adresních a územních identifikací.
- Vyhledávání měst, adresních míst RÚIAN přes službu ČÚZK a GPS souřadnic `délka, šířka` (např. `14.42, 50.09`) nebo s hemisférami `48.9510717N, 14.5156139E`. GPS se při navigaci převede do EPSG aktuálního podkladu.
- Přiblížení kolečkem a posun prvním tahem bez předchozího kliknutí/fokusu. Tlačítka +/−, dotyková gesta, celá ČR, sever, měřítko a souřadnice kurzoru.
- Automatické zjištění polohy po souhlasu prohlížeče, modrá značka a oblast přesnosti. Opožděná poloha nepřesune mapu po ruční navigaci; tlačítko Moje poloha znovu zaměří okolí.
- Uložení skladby vrstev, barevného tématu a posledního výřezu v localStorage. Sdílení odkazu na aktuální výřez mapy; odkaz nepřenáší skladbu vrstev.
- Pořadí úvodního výřezu: platný sdílený odkaz má přednost před polohou, jinak se zobrazí poslední výřez nebo celá ČR a po povolení polohy skutečné okolí. Při zamítnutí / chybě geolokace lze mapu dál ovládat a použít hledání.
- Mobilní rozhraní; katalog a informace používají nativní dialog s ovládáním klávesnicí.

## Souřadnicové systémy

Souřadnicový systém mapy se **odvozuje od podkladové služby**. Esri poskytne svůj `spatialReference`; u OGC služeb se vybírá z jejich nabídky, přednostně EPSG:5514. Při změně podkladu se nejprve ověří všechny připojené vrstvy. Pokud je některá nekompatibilní, zůstane původní kompozice zachovaná a aplikace vysvětlí chybu.

- **Esri**: u odpovídajícího nativního CRS se používá dlaždicová cache s originem a rozlišeními z metadat. U jednotlivých podvrstev a odlišného CRS se používá serverové `export` s `bboxSR` a `imageSR` mapy.
- **WMS**: vybraný CRS musí být uveden v capabilities. OpenLayers nastaví CRS/SRS a pořadí os podle verze služby.
- **WMTS**: vybírá se skutečná dlaždicová matice daného CRS. Aplikace nepředstírá, že lze dlaždice libovolně vyžádat v jiném EPSG.
- **WFS**: vybírá se podporovaný SRSNAME a BBOX v CRS mapy; respektuje se pořadí os. Podporované odpovědi jsou GeoJSON a GML podle verze WFS. INSPIRE GML 3.2 z ČÚZK je ověřeno na živých datech.

Zaregistrovány jsou EPSG:5514, 3857, 4326, 4258, 32633, 32634 a 25833; Esri 102067 se normalizuje na 5514, 102100/102113/900913 na 3857. Další projekce lze přidat v `src/gis/projections.ts`. Převod WGS 84 ↔ S-JTSK používá parametrickou transformaci Proj4 pro navigaci v mapě, nikoli přesnou geodetickou transformaci s korekční mřížkou. Vrstvy v samotném EPSG:5514 se zobrazují bez tohoto převodu.

## Nasazení a provoz

Pro ruční zveřejnění přes Netlify Drop je připraven [návod](publikace/NASAZENI.md), [návrh příspěvku na LinkedIn](publikace/LINKEDIN.md) a archiv `release/gisview-dist.zip`. Obnovíte ho příkazem `npm run package` (Windows / PowerShell). Pro nasazování z Gitu je připraven `netlify.toml`.

Repozitář obsahuje také `.github/workflows/deploy-pages.yml`. Po každém pushi do `main` se automaticky sestaví a zveřejní webová aplikace přes GitHub Pages.

**Živá aplikace:** [freedom7979.github.io/GISView](https://freedom7979.github.io/GISView/)

Celý obsah **`dist`** lze umístit na statický HTTP(S) server, včetně podadresáře. Není potřebná databáze, přístupový klíč ani vlastní backend. Vestavěné písmo se servíruje z aplikace. Náhled Vite je určen pro lokální ověření; na veřejný provoz použijte běžný statický hosting, IIS, nginx apod.

Nespouštějte `dist/index.html` přímo přes `file://`; aplikace potřebuje HTTP(S). Online mapy vyžadují připojení k internetu. Vlastní služby musí mít správně nastavené CORS; pod HTTPS musí být dostupné přes HTTPS. Ověřené služby ČÚZK CORS umožňují. Aplikace nevkládá cizí HTML do stránky; odpovědi GetFeatureInfo zobrazí bezpečně jako text.

Některé vrstvy jsou dostupné až v určitých měřítkách (např. adresní místa RÚIAN pod 1 : 2 500). WFS se načítá až při rozlišení nejvýše 3 m/px, po výřezech a maximálně 1 000 prvků. Při dosažení limitu aplikace vyzve k přiblížení. Rastrové ortofoto ani samotné WMTS dlaždice neposkytují atributy jednotlivých objektů; pro výběr připojte RÚIAN, dotazovatelný WMS nebo WFS.

## Ověření

```powershell
npm test
npx playwright install chromium
npm run build
npm run test:e2e
```

Jednotkové testy ověřují normalizaci CRS, pořadí os, transformace, odmítnutí nekompatibilních vrstev, dědičnost WMS, WFS namespace a OGC chybové odpovědi. Testy Playwright pracují se skutečnými službami ČÚZK: Esri výběr a export, ukládání kompozice, WMS/WMTS, výběr parcel WFS, přechod podkladu do EPSG:3857 a mobilní rozhraní. Dále ověřují kolečko před prvním kliknutím i po hledání, posun do čtyř směrů, tlačítka zoomu, přepínání a uložení témat, povolenou/odmítnutou/opožděnou geolokaci a přednost sdíleného odkazu. Geolokace v testech je simulovaná (Brno); nepoužívá osobní polohu vývojáře. Testy vyžadují dostupné služby a internet; jejich případný výpadek může způsobit selhání testů.

Snímky ověřeného rozhraní se ukládají do `artifacts`.

## Struktura

```text
src/
  App.tsx                   Rozhraní aplikace
  catalog.ts                Katalog zdrojů ČÚZK a místa
  hooks/useMap.ts            Životní cyklus mapy a React hooks
  hooks/useLocation.ts       Poloha a ochrana před opožděným přesunem
  gis/navigation.ts         Výchozí výřez, ukládání a zachování měřítka
  gis/projections.ts        Projekce a pořadí os
  gis/services.ts           Načítání metadat / capabilities
  gis/layers.ts             Adaptéry Esri, WMS, WMTS, WFS
  gis/identify.ts           Identifikace prvků
  components/               Dialog připojení vrstev
  styles.css                Responzivní vizuální styl
  themes.css                Barevné tokeny a pět témat
  theme.ts                  Ukládání volby tématu
tests/                      Jednotkové a prohlížečové testy
dist/                       Hotové produkční soubory
release/                    Archiv pro ruční nasazení
publikace/                  Postup zveřejnění a příspěvek LinkedIn
```

## Oficiální zdroje

- [Esri Ortofoto ČR / ČÚZK](https://ags.cuzk.gov.cz/arcgis1/rest/services/ORTOFOTO/MapServer)
- [Esri služby ČÚZK](https://ags.cuzk.gov.cz/arcgis/rest/services)
- [Ověření adresy VDP k RÚIAN](https://vdp.cuzk.gov.cz/vdp/ruian/overeniadresy)
- [Vyhledávací služba RÚIAN GeocodeSOE](https://ags.cuzk.gov.cz/arcgis/rest/services/RUIAN/MapServer/exts/GeocodeSOE)
- [ČSÚ RSO – Adresní místa (FeatureServer)](https://geodata.csu.gov.cz/server/rest/services/Hosted/Open_data_RSO/FeatureServer/1)
- [Mapové služby ČÚZK a podmínky poskytování](https://services.cuzk.gov.cz/)
- [OpenLayers](https://openlayers.org/)
- [Material Design 3](https://m3.material.io/)

Mapová data a služby mají vlastní podmínky poskytování ČÚZK. Atribuce je zobrazena přímo v mapě.
