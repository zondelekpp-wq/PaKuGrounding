# PaKuGrounding

Aplikacja PWA z narzędziami uziemiającymi (rodzina PaKu). Działa w pełni offline.
Języki: EN (domyślny), PL, DE, ES, FR, ZH, UK.

## Pliki
- `index.html` – układ i style
- `app.js` – logika aplikacji (na górze stałe: `APP_VERSION`, `CONTACT_EMAIL`, `BMC_URL`)
- `i18n.js` – wszystkie tłumaczenia (jeden blok na język)
- `sw.js` – service worker (pamięć offline). **Po każdej zmianie podbij tu `VERSION`**, żeby użytkownicy dostali aktualizację.
- `manifest.webmanifest`, `icon*.png`, `icon.svg`, `apple-touch-icon.png` – instalacja i ikony

## Publikacja na GitHub Pages
1. Utwórz repozytorium (np. `PaKuGrounding`) i wgraj wszystkie pliki (bez podfolderów).
2. Settings → Pages → Source: *Deploy from a branch* → `main` / `(root)`.
3. Aplikacja będzie pod adresem `https://<użytkownik>.github.io/PaKuGrounding/`.

Service worker działa tylko przez HTTPS (GitHub Pages to zapewnia) albo na `localhost`.
