# Návrh příspěvku na LinkedIn

Níže je text k vložení. Nahraďte `[ODKAZ NA APLIKACI]` veřejnou HTTPS adresou po nasazení. Přiložte `artifacts/desktop-graphite.png`, případně i `artifacts/desktop-forest.png`. Snímky ukazují veřejný mapový výřez Prahy, nikoli vaši aktuální polohu.

---

Dvě zadání v češtině. A mezi nimi funkční GIS aplikace. 🗺️

Chtěl jsem si vyzkoušet, kam se posunul vývoj s GPT‑6 Astra v Codexu. Zadal jsem konkrétní úkol: webový prohlížeč dat ČÚZK na Reactu a OpenLayers, s podporou WMS, WMTS, WFS a Esri služeb.

Výsledek? GISView. Aplikace, ve které můžu:

• prohlížet Ortofoto ČR a přidávat další mapové vrstvy,
• kliknout na parcelu a zobrazit její vlastnosti,
• skládat vrstvy, měnit jejich pořadí a průhlednost,
• pracovat v S‑JTSK se souřadnicovým systémem odvozeným od podkladu,
• zobrazit své okolí po povolení polohy,
• přepnout mezi grafitovým a dalšími barevnými tématy.

Prvním zadáním jsem popsal aplikaci. Druhým jsem doladil ovládání, polohu a vzhled. Astra mezitím psala kód, ověřovala skutečné služby ČÚZK, spouštěla testy a sestavila aplikaci pro nasazení.

Nejvíc mě zaujalo, že se řešily i detaily: pořadí souřadnicových os, kompatibilita vrstev, omezení WFS a chování mapy při opožděném zjištění polohy.

Je to funkční prototyp a konkrétní zkušenost z jednoho projektu. Pro mě velmi přesvědčivá ukázka toho, jak rychle se dá převést jasné zadání do aplikace, kterou si člověk může skutečně vyzkoušet.

Vyzkoušejte GISView: [ODKAZ NA APLIKACI]

Na čem byste podobný postup otestovali vy?

#GPT6Astra #OpenAI #Codex #GIS #OpenLayers #React #OtevrenaData

---

Poznámka k přesnosti formulace: „dvě zadání“ znamená dvě věcná zadání uživatele (vytvoření a následné úpravy). Mezi nimi proběhlo také pokračování práce a mnoho interních kroků, oprav a testů. Nejde o tvrzení, že libovolná aplikace vznikne spolehlivě na dvě jednotlivá API volání.

Název modelu ověřen podle [oficiální dokumentace GPT‑6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra). Příspěvek ani aplikace nejsou prezentovány jako oficiální produkt OpenAI nebo ČÚZK.
