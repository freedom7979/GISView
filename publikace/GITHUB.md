# Publikování GISView na GitHubu

Projekt je připraven tak, aby GitHub obsahoval zdrojový kód i funkční webovou aplikaci přes GitHub Pages.

## Jednorázově v GitHubu

1. Přihlaste se na [github.com/new](https://github.com/new).
2. Do názvu zadejte `GISView`.
3. Zvolte **Public**. README, `.gitignore` ani licenci při vytvoření nepřidávejte; README už je v projektu.
4. Klikněte na **Create repository**.
5. V novém repozitáři otevřete **Settings → Pages** a jako zdroj zvolte **GitHub Actions**.

## Odeslání připraveného projektu

V PowerShellu:

```powershell
cd D:\dev\GISView
git init -b main
git add .
git commit -m "Create GISView GIS viewer"
git remote add origin https://github.com/<uživatel>/GISView.git
git push -u origin main
```

Při `git push` GitHub otevře přihlášení. Použijte GitHub účet, který vlastní vytvořený repozitář; heslo se neukládá do projektu. Pokud máte nastavený SSH klíč, můžete místo HTTPS použít `git@github.com:<uživatel>/GISView.git`.

Po pushi otevřete **Actions** a počkejte na workflow **Build and deploy GISView**. První publikace obvykle trvá několik minut. Adresu stránky najdete v **Settings → Pages** nebo v detailu dokončeného workflow.

## Aktualizace

Po změně kódu:

```powershell
npm run build
git add .
git commit -m "Describe the change"
git push
```

GitHub Actions znovu sestaví `dist` a publikuje novou verzi. Složka `node_modules`, testovací snímky a distribuční ZIP se do repozitáře neposílají; výsledný web se sestavuje z `src` na GitHubu.

## Když nechcete GitHub Pages

Můžete ponechat pouze repozitář a nahrát `dist` na Netlify podle [NASAZENI.md](NASAZENI.md). GitHub Pages workflow v repozitáři zůstane neškodný, dokud Pages nezapnete.
