// ===========================================================================
//  Statischer Generator — ohne Abhängigkeiten, nur Node.
//  Quellen:  site.config.mjs (Werte)  ·  content/pages.mjs (Texte)
//            hub/public/feed + hub/public/media (Galerie, kommt aus dem Hub)
//  Ergebnis: dist/  — genau das, was Cloudflare ausliefert.
// ===========================================================================

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import site from "../site.config.mjs";
import * as C from "../content/pages.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const HUB_PUBLIC = path.join(ROOT, "hub", "public");

const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const FONTS = `<link rel="preload" as="font" type="font/woff2" crossorigin
  href="/assets/fonts/cormorant-garamond-latin-400-normal.woff2">
<link rel="preload" as="font" type="font/woff2" crossorigin
  href="/assets/fonts/karla-latin-400-normal.woff2">
<link rel="stylesheet" href="/fonts.css">`;

const NAV = [
  { href: "/kuenstlernatur/", label: "Künstlernatur" },
  { href: site.books.url, label: site.books.label, external: true },
  { href: "/ueber-mich/", label: "Über mich" },
  { href: "/kontakt/", label: "Kontakt" },
];

function masthead(current) {
  const links = NAV.map((n) => {
    const attrs = n.external
      ? ' target="_blank" rel="noopener"'
      : n.href === current
        ? ' aria-current="page"'
        : "";
    return `<a href="${esc(n.href)}"${attrs}>${esc(n.label)}</a>`;
  }).join("\n        ");
  return `<header class="mast"><div class="wrap mast-row">
      <a class="brand" href="/">Renate <span>Leeb</span></a>
      <input type="checkbox" id="navtoggle" class="nav-toggle" aria-label="Menü öffnen oder schließen">
      <label for="navtoggle" class="nav-burger" aria-hidden="true"><span></span><span></span><span></span></label>
      <nav class="mast-nav">
        ${links}
      </nav>
    </div></header>`;
}

function footer() {
  const year = new Date().getFullYear();
  return `<footer class="site"><div class="wrap frow">
      <span>© ${year} ${esc(site.author.name)} — Fotografie. Alle Rechte vorbehalten.</span>
      <nav>
        <a href="/impressum/">Impressum</a>
        <a href="/datenschutz/">Datenschutz</a>
        <a href="${esc(site.social.facebook)}" target="_blank" rel="noopener">Facebook</a>
        <a href="${esc(site.social.x)}" target="_blank" rel="noopener">X</a>
      </nav>
      <span class="credit">${esc(site.credit.text)}
        <a href="${esc(site.credit.url)}" target="_blank" rel="noopener">${esc(site.credit.label)}</a>
      </span>
    </div></footer>`;
}

function page({ url, title, description, body, head = "", bodyEnd = "" }) {
  const full = title ? `${title} | ${site.shortTitle}` : site.title;
  const canonical = site.siteUrl + url;
  return `<!doctype html>
<html lang="${site.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description || site.description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(full)}">
<meta property="og:description" content="${esc(description || site.description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:locale" content="de_AT">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
${FONTS}
<link rel="stylesheet" href="/styles.css">
${head}
</head>
<body>
${masthead(url)}
<main>
${body}
</main>
${footer()}
${bodyEnd}
</body>
</html>
`;
}

function write(url, html) {
  const dir = url === "/" ? DIST : path.join(DIST, url.replace(/^\/|\/$/g, ""));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html, "utf8");
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return 0;
  fs.mkdirSync(to, { recursive: true });
  let n = 0;
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const src = path.join(from, e.name), dst = path.join(to, e.name);
    if (e.isDirectory()) n += copyDir(src, dst);
    else { fs.copyFileSync(src, dst); n++; }
  }
  return n;
}

// --- Galerie-Daten (für Vorschau auf der Startseite) ------------------------
function galleryItems() {
  const f = path.join(HUB_PUBLIC, "feed", "galleries", "kuenstlernatur.json");
  if (!fs.existsSync(f)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(f, "utf8"));
    return Array.isArray(data) ? data : data.items || [];
  } catch { return []; }
}

// ===========================================================================
//  Seiten
// ===========================================================================

function startseite(items) {
  const preview = items.slice(0, 6).map((it) => {
    const img = it.image || "";
    return img
      ? `<a href="/kuenstlernatur/" aria-label="${esc(it.title || "Foto")}">
        <img src="${esc(img)}" alt="${esc(it.title || "")}" loading="lazy" width="600" height="600"></a>`
      : "";
  }).filter(Boolean).join("\n      ");

  return page({
    url: "/",
    title: "",
    description: site.description,
    body: `
<div class="wrap">
  <section class="hero">
    <p class="eyebrow">${esc(C.start.eyebrow)} — ${esc(C.start.title)}</p>
    <h1>${C.start.headline}</h1>
    <p class="lede">${C.start.lede}</p>
  </section>

  ${preview ? `<section class="band"><div class="strip">\n      ${preview}\n    </div></section>` : ""}

  <hr class="rule">

  <section>
    <div class="cards">
      <a class="card" href="/kuenstlernatur/">
        <h3>Künstlernatur · Naturkünstler</h3>
        <p>${items.length || 53} Arbeiten: Makroaufnahmen und Collagen von Blüten, Blättern und Wasser.</p>
        <span class="more">Zur Galerie →</span>
      </a>
      <a class="card" href="${esc(site.books.url)}" target="_blank" rel="noopener">
        <h3>Buchprojekte</h3>
        <p>Drei Bildbände mit Chris H. Leeb: <em>MeerDeutig</em>, <em>Liebesrauschend</em>, <em>SeenSüchtig</em> — Fotos von mir, Texte von ihm.</p>
        <span class="more">Zu renateundchris.com →</span>
      </a>
      <a class="card" href="/ueber-mich/">
        <h3>Über mich</h3>
        <p>Lehrerin für Mathematik und Psychologie/Philosophie — und Fotografin aus Leidenschaft.</p>
        <span class="more">Mehr lesen →</span>
      </a>
    </div>
  </section>
</div>`,
  });
}

function galerieseite() {
  const lk = C.galerie.lockup;
  return page({
    url: "/kuenstlernatur/",
    title: C.galerie.title,
    description: C.galerie.lede,
    head: `<script type="module" src="/gallery-widget.js"></script>`,
    body: `
<div class="wrap">
  <section class="hero">
    <p class="eyebrow">${esc(site.author.name)} — Naturfotografie</p>
    <h1 class="lockup">
      <span class="l1">${lk.l1[0]}<span class="dot">·</span>${lk.l1[1]}</span>
      <span class="l2">${lk.l2[0]}<span class="dot">·</span>${lk.l2[1]}</span>
    </h1>
    <p class="lede">${C.galerie.lede}</p>
  </section>

  <section>
    <gallery-grid feed="${esc(site.galleryFeed)}" gallery="kuenstlernatur" filter="on"></gallery-grid>
  </section>
</div>`,
  });
}

function uebermich() {
  return page({
    url: "/ueber-mich/",
    title: C.ueberMich.title,
    description: C.ueberMich.lede,
    body: `
<div class="wrap">
  <section class="hero">
    <p class="eyebrow">${esc(site.author.name)}</p>
    <h1>Über <em>mich</em></h1>
  </section>
  <section class="portrait-row">
    <figure>
      <img src="${esc(C.ueberMich.portrait)}" alt="Renate Leeb" width="1200" height="1500" loading="lazy">
      <figcaption>Renate Leeb</figcaption>
    </figure>
    <div class="read">
      ${C.ueberMich.body}
      <blockquote class="pull">${C.ueberMich.pullquote}</blockquote>
    </div>
  </section>
</div>`,
  });
}

function kontaktseite() {
  return page({
    url: "/kontakt/",
    title: C.kontakt.title,
    description: C.kontakt.lede,
    body: `
<div class="wrap">
  <section class="hero hero--schmal">
    <p class="eyebrow">${esc(site.author.name)}</p>
    <h1>Schreib <em>mir</em></h1>
    <p class="lede">${C.kontakt.lede}</p>
  </section>
  <section class="kontakt-row">
    <form class="kontakt" id="kontaktform" method="post" action="/api/kontakt" novalidate>
      <div class="feldpaar">
        <p class="feld">
          <label for="k-name">Name</label>
          <input id="k-name" name="name" type="text" autocomplete="name" required maxlength="120">
        </p>
        <p class="feld">
          <label for="k-mail">E-Mail</label>
          <input id="k-mail" name="email" type="email" autocomplete="email" required maxlength="200">
        </p>
      </div>

      <p class="feld">
        <label for="k-text">Nachricht</label>
        <textarea id="k-text" name="nachricht" required maxlength="5000"
          placeholder="Worum geht es?"></textarea>
      </p>

      <div class="hp" aria-hidden="true">
        <label for="k-web">Website (bitte frei lassen)</label>
        <input id="k-web" name="website" type="text" tabindex="-1" autocomplete="off">
      </div>

      <label class="consent">
        <input type="checkbox" name="einwilligung" value="ja" required>
        <span>Ich bin einverstanden, dass meine Angaben zur Beantwortung meiner Anfrage
          verarbeitet werden. Details in der <a href="/datenschutz/">Datenschutzerklärung</a>.</span>
      </label>

      <div class="aktionen">
        <button class="send" type="submit">Nachricht senden</button>
        <p class="formnote" id="k-note" role="status" aria-live="polite"></p>
      </div>
    </form>

    <aside class="kontakt-aside">
      <div class="block">
        <span class="label">Direkt schreiben</span>
        <a href="mailto:${esc(site.contactEmail)}">${esc(site.contactEmail)}</a>
      </div>
      <div class="block">
        <span class="label">Bilder</span>
        <p>Alle Fotos sind Arbeiten von Renate Leeb. Für Ausstellungen, Abzüge oder
          Veröffentlichungen einfach anfragen.</p>
      </div>
      <div class="block">
        <span class="label">Auch dort</span>
        <span class="links">
          <a href="${esc(site.social.facebook)}" target="_blank" rel="noopener">Facebook</a>
          <a href="${esc(site.social.x)}" target="_blank" rel="noopener">X</a>
          <a href="${esc(site.books.url)}" target="_blank" rel="noopener">Buchprojekte</a>
        </span>
      </div>
    </aside>
  </section>
</div>`,
    bodyEnd: `<script src="/kontakt.js" defer></script>`,
  });
}

function impressum() {
  const o = site.owner;
  return page({
    url: "/impressum/",
    title: "Impressum",
    description: "Impressum gemäß § 5 ECG und § 25 Mediengesetz.",
    body: `
<div class="wrap">
  <section class="hero hero--schmal"><h1>Impressum</h1>
    <p class="lede">Angaben gemäß § 5 ECG (E-Commerce-Gesetz) und § 25 Mediengesetz (Österreich)</p>
  </section>
  <section class="read rechtstext">
    <h3>Medieninhaber &amp; verantwortlich für den Inhalt</h3>
    <p>${esc(o.name)}<br>${esc(o.street)}<br>${esc(o.zip)} ${esc(o.city)}<br>${esc(o.country)}</p>

    <h3>Kontakt</h3>
    <p>E-Mail: <a href="mailto:${esc(site.contactEmail)}">${esc(site.contactEmail)}</a></p>

    <h3>Art der Website</h3>
    <p>${C.artDerWebsite}</p>

    <h3>Blattlinie (§ 25 MedienG)</h3>
    <p>${C.blattlinie}</p>

    <h3>Urheberrecht</h3>
    <p>Alle Fotografien auf dieser Website stammen von ${esc(site.author.name)} und sind
      urheberrechtlich geschützt. Auch Texte und Gestaltung sind geschützt. Eine Verwertung
      außerhalb der gesetzlich erlaubten Fälle bedarf der vorherigen Zustimmung.
      Das cleebration-Logo ist Eigentum von cleebration (www.cleebration.com).</p>

    <h3>Haftung für Inhalte</h3>
    <p>Die Inhalte wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit
      und Aktualität wird jedoch keine Gewähr übernommen.</p>

    <h3>Haftung für Links</h3>
    <p>Diese Website enthält Links zu externen Websites Dritter, auf deren Inhalte kein Einfluss
      besteht. Für diese fremden Inhalte wird keine Gewähr übernommen. Verantwortlich ist stets
      der jeweilige Anbieter der verlinkten Seiten.</p>

    <h3>Online-Streitbeilegung</h3>
    <p>${C.osbHinweis}</p>
  </section>
</div>`,
  });
}

function datenschutz() {
  const o = site.owner;
  const stand = new Date().toLocaleDateString("de-AT", { month: "long", year: "numeric" });
  return page({
    url: "/datenschutz/",
    title: "Datenschutzerklärung",
    description: "Datenschutzerklärung gemäß DSGVO und österreichischem DSG.",
    body: `
<div class="wrap">
  <section class="hero hero--schmal"><h1>Datenschutzerklärung</h1>
    <p class="lede">Gemäß Datenschutz-Grundverordnung (DSGVO) und österreichischem Datenschutzgesetz (DSG)</p>
  </section>
  <section class="read rechtstext">
    <h3>1. Verantwortlicher</h3>
    <p>${esc(o.name)}, ${esc(o.street)}, ${esc(o.zip)} ${esc(o.city)}, ${esc(o.country)} ·
      <a href="mailto:${esc(site.contactEmail)}">${esc(site.contactEmail)}</a></p>

    <h3>2. Grundsätzliches</h3>
    <p>Der Schutz deiner persönlichen Daten ist uns wichtig. Wir verarbeiten personenbezogene
      Daten nur im notwendigen Umfang und auf Grundlage der gesetzlichen Bestimmungen. Diese
      Erklärung informiert dich über Art, Umfang und Zweck der Verarbeitung sowie über deine Rechte.</p>

    <h3>3. Hosting (Cloudflare)</h3>
    <p>Diese Website wird von Cloudflare, Inc. (101 Townsend St., San Francisco, CA 94107, USA)
      ausgeliefert. Beim Aufruf werden technisch notwendige Daten verarbeitet: IP-Adresse, Datum
      und Uhrzeit, aufgerufene Datei, Browsertyp, Betriebssystem und Referrer-URL. Diese Daten
      dienen ausschließlich dem technischen Betrieb und der Sicherheit (Art. 6 Abs. 1 lit. f DSGVO).
      Da Cloudflare Daten auch in den USA verarbeiten kann, stützt sich die Übermittlung auf die
      EU-Standardvertragsklauseln. Details: cloudflare.com/privacypolicy.</p>

    <h3>4. Cookies / Speicherung</h3>
    <p>Diese Website setzt keine Cookies, verwendet keine Tracking- oder Marketing-Dienste und
      bindet keine Analyse-Werkzeuge ein.</p>

    <h3>5. Schriftarten</h3>
    <p>Die verwendeten Schriften (Cormorant Garamond und Karla) liegen auf demselben
      Server wie diese Website und werden von dort ausgeliefert. Es besteht keine
      Verbindung zu Google Fonts oder einem anderen Schriftanbieter.</p>

    <h3>6. Kontaktformular und E-Mail</h3>
    <p>Wenn du das Kontaktformular verwendest, verarbeiten wir Name, E-Mail-Adresse und den Text
      deiner Nachricht, um die Anfrage zu beantworten (Art. 6 Abs. 1 lit. a und f DSGVO). Die
      Übermittlung läuft über unseren Server bei Cloudflare; die Nachricht landet anschließend in
      unserem E-Mail-Postfach bei Google Workspace (Google Ireland Limited). Die Daten werden
      gelöscht, sobald sie nicht mehr benötigt werden. Dasselbe gilt für Anfragen, die du direkt
      per E-Mail schickst.</p>

    <h3>7. Externe Links &amp; Social Media</h3>
    <p>Diese Website verlinkt auf externe Seiten (Facebook, X, renateundchris.com, cleebration.com).
      Beim Anklicken gelangst du auf Seiten Dritter, für deren Datenverarbeitung der jeweilige
      Anbieter verantwortlich ist. Die Verweise sind reine Verlinkungen und laden keine
      Tracking-Skripte.</p>

    <h3>8. Deine Rechte</h3>
    <p>Dir stehen nach der DSGVO folgende Rechte zu: Auskunft (Art. 15), Berichtigung (Art. 16),
      Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20),
      Widerspruch (Art. 21) und Widerruf erteilter Einwilligungen (Art. 7 Abs. 3). Zur Ausübung
      genügt eine Nachricht an die oben genannte E-Mail-Adresse.</p>

    <h3>9. Beschwerderecht</h3>
    <p>Wenn du der Ansicht bist, dass die Verarbeitung deiner Daten gegen das Datenschutzrecht
      verstößt, kannst du dich bei der österreichischen Datenschutzbehörde beschweren:
      Österreichische Datenschutzbehörde, Barichgasse 40–42, 1030 Wien —
      <a href="https://www.dsb.gv.at" target="_blank" rel="noopener">www.dsb.gv.at</a></p>

    <h3>10. Aktualität</h3>
    <p>Diese Datenschutzerklärung wird angepasst, sobald sich die Datenverarbeitung ändert.
      Stand: ${esc(stand)}</p>
  </section>
</div>`,
  });
}

function notFound() {
  return page({
    url: "/404/",
    title: "Seite nicht gefunden",
    description: "Diese Seite gibt es nicht (mehr).",
    body: `
<div class="wrap">
  <section class="hero">
    <h1>Hier ist <em>nichts</em></h1>
    <p class="lede">Diese Seite gibt es nicht (mehr). Vielleicht hilft die
      <a href="/kuenstlernatur/">Galerie</a> oder die <a href="/">Startseite</a>.</p>
  </section>
</div>`,
  });
}

function sitemap(urls) {
  const now = new Date().toISOString().slice(0, 10);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${site.siteUrl}${u}</loc><lastmod>${now}</lastmod></url>`).join("\n")}
</urlset>
`;
}

// ===========================================================================
//  Lauf
// ===========================================================================

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

const items = galleryItems();

write("/", startseite(items));
write("/kuenstlernatur/", galerieseite());
write("/ueber-mich/", uebermich());
write("/kontakt/", kontaktseite());
write("/impressum/", impressum());
write("/datenschutz/", datenschutz());
fs.writeFileSync(path.join(DIST, "404.html"), notFound(), "utf8");

// statische Dateien
fs.copyFileSync(path.join(ROOT, "src", "styles.css"), path.join(DIST, "styles.css"));
fs.copyFileSync(path.join(ROOT, "src", "fonts.css"), path.join(DIST, "fonts.css"));
fs.copyFileSync(path.join(ROOT, "src", "kontakt.js"), path.join(DIST, "kontakt.js"));
fs.copyFileSync(path.join(ROOT, "module", "gallery-widget.js"), path.join(DIST, "gallery-widget.js"));
const nAssets = copyDir(path.join(ROOT, "assets"), path.join(DIST, "assets"));
const nFeed = copyDir(path.join(HUB_PUBLIC, "feed"), path.join(DIST, "feed"));
const nMedia = copyDir(path.join(HUB_PUBLIC, "media"), path.join(DIST, "media"));

const urls = ["/", "/kuenstlernatur/", "/ueber-mich/", "/kontakt/", "/impressum/", "/datenschutz/"];
fs.writeFileSync(path.join(DIST, "sitemap.xml"), sitemap(urls), "utf8");
fs.writeFileSync(
  path.join(DIST, "robots.txt"),
  `User-agent: *\nAllow: /\nSitemap: ${site.siteUrl}/sitemap.xml\n`,
  "utf8",
);

console.log(
  `OK  ${urls.length} Seiten + 404 · ${nFeed} Feed-Datei(en) · ${nMedia} Bild(er) · ${nAssets} Asset(s)` +
    (items.length ? ` · ${items.length} Medien im Feed` : " · ⚠ Feed leer (hub bauen!)"),
);
