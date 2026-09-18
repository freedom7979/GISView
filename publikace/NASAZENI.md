# Jak GISView jednoduše zveřejnit

Pro toto statické demo je nejjednodušší ruční nasazení přes **Netlify Drop**. Není nutné nastavovat databázi ani API klíč. Níže uvedený postup vychází z [oficiálního návodu Netlify](https://docs.netlify.com/start/quickstarts/netlify-drop-quickstart/).

1. Otevřete [Netlify Drop](https://app.netlify.com/drop) a přihlaste se ke svému účtu (nebo si ho založte).
2. Přetáhněte do stránky složku **`D:\dev\GISView\dist`**. Alternativně použijte připravený archiv **`D:\dev\GISView\release\gisview-dist.zip`**, který obsahuje `index.html` přímo v kořeni.
3. Po nasazení dostanete veřejnou HTTPS adresu ve tvaru `https://…netlify.app`. V nastavení projektu lze upravit dostupný název.
4. Otevřete veřejnou adresu v anonymním okně a na telefonu. Zkontrolujte ortofoto, kolečko/gesta, výběr parcely a téma. Polohu povolujte až v prohlížeči; při odmítnutí aplikace funguje dál.
5. Veřejnou adresu vložte do připraveného příspěvku [LINKEDIN.md](LINKEDIN.md). Jako obrázek nahrajte `artifacts/desktop-graphite.png`; druhý snímek `artifacts/desktop-forest.png` ukáže barevná témata.

Nahrávejte **jen `dist` nebo distribuční ZIP**, nikoli celý projekt s `node_modules`. Aplikace už je sestavená. Ruční Netlify Drop nepouští vlastní build.

Při další změně spusťte `npm run build` a nahrajte nový obsah `dist` do sekce Deploys **stejného projektu**. Tím zachováte sdílený odkaz. Archiv znovu vytvoříte příkazem `npm run package`.

Pro pozdější automatické nasazování přes Git je připraven `netlify.toml` (`npm run build`, výstup `dist`, Node.js 24).

## Co bude veřejné a co zůstává lokální

- Veřejné budou sestavené HTML/CSS/JavaScript soubory aplikace a veřejné adresy mapových služeb. Nasazením se neposílají vaše lokální soubory mimo distribuční složku.
- Barevné téma, vrstvy a poslední výřez se ukládají v prohlížeči návštěvníka, ne do společné databáze.
- Geolokaci zprostředkuje prohlížeč až po udělení oprávnění. Aplikace nemá vlastní server sbírající polohy; navštívená oblast se ale promítne do požadavků na mapové služby ČÚZK.
- Data ČÚZK pokrývají Českou republiku. Pokud je návštěvník mimo ni, aplikace na omezení pokrytí upozorní.
- HTTPS je pro geolokaci na veřejném webu nutné. Netlify poskytne HTTPS adresu; viz také [MDN – Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API).
- Účet, limity a případné účtování se řídí aktuálním tarifem hostingu. Tento postup neobjednává placený tarif ani doménu.

V této úpravě je připraven build, archiv, snímky a text. Samotné veřejné nasazení ani odeslání příspěvku na LinkedIn nebylo provedeno.
