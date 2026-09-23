# renateleeb.photos

Fotografie-Portfolio von Renate Leeb. Statisch gebaut, ausgeliefert von einem
Cloudflare Worker. Die Galerie kommt aus dem **Galerie-Kit** der cleebration-Kits;
Impressum und Datenschutz aus den cleebration-Rechtsvorlagen.

## Der kurze Weg

```bash
npm install
npm run images      # Originale aus hub/raw-media/ → hub/public/media/ (1600 px)
npm run build       # Feeds + Seiten → dist/
npm test            # Rauchtest (100+ Prüfungen)
npm run deploy      # baut und schiebt zu Cloudflare
```

## Was wo liegt

```
site.config.mjs        ← Domain, Kontaktadresse, Verweise. Der „Steckbrief".
content/pages.mjs      ← ALLE Texte der Seiten. Hier ändert man Inhalte.
src/styles.css         ← Design „Herbarium"
src/kontakt.js         ← Formular-Versand im Browser
scripts/build.mjs      ← Generator: Konfig + Texte + Feeds → dist/
worker/index.js        ← Weiterleitungen + POST /api/kontakt
module/gallery-widget.js ← Galerie-Modul (aus dem Kit, unverändert)
hub/                   ← Galerie-Hub aus dem Kit
  data/medien.csv      ← die 53 Bilder: Titel, Galerie, Tag, Dateiname
  galleries.config.js  ← Galerie- und Tag-Konfiguration
  raw-media/           ← Originale (bleiben lokal, NICHT im Repo)
  public/media/        ← verkleinerte Bilder (gehören ins Repo)
  public/feed/         ← erzeugte JSON-Feeds (gehören ins Repo)
test/smoke.mjs         ← Rauchtest über dist/ und den Worker
```

## Ein Bild hinzufügen oder tauschen

1. Original nach `hub/raw-media/` legen.
2. Zeile in `hub/data/medien.csv` ergänzen: Titel, Galerie `kuenstlernatur`,
   Tag `motiv` oder `collage`, Dateiname.
3. `npm run images && npm run build` — fertig. Committen nicht vergessen:
   **`hub/public/media/` und `hub/public/feed/` gehören ins Repo**, sonst baut
   Cloudflare ohne Bilder.

## Kontaktformular (über Zapier)

Der Worker nimmt das Formular unter `POST /api/kontakt` an, prüft Pflichtfelder,
Einwilligung und Honigtopf und schickt dann ein JSON an den Zapier-Webhook:

```json
{ "name": "…", "email": "…", "nachricht": "…", "betreff": "…",
  "empfaenger": "kontakt@renateleeb.photos", "quelle": "renateleeb.photos" }
```

Einrichtung, einmalig:

1. In Zapier einen Zap anlegen: Trigger **Webhooks by Zapier → Catch Hook**.
   Zapier zeigt eine Adresse `https://hooks.zapier.com/hooks/catch/…` — diese kopieren.
2. Als Aktion **Gmail → Send Email**: An `kontakt@renateleeb.photos`,
   Betreff `{{betreff}}`, Text `{{nachricht}}`, **Reply-To `{{email}}`** (damit ein
   „Antworten" direkt bei der Absenderin landet).
3. Die Adresse als Geheimnis hinterlegen und den Zap einschalten:

```bash
npx wrangler secret put FORM_WEBHOOK_URL
```

Alternative ohne Zapier: `RESEND_API_KEY` (+ `RESEND_FROM`) setzen, dann verschickt
der Worker direkt über Resend. Beides ist im Worker eingebaut; gesetzt wird nur eines.

Ohne eines von beiden antwortet das Formular mit einem klaren Fehler und dem
Hinweis auf die E-Mail-Adresse — es verschwindet nichts stillschweigend.

## Deployment

Cloudflare baut bei jedem Push, sobald das Repo im Dashboard verbunden ist
(Build-Befehl `npm run build`, Ausgabe `dist`). Die Domain wird erst nach dem
DNS-Umzug als `custom_domain` in `wrangler.jsonc` eingetragen.

## Umzug von Wix — was schon erledigt ist

- Texte von Start-, Über-mich- und Buchprojekte-Seite übernommen.
- Alte Wix-Adressen leiten weiter (`worker/index.js`, eine einzige Tabelle —
  bewusst nicht zusätzlich in `public/_redirects`, siehe die Lehre aus dem
  cleebration-Umzug: was zwei Schichten entscheiden können, geht schief).
- „Meine Buchprojekte" verweist auf renateundchris.com, statt die Buchseiten
  zu doppeln (kein Duplicate Content).
- Der Rauchtest prüft, dass nirgends mehr eine Wix-Adresse im Bestand steht.

### Offen

- DNS von Wix zu Cloudflare (Anleitung: „Domainumzug — der Ablauf").
- DKIM und DMARC für renateleeb.photos fehlen.
- Dubbles-Galerie: gehört auf renateundchris.com.

## Schriften

Cormorant Garamond (Überschriften) + Karla (Text), **von der eigenen Domain
ausgeliefert** — die woff2-Dateien liegen in `assets/fonts/`, die `@font-face`-Regeln
in `src/fonts.css`. Quelle sind die npm-Pakete `@fontsource/cormorant-garamond` und
`@fontsource/karla`; beim Aktualisieren die Dateien von dort neu kopieren.
Es wird nichts bei Google geladen — der Rauchtest prüft das.
