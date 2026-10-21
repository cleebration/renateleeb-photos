/*
 * gallery-widget.js
 * Einbettbares Galerie-Modul als Web-Components – funktioniert auf jeder Seite
 * (statisches HTML, Astro, Next, sogar als Notlösung in Wix-HTML-Embeds).
 * Stil-isoliert per Shadow DOM, komplett über CSS-Variablen (--gal-*) themebar.
 * Keine Abhängigkeiten. Fotos UND Videos (YouTube/Vimeo/Datei).
 *
 * Einbetten (Übersicht mit eingebautem Lightbox):
 *   <script type="module" src="/gallery-widget.js"></script>
 *   <gallery-grid feed="https://DEIN-HUB.vercel.app/feed/sites/cleebration.json">
 *   </gallery-grid>
 *
 * Nur eine bestimmte Galerie zeigen:
 *   <gallery-grid feed="…/sites/cleebration.json" gallery="ausstellung-2024">
 *
 * Mit Tag-Filterleiste und eigenen Detailseiten statt Lightbox:
 *   <gallery-grid feed="…/sites/cleebration.json" filter="on"
 *                 detail-url="/galerie/werk.html"></gallery-grid>
 *
 * Detailseite (eine eigene HTML-Seite, liest ?werk=<slug>):
 *   <gallery-detail feed="…/sites/cleebration.json"></gallery-detail>
 *
 * Weitere Attribute:
 *   limit="6"        nur die ersten n Eintraege (z. B. Auszug auf der Startseite)
 *   param="mauer"    Name des Adress-Parameters fuer detail-url (Standard: werk);
 *                    muss zu <gallery-detail param="…"> passen
 *   teaser="on"      Karte: unter dem Bild Titel + Kurztext (Feld `teaser` im Feed)
 *   link-mode="direct"  Klick fuehrt direkt zum Feld `link` (eigene Website oder
 *                    Galerie) statt zur Detailseite; fremde Seiten in neuem Tab.
 *                    Ohne `link` bleibt es bei detail-url. (PATCH cleebration)
 *   galerie="aus"    nur <gallery-detail>: kein Galerie-Modus, auch wenn der Eintrag
 *                    eine Bildstrecke hat (PATCH babowalls)
 *
 * Bildstrecken: Hat ein Eintrag im Feed `images` (Liste), zeigt
 * <gallery-detail> sie unter dem Text als Raster mit Grossansicht.
 * Liefert der Hub `thumb`/`thumbs` (Vorschaubilder), zeigen Kacheln und
 * Bildstrecke diese; die Großansicht lädt immer das große Bild.
 * Hat er `date` (JJJJ-MM-TT), steht das Datum in der Sprache der Seite
 * in der Meta-Zeile und auf der Kachel.
 *
 * Tipp: Statt eines gefilterten Pro-Site-Feeds geht auch der Gesamt-Feed
 * (all.json) mit dem Attribut site="cleebration".
 */

const STYLES = `
  :host {
    /* ---- Design-Tokens: pro Seite überschreibbar ---- */
    --gal-font-display: var(--gal-font, Georgia, "Times New Roman", serif);
    --gal-font-body: var(--gal-font, system-ui, -apple-system, "Segoe UI", sans-serif);
    --gal-bg: transparent;
    --gal-surface: #ffffff;
    --gal-text: #1a1a1a;
    --gal-muted: #6b6b6b;
    --gal-accent: #1a1a1a;
    --gal-accent-contrast: #ffffff;
    --gal-border: #e4e1da;
    --gal-radius: 4px;
    --gal-gap: 0.9rem;
    --gal-tile: 230px;       /* Mindestbreite einer Kachel */
    --gal-aspect: 3 / 2;     /* Kachel-Seitenverhältnis */
    --gal-maxwidth: 1180px;
    --gal-overlay: rgba(12,11,10,.92);

    display: block;
    color: var(--gal-text);
    background: var(--gal-bg);
    font-family: var(--gal-font-body);
    line-height: 1.5;
    box-sizing: border-box;
  }
  *, *::before, *::after { box-sizing: inherit; }
  .wrap { max-width: var(--gal-maxwidth); margin: 0 auto; }

  /* ---- Filterleiste ---- */
  .filters { display: flex; flex-wrap: wrap; gap: .5rem; margin: 0 0 var(--gal-gap); }
  .chip {
    font: inherit; font-size: .85rem; cursor: pointer;
    padding: .3rem .8rem; border-radius: 999px;
    border: 1px solid var(--gal-border); background: var(--gal-surface);
    color: var(--gal-text); transition: all .15s ease;
  }
  .chip[aria-pressed="true"] { background: var(--gal-accent); color: var(--gal-accent-contrast); border-color: var(--gal-accent); }

  /* ---- Raster ---- */
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--gal-tile), 1fr));
    gap: var(--gal-gap);
  }
  .tile {
    position: relative; display: block; padding: 0; margin: 0;
    border: 0; cursor: pointer; overflow: hidden;
    border-radius: var(--gal-radius); background: var(--gal-border);
    aspect-ratio: var(--gal-aspect); width: 100%;
    text-decoration: none; color: inherit; font: inherit;
  }
  .tile img { width: 100%; height: 100%; object-fit: cover; display: block;
    transition: transform .35s ease; }
  .tile:hover img { transform: scale(1.04); }
  .tile:focus-visible { outline: 3px solid var(--gal-accent); outline-offset: 2px; }
  .tile__ph {
    width: 100%; height: 100%; display: grid; place-items: center;
    color: var(--gal-muted); font-size: .85rem; background:
      repeating-linear-gradient(45deg, transparent 0 14px, rgba(0,0,0,.03) 14px 28px);
  }
  .tile__cap {
    position: absolute; left: 0; right: 0; bottom: 0;
    padding: .9rem .7rem .55rem; color: #fff; text-align: left;
    font-size: .82rem; line-height: 1.25;
    background: linear-gradient(transparent, rgba(0,0,0,.62));
    opacity: 0; transform: translateY(6px); transition: all .2s ease;
  }
  .tile:hover .tile__cap, .tile:focus-visible .tile__cap { opacity: 1; transform: none; }
  .tile__cap b { font-weight: 600; }
  /* Hinweis, dass dieser Eintrag in der gewaehlten Sprache noch nicht
     uebersetzt ist und deshalb die Standardsprache zu sehen ist. Lieber
     sichtbar als stillschweigend. */
  .pill--pending {
    display: inline-block; margin-top: .3rem;
    font-size: .68rem; letter-spacing: .04em; text-transform: uppercase;
    padding: .1rem .45rem; border-radius: 999px;
    background: rgba(255,255,255,.22); color: #fff;
  }
  .detail__pending {
    display: inline-block; margin: 0 0 1rem;
    font-size: .72rem; letter-spacing: .04em; text-transform: uppercase;
    padding: .15rem .55rem; border-radius: 999px;
    border: 1px solid var(--gal-border); color: var(--gal-muted);
  }
  /* PATCH moraro: Zwei-Klick-Video – Player des Anbieters erst nach Klick laden (Datenschutz) */
  .vconsent { position: relative; display: block; width: 100%; aspect-ratio: 16/9; border: 0; padding: 0; cursor: pointer;
    background: #1c1b19 center / cover no-repeat; color: #fff; font: inherit; overflow: hidden; border-radius: var(--gal-radius); }
  .vconsent::before { content: ""; position: absolute; inset: 0; background: rgba(0,0,0,.45); }
  .vconsent__inner { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .6rem; padding: 1rem; text-align: center; }
  .vconsent__play { width: 68px; height: 68px; border-radius: 50%; background: var(--gal-accent); color: var(--gal-accent-contrast); display: grid; place-items: center; }
  .vconsent__play svg { width: 30px; height: 30px; margin-left: 4px; }
  .vconsent__titel { font-weight: 600; font-size: 1.05rem; }
  .vconsent__hinweis { font-size: .8rem; max-width: 34em; opacity: .9; }
  .lb__stage .vconsent { width: min(94vw, 1100px); }
  .vconsent:focus-visible { outline: 3px solid var(--gal-accent); outline-offset: 3px; }
  .badge {
    position: absolute; top: .55rem; right: .55rem;
    width: 2.1rem; height: 2.1rem; border-radius: 999px;
    display: grid; place-items: center; color: #fff;
    background: rgba(0,0,0,.55); backdrop-filter: blur(2px);
  }
  .badge svg { width: 1rem; height: 1rem; }

  .empty { color: var(--gal-muted); padding: 2rem 0; text-align: center; }

  /* ---- Karte: Bild + Titel + Kurztext (teaser="on") ---- */
  .card { display: flex; flex-direction: column; gap: .55rem;
    text-decoration: none; color: inherit; }
  .card .tile { pointer-events: none; }
  .card:hover .tile img { transform: scale(1.04); }
  .card:focus-visible { outline: 3px solid var(--gal-accent); outline-offset: 3px; border-radius: var(--gal-radius); }
  .card__title { font-family: var(--gal-font-display); font-size: 1.08rem; line-height: 1.25; margin: 0; }
  .card__text { color: var(--gal-muted); font-size: .9rem; line-height: 1.45; margin: 0; }
  .card__more { font-size: .82rem; color: var(--gal-accent); margin-top: auto; }
  /* Galerie-Modus der Detailseite: Eintrag mit Bildstrecke */
  .detail--galerie .strip { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: .7rem; }

  /* ---- Lightbox ---- */
  .lb { position: fixed; inset: 0; z-index: 99999; display: none;
    background: var(--gal-overlay); }
  .lb[open] { display: grid; grid-template-rows: 1fr auto; }
  .lb__stage { display: grid; place-items: center; padding: 2.5rem 1rem 0; min-height: 0; }
  .lb__stage img, .lb__stage video, .lb__stage iframe {
    max-width: min(94vw, 1400px); max-height: 78vh; width: auto; height: auto;
    border-radius: 4px; background: #000; }
  .lb__stage iframe { width: min(94vw, 1100px); aspect-ratio: 16/9; height: auto; border: 0; }
  .lb__cap { color: #f3efe7; text-align: center; padding: 1rem; font-size: .95rem; }
  .lb__cap b { font-family: var(--gal-font-display); font-size: 1.1rem; }
  .lb__cap span { color: #c9c4ba; }
  .lb__btn {
    position: absolute; top: 50%; transform: translateY(-50%);
    width: 3rem; height: 3rem; border-radius: 999px; border: 0; cursor: pointer;
    background: rgba(255,255,255,.12); color: #fff; font-size: 1.4rem;
    display: grid; place-items: center; transition: background .15s ease; }
  .lb__btn:hover { background: rgba(255,255,255,.25); }
  .lb__btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
  .lb__prev { left: 1rem; } .lb__next { right: 1rem; }
  .lb__close { position: absolute; top: 1rem; right: 1rem; }
  @media (max-width: 640px){ .lb__prev{left:.3rem} .lb__next{right:.3rem} }

  /* ---- Detailansicht ---- */
  .detail { max-width: 980px; margin: 0 auto; }
  .detail__media img, .detail__media video, .detail__media iframe {
    width: 100%; border-radius: var(--gal-radius); background:#000; display:block; }
  /* Hochformat und quadratische Fotos nicht bildschirmhoch werden lassen */
  .detail__media img { max-height: 75vh; object-fit: contain; }
  .detail__media iframe { aspect-ratio: 16/9; height: auto; border: 0; }
  .detail__title { font-family: var(--gal-font-display); font-size: 1.7rem; margin: 1rem 0 .25rem; }
  .detail__meta { color: var(--gal-muted); margin: 0 0 1rem; }
  .detail__body { line-height: 1.6; }
  .detail__nav { display: flex; justify-content: space-between; gap: 1rem; margin-top: 2rem; }
  .detail__nav a { color: var(--gal-accent); text-decoration: none; font-size: .9rem; }
  /* Bildstrecke eines Eintrags (Feld „images" im Feed) */
  .strip { display: grid; gap: .5rem; margin: 1.5rem 0 0;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
  .strip button { padding: 0; border: 0; cursor: zoom-in; background: var(--gal-border);
    border-radius: var(--gal-radius); overflow: hidden; aspect-ratio: 1; }
  .strip img { width: 100%; height: 100%; object-fit: cover; display: block;
    transition: transform .3s ease; }
  .strip button:hover img { transform: scale(1.05); }
  .strip button:focus-visible { outline: 3px solid var(--gal-accent); outline-offset: 2px; }
  .strip__item { margin: 0; display: flex; flex-direction: column; gap: .35rem; }
  .strip__item button { width: 100%; }
  .strip__item figcaption { font-size: .85rem; line-height: 1.3; color: var(--gal-text); text-align: center; }
  .back { display: inline-block; margin-bottom: 1rem; color: var(--gal-muted); text-decoration: none; font-size: .9rem; }
`;

// ---------- Helfer ----------
/* =========================================================================
   Mehrsprachigkeit
   -------------------------------------------------------------------------
   Nicht auf zwei Sprachen festgelegt: SPRACHEN ist eine Tabelle, und eine
   weitere Sprache ist ein weiterer Eintrag darin. Die Feed-Adresse enthält
   den Platzhalter {lang}, den der Hub mit einem Feed je Sprache bedient.

   Eine Sprache ergänzen:
     1. hier einen Block anlegen (z. B. `fr: { … }`)
     2. im Hub `locales` in i18n.config.json erweitern
     3. auf der Seite `SiteI18n.init({ locales: [...] })` erweitern

   Fehlt ein Block, fällt das Modul auf die Standardsprache zurück, statt
   leere Beschriftungen zu zeigen.
   ========================================================================= */
const SPRACHEN = {
  de: {
    alle: "Alle",
    laedt: "Lädt …",
    leer: "Noch keine Medien.",
    ladefehler: "Galerie konnte nicht geladen werden.",
    nichtGefunden: "Medium nicht gefunden.",
    bildFolgt: "Bild folgt",
    schliessen: "Schließen",
    zurueck: "Zurück",
    weiter: "Weiter",
    grossansicht: "Großansicht",
    zurUebersicht: "Zur Übersicht",
    filter: "Filter",
    uebersetzungFolgt: "Übersetzung folgt",
    formatLocale: "de-AT",
    bilder: "Bilder",
    bildVon: (i, n) => `Bild ${i} von ${n}`,
    mehr: "Mehr",
    zurWebsite: "Zur Website",
    zurGalerie: "Zur Galerie"
  },
  fr: {
    alle: "Tous",
    laedt: "Chargement …",
    leer: "Aucun média pour le moment.",
    ladefehler: "Impossible de charger la galerie.",
    nichtGefunden: "Média introuvable.",
    bildFolgt: "Image à venir",
    schliessen: "Fermer",
    zurueck: "Précédent",
    weiter: "Suivant",
    grossansicht: "Vue agrandie",
    zurUebersicht: "Retour à l'aperçu",
    filter: "Filtre",
    uebersetzungFolgt: "Traduction à venir",
    formatLocale: "fr-FR",
    bilder: "Images",
    bildVon: (i, n) => `Image ${i} sur ${n}`
  },
  en: {
    alle: "All",
    laedt: "Loading …",
    leer: "Nothing here yet.",
    ladefehler: "The gallery could not be loaded.",
    nichtGefunden: "Item not found.",
    bildFolgt: "Image to follow",
    schliessen: "Close",
    zurueck: "Previous",
    weiter: "Next",
    grossansicht: "Enlarged view",
    zurUebersicht: "Back to overview",
    filter: "Filter",
    uebersetzungFolgt: "Translation pending",
    formatLocale: "en-GB",
    bilder: "Pictures",
    bildVon: (i, n) => `Picture ${i} of ${n}`,
    mehr: "More",
    zurWebsite: "Visit website",
    zurGalerie: "View gallery"
  }
};
const STANDARD_SPRACHE = "de";

/** Aktive Sprache: der Umschalter der Seite, sonst das lang-Attribut. */
function aktiveSprache(el) {
  if (window.SiteI18n && window.SiteI18n.lang) return window.SiteI18n.lang;
  const attr = el && el.getAttribute("lang");
  if (attr) return attr;
  return STANDARD_SPRACHE;
}

/** Beschriftungen einer Sprache, mit Rückfall über die Basissprache. */
function texte(sprache) {
  return (
    SPRACHEN[sprache] ||
    SPRACHEN[String(sprache).split("-")[0]] ||
    SPRACHEN[STANDARD_SPRACHE]
  );
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* PATCH cleebration: Ziel einer Kachel.
   link-mode="direct" + Feld `link` → direkt dorthin (Adressen auf der eigenen
   Domain werden relativ, damit sie im selben Tab bleiben); sonst Detailseite. */
const eigeneHost = () => location.host.replace(/^www\./, "");
function zielVon(it, el) {
  if (el.getAttribute("link-mode") === "direct" && it.link) {
    let href = it.link;
    try {
      const u = new URL(it.link, location.href);
      if (u.host.replace(/^www\./, "") === eigeneHost()) href = u.pathname + u.search + u.hash;
    } catch (_) { /* Adresse so lassen */ }
    return { href, direkt: true };
  }
  const detailUrl = el.getAttribute("detail-url");
  if (!detailUrl) return null;
  const sep = detailUrl.includes("?") ? "&" : "?";
  const param = el.getAttribute("param") || "werk";
  return { href: `${detailUrl}${sep}${param}=${encodeURIComponent(it.slug)}`, direkt: false };
}
function istExtern(href) {
  try { return new URL(href, location.href).host.replace(/^www\./, "") !== eigeneHost(); }
  catch (_) { return false; }
}

/**
 * Notbehelf für Tags ohne hinterlegte Beschriftung: aus "alte-musik" wird
 * "Alte Musik". Umlaute kann das nicht herstellen — dafür gehört der Tag in
 * die `tags`-Liste der Hub-Konfiguration, dann kommt die richtige
 * Beschriftung über `tagLabels` aus dem Feed.
 */
const schoenerTag = (t) =>
  String(t).replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase());

/* Datum (JJJJ-MM-TT aus dem Feed) in der Sprache der Seite.
   Mittags UTC, damit keine Zeitzone den Tag verschiebt. */
function datumText(iso, sprache) {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00Z");
  if (isNaN(d)) return iso;
  try {
    // Datumsformat wie im Blog-Modul: de-AT / en-GB statt nur „en" (= US)
    const fmt = texte(sprache).formatLocale || sprache || STANDARD_SPRACHE;
    return new Intl.DateTimeFormat(fmt, {
      day: "numeric", month: "long", year: "numeric", timeZone: "UTC"
    }).format(d);
  } catch { return iso; }
}

function metaLine(item, sprache) {
  const bits = [];
  if (item.name) bits.push(item.name);
  if (item.date) bits.push(datumText(item.date, sprache));
  else if (item.year) bits.push(item.year);
  if (item.technique) bits.push(item.technique);
  return bits.join(" · ");
}

function playBadge() {
  return `<span class="badge" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>`;
}

/* PATCH moraro: Zwei-Klick-Lösung für YouTube/Vimeo. Statt sofort den fremden Player zu
   laden, erscheint ein Vorschaubild mit Hinweis; erst der Klick lädt das iframe. */
function anbieter(embed) {
  return /vimeo/i.test(embed) ? "Vimeo" : /youtu/i.test(embed) ? "YouTube" : "dem Video-Anbieter";
}
function videoConsent(it) {
  const name = anbieter(it.video.embed);
  const bild = it.thumb || it.image || "";
  return `<button type="button" class="vconsent" data-embed="${esc(it.video.embed)}"${bild ? ` style="background-image:url('${esc(bild)}')"` : ""}>
    <span class="vconsent__inner"><span class="vconsent__play" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>
    <span class="vconsent__titel">Video abspielen</span>
    <span class="vconsent__hinweis">Beim Abspielen wird das Video von ${name} geladen. Dabei werden Daten (z. B. Ihre IP-Adresse) an ${name} übertragen.</span></span></button>`;
}
function wireConsent(root) {
  if (root.__vconsent) return; root.__vconsent = true;
  root.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest(".vconsent");
    if (!b) return;
    const sep = b.dataset.embed.includes("?") ? "&" : "?";
    b.outerHTML = `<iframe src="${b.dataset.embed}${sep}autoplay=1" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
  });
}

async function fetchFeed(url, sprache) {
  /* {lang} in der Feed-Adresse durch die aktive Sprache ersetzen.
     Der Hub liefert je Sprache eine Datei; ohne Platzhalter bleibt
     die Adresse unveraendert und alles funktioniert wie bisher. */
  url = String(url).replace(/\{lang\}/g, sprache || STANDARD_SPRACHE);
  const res = await fetch(url, { mode: "cors" });
  // PATCH moraro (wie PATCH klangerie im Blog-Modul): 404 = für diese Seite gibt es im Hub
  // noch keinen Eintrag → leere Liste („Noch keine Medien.“) statt Fehlermeldung.
  if (res.status === 404) return [];
  if (!res.ok) throw new Error("Feed " + res.status);
  const data = await res.json();
  // PATCH moraro: Ohne eigenes Standbild setzt der Hub das Vorschaubild von YouTube
  // (i.ytimg.com) ein – das würde schon beim Ansehen der Übersicht Daten an Google
  // senden. Solche fremden Vorschaubilder werden verworfen (Kachel zeigt „Bild folgt“).
  // Abhilfe im Cockpit: beim Video immer ein eigenes „Foto / Standbild“ hochladen.
  const fremd = (u) => /^https?:\/\/([a-z0-9-]+\.)*(ytimg\.com|youtube\.com|vimeocdn\.com)\//i.test(String(u || ""));
  return (Array.isArray(data) ? data : []).map((it) => {
    if (fremd(it.image)) it.image = "";
    if (fremd(it.thumb)) it.thumb = "";
    if (Array.isArray(it.images)) it.images = it.images.filter((u) => !fremd(u));
    return it;
  });
}

function applyFilters(items, { site, gallery, tags }) {
  return items.filter((i) => {
    if (gallery && i.gallery !== gallery) return false;
    if (site && !(i.sites || []).includes(site)) return false;
    if (tags && tags.length && !tags.some((t) => (i.tags || []).includes(t))) return false;
    return true;
  });
}

// ======================================================================
//  <gallery-grid>
// ======================================================================

/* Warten, bis die Sprache der Seite feststeht.

   Ohne das zeichnet das Modul in der Standardsprache, holt deren Feed, und
   zeichnet unmittelbar danach noch einmal in der wirklichen Sprache — zwei
   Abrufe und ein sichtbares Flackern.

   Auf einer fremden Seite ohne SiteI18n gibt es nichts zu warten; dort
   zeichnet das Modul sofort. */
function spracheBereit() {
  const i = window.SiteI18n;
  if (!i || !i.ready) return Promise.resolve();
  /* Notausgang: bindet eine Seite site-i18n.js ein, ruft aber nie init()
     auf, loest das Versprechen nie auf -- und das Modul bliebe fuer immer
     leer. Nach zwei Sekunden wird deshalb in der Standardsprache
     gezeichnet. */
  const notausgang = new Promise((r) => setTimeout(r, 2000));
  return Promise.race([i.ready, notausgang]).catch(() => {});
}

class GalleryGrid extends HTMLElement {
  static get observedAttributes() { return ["feed", "lang", "gallery", "site", "tags"]; }

  connectedCallback() {
    this.attachShadow({ mode: "open" });
    wireConsent(this.shadowRoot);   // PATCH moraro
    this._activeTag = null;
    this._sprache = aktiveSprache(this);
    this.render(`<div class="empty">${texte(this._sprache).laedt}</div>`);
    /* Auf den Sprachumschalter der Seite hören. Beim Wechsel wird der Feed
       der anderen Sprache geladen und neu gezeichnet — ohne Neuladen. */
    this._unsub = window.SiteI18n
      ? window.SiteI18n.onChange(() => { if (this._gezeichnet) this.load(); })
      : () => {};
    spracheBereit().then(() => { this._gezeichnet = true; this.load(); });
  }

  attributeChangedCallback() { if (this.shadowRoot) this.load(); }

  get feed() { return this.getAttribute("feed"); }

  async load() {
    this._sprache = aktiveSprache(this);
    const t = texte(this._sprache);
    try {
      const all = await fetchFeed(this.feed, this._sprache);
      this._items = applyFilters(all, {
        site: this.getAttribute("site"),
        gallery: this.getAttribute("gallery"),
        tags: (this.getAttribute("tags") || "").split(",").map((s) => s.trim()).filter(Boolean),
      });
      // limit="6": nur die ersten n Eintraege, etwa als Auszug auf der Startseite
      const limit = parseInt(this.getAttribute("limit"), 10);
      if (limit > 0) this._items = this._items.slice(0, limit);
      if (!this._items.length) { this.render(`<div class="empty">${t.leer}</div>`); return; }
      this.paint();
    } catch (e) {
      this.render(`<div class="empty">${texte(this._sprache).ladefehler}</div>`);
      console.error("[gallery-grid]", e);
    }
  }

  /**
   * Alle vorkommenden Tags für die Filterleiste, als [schlüssel, beschriftung].
   *
   * Die Beschriftung kommt aus `tagLabels` im Feed (dort stehen die Namen aus
   * der Hub-Konfiguration, inklusive Umlauten: "buecher" → "Bücher"). Fehlt
   * sie, wird der Schlüssel lesbar gemacht, statt ihn roh anzuzeigen.
   */
  get tagSet() {
    const s = new Map();
    for (const i of this._items)
      for (const t of i.tags || [])
        if (!s.has(t)) s.set(t, (i.tagLabels && i.tagLabels[t]) || schoenerTag(t));
    return [...s];
  }

  paint() {
    const t = texte(this._sprache);
    const filterOn = this.getAttribute("filter") === "on" && this.tagSet.length > 1;
    const detailUrl = this.getAttribute("detail-url");

    const visible = this._activeTag
      ? this._items.filter((i) => (i.tags || []).includes(this._activeTag))
      : this._items;

    const filters = filterOn ? `
      <div class="filters" role="group" aria-label="${esc(t.filter)}">
        <button class="chip" data-tag="" aria-pressed="${!this._activeTag}">${esc(t.alle)}</button>
        ${this.tagSet.map(([t, label]) => `
          <button class="chip" data-tag="${esc(t)}" aria-pressed="${this._activeTag === t}">${esc(label)}</button>
        `).join("")}
      </div>` : "";

    const tiles = visible.map((it, idx) => {
      // Kachel: Vorschaubild (thumb) wenn der Hub eines liefert, sonst das große Bild
      const inner = it.image
        ? `<img src="${esc(it.thumb || it.image)}" alt="${esc(it.title)}" loading="lazy" />`
        : `<div class="tile__ph">${esc(t.bildFolgt)}</div>`;
      const badge = it.media === "video" ? playBadge() : "";
      const pending = it.translated === false
        ? `<br><span class="pill--pending">${esc(t.uebersetzungFolgt)}</span>`
        : "";
      const datum = it.date ? "<br>" + esc(datumText(it.date, this._sprache)) : "";
      const cap = `<span class="tile__cap"><b>${esc(it.title)}</b>${it.name ? "<br>" + esc(it.name) : ""}${datum}${pending}</span>`;
      const dataIdx = visible.indexOf(it);
      const ziel = zielVon(it, this);
      if (this.getAttribute("teaser") === "on" && ziel) {
        const extern = istExtern(ziel.href);
        const mehr = extern ? t.zurWebsite
          : (Array.isArray(it.images) && it.images.length > 1 ? t.zurGalerie : t.mehr);
        return `<a class="card" href="${esc(ziel.href)}"${extern ? ' target="_blank" rel="noopener"' : ""}>
          <span class="tile">${inner}${badge}</span>
          <h3 class="card__title">${esc(it.title)}</h3>
          ${it.teaser ? `<p class="card__text">${esc(it.teaser)}</p>` : ""}
          <span class="card__more">${esc(ziel.direkt ? mehr : t.mehr)} ${extern ? "↗" : "→"}</span>
        </a>`;
      }
      if (detailUrl) {
        const sep = detailUrl.includes("?") ? "&" : "?";
        // Name des Adress-Parameters wie bei <gallery-detail param="…">
        const param = this.getAttribute("param") || "werk";
        return `<a class="tile" href="${esc(detailUrl)}${sep}${esc(param)}=${encodeURIComponent(it.slug)}">${inner}${badge}${cap}</a>`;
      }
      return `<button class="tile" type="button" data-idx="${dataIdx}" aria-label="${esc(it.title)}">${inner}${badge}${cap}</button>`;
    }).join("");

    this.render(`
      ${filters}
      <div class="grid">${tiles}</div>
      ${this.lightboxMarkup()}
    `);

    this._visible = visible;

    // Filter-Klicks
    this.shadowRoot.querySelectorAll(".chip").forEach((c) =>
      c.addEventListener("click", () => {
        this._activeTag = c.dataset.tag || null;
        this.paint();
      }));

    // Lightbox nur wenn keine Detailseiten
    if (!detailUrl) this.wireLightbox();
  }

  // ---- Lightbox ----
  lightboxMarkup() {
    const t = texte(this._sprache);
    return `
      <div class="lb" part="lightbox" role="dialog" aria-modal="true" aria-label="${esc(t.grossansicht)}">
        <button class="lb__btn lb__close" aria-label="${esc(t.schliessen)}">✕</button>
        <button class="lb__btn lb__prev" aria-label="${esc(t.zurueck)}">‹</button>
        <button class="lb__btn lb__next" aria-label="${esc(t.weiter)}">›</button>
        <div class="lb__stage"></div>
        <div class="lb__cap"></div>
      </div>`;
  }

  wireLightbox() {
    const lb = this.shadowRoot.querySelector(".lb");
    const stage = lb.querySelector(".lb__stage");
    const cap = lb.querySelector(".lb__cap");
    let cur = 0;

    const renderMedia = (it) => {
      if (it.media === "video" && it.video) {
        if (it.video.kind === "file")
          return `<video src="${esc(it.video.src)}" controls autoplay playsinline></video>`;
        return videoConsent(it);   // PATCH moraro: Zwei-Klick
      }
      if (it.image) return `<img src="${esc(it.image)}" alt="${esc(it.title)}" />`;
      return `<div style="color:#c9c4ba">${esc(texte(this._sprache).bildFolgt)}</div>`;
    };

    const show = (i) => {
      cur = (i + this._visible.length) % this._visible.length;
      const it = this._visible[cur];
      stage.innerHTML = renderMedia(it);
      cap.innerHTML = `<b>${esc(it.title)}</b>${metaLine(it, this._sprache) ? `<br><span>${esc(metaLine(it, this._sprache))}</span>` : ""}`;
    };
    const open = (i) => { show(i); lb.setAttribute("open", ""); document.documentElement.style.overflow = "hidden"; };
    const close = () => { lb.removeAttribute("open"); stage.innerHTML = ""; document.documentElement.style.overflow = ""; };

    this.shadowRoot.querySelectorAll(".tile").forEach((t) =>
      t.addEventListener("click", () => open(Number(t.dataset.idx))));
    lb.querySelector(".lb__close").addEventListener("click", close);
    lb.querySelector(".lb__prev").addEventListener("click", () => show(cur - 1));
    lb.querySelector(".lb__next").addEventListener("click", () => show(cur + 1));
    lb.addEventListener("click", (e) => { if (e.target === lb) close(); });
    this._keyHandler = (e) => {
      if (!lb.hasAttribute("open")) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") show(cur - 1);
      else if (e.key === "ArrowRight") show(cur + 1);
    };
    document.addEventListener("keydown", this._keyHandler);
    this._lbClose = close;
  }

  disconnectedCallback() {
    if (this._keyHandler) document.removeEventListener("keydown", this._keyHandler);
    if (this._unsub) this._unsub();
  }

  render(html) {
    this.shadowRoot.innerHTML = `<style>${STYLES}</style><div class="wrap">${html}</div>`;
  }
}

// ======================================================================
//  <gallery-detail>   (eigene Detailseite, liest ?werk=<slug>)
// ======================================================================
class GalleryDetail extends HTMLElement {
  static get observedAttributes() { return ["feed", "lang"]; }

  connectedCallback() {
    this.attachShadow({ mode: "open" });
    wireConsent(this.shadowRoot);   // PATCH moraro
    this._sprache = aktiveSprache(this);
    this.render(`<div class="empty">${texte(this._sprache).laedt}</div>`);
    this._unsub = window.SiteI18n
      ? window.SiteI18n.onChange(() => { if (this._gezeichnet) this.load(); })
      : () => {};
    spracheBereit().then(() => { this._gezeichnet = true; this.load(); });
  }

  attributeChangedCallback() { if (this.shadowRoot) this.load(); }

  disconnectedCallback() {
    if (this._unsub) this._unsub();
    if (this._stripKeys) document.removeEventListener("keydown", this._stripKeys);
  }

  get feed() { return this.getAttribute("feed"); }

  async load() {
    this._sprache = aktiveSprache(this);
    const t = texte(this._sprache);
    try {
      const all = await fetchFeed(this.feed, this._sprache);
      const items = applyFilters(all, {
        site: this.getAttribute("site"),
        gallery: this.getAttribute("gallery"),
        tags: null,
      });
      const param = this.getAttribute("param") || "werk";
      const slug = new URLSearchParams(location.search).get(param);
      const idx = items.findIndex((i) => i.slug === slug);
      if (idx < 0) { this.render(`<div class="empty">${t.nichtGefunden}</div>`); return; }
      this.paint(items, idx);
    } catch (e) {
      this.render(`<div class="empty">Konnte nicht geladen werden.</div>`);
      console.error("[gallery-detail]", e);
    }
  }

  media(it) {
    if (it.media === "video" && it.video) {
      if (it.video.kind === "file") return `<video src="${esc(it.video.src)}" controls playsinline></video>`;
      return videoConsent(it);   // PATCH moraro: Zwei-Klick
    }
    if (it.image) return `<img src="${esc(it.image)}" alt="${esc(it.title)}" />`;
    return `<div class="tile__ph" style="aspect-ratio:var(--gal-aspect)">Bild folgt</div>`;
  }

  paint(items, idx) {
    const it = items[idx];
    /* `t` stand hier nicht zur Verfuegung, wurde unten aber benutzt. Der
       Fehler schlug nur zu, wenn ein Werk unuebersetzt ist -- also nie,
       solange alles uebersetzt war. Eine Mine, die erst beim ersten
       englischen Luecken-Werk hochgegangen waere. Gefunden vom Test
       test/widgets-scope.test.mjs, nicht im Betrieb. */
    const t = texte(this._sprache);
    const backUrl = this.getAttribute("back-url");
    const prev = items[(idx - 1 + items.length) % items.length];
    const next = items[(idx + 1) % items.length];
    const param = this.getAttribute("param") || "werk";
    const link = (s) => `?${param}=${encodeURIComponent(s)}`;
    /* Bildstrecke: `images` aus dem Feed. Ohne das Feld (alle bisherigen
       Eintraege) erscheint hier nichts, die Ansicht bleibt wie gehabt. */
    const bilder = Array.isArray(it.images) ? it.images.filter(Boolean) : [];
    /* PATCH cleebration: Eintrag mit Bildstrecke = Galerie. Kein großes
       Einzelbild und kein „Mehr dazu" davor, die Bilder kommen sofort. */
    /* PATCH babowalls: galerie="aus" an <gallery-detail> haelt die bisherige
       Ansicht (grosses Bild, ganzer Text, Bildraster darunter). Grund: bei
       BaBoWalls hat jeder Ort eine Bildstrecke; der Galerie-Modus wuerde das
       Titelbild weglassen und den Text auf den Kurztext kuerzen (Chris, 09.10.2026). */
    const galerie = bilder.length > 1 && this.getAttribute("galerie") !== "aus";
    /* PATCH cleebration: Beschriftung je Bild (Feld `imageTitles`, gleiche Reihenfolge) */
    const bildTitel = Array.isArray(it.imageTitles) ? it.imageTitles : [];

    this.render(`
      <article class="detail${galerie ? " detail--galerie" : ""}">
        ${backUrl ? `<a class="back" href="${esc(backUrl)}">← ${esc(t.zurUebersicht)}</a>` : ""}
        ${galerie ? "" : `<div class="detail__media">${this.media(it)}</div>`}
        <h1 class="detail__title">${esc(it.title)}</h1>
        ${it.translated === false ? `<div class="detail__pending">${esc(t.uebersetzungFolgt)}</div>` : ""}
        <p class="detail__meta">${esc([metaLine(it, this._sprache), it.galleryLabel].filter(Boolean).join(" · "))}</p>
        ${galerie
          /* PATCH moraro: einleitung="voll" an <gallery-detail> zeigt im Galerie-Modus
             den ganzen Einleitungstext (`description`) über der Bildstrecke,
             sonst wie bisher den Kurztext (Chris, 18.10.2026: Dampflokfahrten). */
          ? (this.getAttribute("einleitung") === "voll" && it.description
              ? `<div class="detail__body">${it.description}</div>`
              : (it.teaser ? `<div class="detail__body"><p>${esc(it.teaser)}</p></div>` : ""))
          : (it.description ? `<div class="detail__body">${it.description}</div>` : "")}
        ${bilder.length > 1 ? `
          <div class="strip" role="list" aria-label="${esc(t.bilder)}">
            ${bilder.map((src, i) => `
              <figure class="strip__item" role="listitem">
                <button type="button" data-i="${i}" data-full="${esc(src)}" data-cap="${esc(bildTitel[i] || "")}" aria-label="${esc(bildTitel[i] || t.bildVon(i + 1, bilder.length))}">
                  <img src="${esc((it.thumbs && it.thumbs[i]) || src)}" alt="${esc(it.title)} – ${esc(bildTitel[i] || t.bildVon(i + 1, bilder.length))}" loading="lazy" />
                </button>
                ${bildTitel[i] ? `<figcaption>${esc(bildTitel[i])}</figcaption>` : ""}
              </figure>`).join("")}
          </div>
          <div class="lb" role="dialog" aria-modal="true" aria-label="${esc(t.grossansicht)}">
            <button class="lb__btn lb__close" aria-label="${esc(t.schliessen)}">✕</button>
            <button class="lb__btn lb__prev" aria-label="${esc(t.zurueck)}">‹</button>
            <button class="lb__btn lb__next" aria-label="${esc(t.weiter)}">›</button>
            <div class="lb__stage"></div>
            <div class="lb__cap"></div>
          </div>` : ""}
        <nav class="detail__nav">
          <a href="${link(prev.slug)}">‹ ${esc(prev.title)}</a>
          <a href="${link(next.slug)}">${esc(next.title)} ›</a>
        </nav>
      </article>
    `);
  }

  render(html) {
    this.shadowRoot.innerHTML = `<style>${STYLES}</style><div class="wrap">${html}</div>`;
    this.wireStrip();
  }

  /* Grossansicht fuer die Bildstrecke: blaettern mit Knoepfen und
     Pfeiltasten, schliessen mit Esc oder Klick daneben. */
  wireStrip() {
    const root = this.shadowRoot;
    const lb = root.querySelector(".lb");
    const knoepfe = [...root.querySelectorAll(".strip button")];
    if (this._stripKeys) document.removeEventListener("keydown", this._stripKeys);
    if (!lb || !knoepfe.length) return;
    const t = texte(this._sprache);
    // Großansicht immer mit dem großen Bild, auch wenn im Raster das Vorschaubild steht
    const quellen = knoepfe.map((b) => b.dataset.full || b.querySelector("img").getAttribute("src"));
    const titel = root.querySelector(".detail__title")?.textContent || "";
    const stage = lb.querySelector(".lb__stage");
    const cap = lb.querySelector(".lb__cap");
    let cur = 0;
    const show = (i) => {
      cur = (i + quellen.length) % quellen.length;
      stage.innerHTML = `<img src="${esc(quellen[cur])}" alt="${esc(titel)}" />`;
      const bt = knoepfe[cur]?.dataset.cap || "";
      cap.innerHTML = `<b>${esc(bt || titel)}</b><br><span>${esc((bt ? titel + " · " : "") + t.bildVon(cur + 1, quellen.length))}</span>`;
    };
    const open = (i) => { show(i); lb.setAttribute("open", ""); document.documentElement.style.overflow = "hidden"; lb.querySelector(".lb__close").focus(); };
    const close = () => { lb.removeAttribute("open"); stage.innerHTML = ""; document.documentElement.style.overflow = ""; knoepfe[cur]?.focus(); };
    knoepfe.forEach((b) => b.addEventListener("click", () => open(Number(b.dataset.i))));
    lb.querySelector(".lb__close").addEventListener("click", close);
    lb.querySelector(".lb__prev").addEventListener("click", () => show(cur - 1));
    lb.querySelector(".lb__next").addEventListener("click", () => show(cur + 1));
    lb.addEventListener("click", (e) => { if (e.target === lb || e.target === stage) close(); });
    this._stripKeys = (e) => {
      if (!lb.hasAttribute("open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") show(cur - 1);
      if (e.key === "ArrowRight") show(cur + 1);
    };
    document.addEventListener("keydown", this._stripKeys);
  }
}

if (!customElements.get("gallery-grid")) customElements.define("gallery-grid", GalleryGrid);
if (!customElements.get("gallery-detail")) customElements.define("gallery-detail", GalleryDetail);

export { GalleryGrid, GalleryDetail };
