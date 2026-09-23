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
  .badge {
    position: absolute; top: .55rem; right: .55rem;
    width: 2.1rem; height: 2.1rem; border-radius: 999px;
    display: grid; place-items: center; color: #fff;
    background: rgba(0,0,0,.55); backdrop-filter: blur(2px);
  }
  .badge svg { width: 1rem; height: 1rem; }

  .empty { color: var(--gal-muted); padding: 2rem 0; text-align: center; }

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
  .detail__media iframe { aspect-ratio: 16/9; height: auto; border: 0; }
  .detail__title { font-family: var(--gal-font-display); font-size: 1.7rem; margin: 1rem 0 .25rem; }
  .detail__meta { color: var(--gal-muted); margin: 0 0 1rem; }
  .detail__body { line-height: 1.6; }
  .detail__nav { display: flex; justify-content: space-between; gap: 1rem; margin-top: 2rem; }
  .detail__nav a { color: var(--gal-accent); text-decoration: none; font-size: .9rem; }
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
    filter: "Filter",
    uebersetzungFolgt: "Übersetzung folgt"
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
    filter: "Filter",
    uebersetzungFolgt: "Translation pending"
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

/**
 * Notbehelf für Tags ohne hinterlegte Beschriftung: aus "alte-musik" wird
 * "Alte Musik". Umlaute kann das nicht herstellen — dafür gehört der Tag in
 * die `tags`-Liste der Hub-Konfiguration, dann kommt die richtige
 * Beschriftung über `tagLabels` aus dem Feed.
 */
const schoenerTag = (t) =>
  String(t).replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase());

function metaLine(item) {
  const bits = [];
  if (item.name) bits.push(item.name);
  if (item.year) bits.push(item.year);
  if (item.technique) bits.push(item.technique);
  return bits.join(" · ");
}

function playBadge() {
  return `<span class="badge" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>`;
}

async function fetchFeed(url, sprache) {
  /* {lang} in der Feed-Adresse durch die aktive Sprache ersetzen.
     Der Hub liefert je Sprache eine Datei; ohne Platzhalter bleibt
     die Adresse unveraendert und alles funktioniert wie bisher. */
  url = String(url).replace(/\{lang\}/g, sprache || STANDARD_SPRACHE);
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error("Feed " + res.status);
  return res.json();
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
      const inner = it.image
        ? `<img src="${esc(it.image)}" alt="${esc(it.title)}" loading="lazy" />`
        : `<div class="tile__ph">${esc(t.bildFolgt)}</div>`;
      const badge = it.media === "video" ? playBadge() : "";
      const pending = it.translated === false
        ? `<br><span class="pill--pending">${esc(t.uebersetzungFolgt)}</span>`
        : "";
      const cap = `<span class="tile__cap"><b>${esc(it.title)}</b>${it.name ? "<br>" + esc(it.name) : ""}${pending}</span>`;
      const dataIdx = visible.indexOf(it);
      if (detailUrl) {
        const sep = detailUrl.includes("?") ? "&" : "?";
        return `<a class="tile" href="${esc(detailUrl)}${sep}werk=${encodeURIComponent(it.slug)}">${inner}${badge}${cap}</a>`;
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
        return `<iframe src="${esc(it.video.embed)}?autoplay=1" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
      }
      if (it.image) return `<img src="${esc(it.image)}" alt="${esc(it.title)}" />`;
      return `<div style="color:#c9c4ba">${esc(texte(this._sprache).bildFolgt)}</div>`;
    };

    const show = (i) => {
      cur = (i + this._visible.length) % this._visible.length;
      const it = this._visible[cur];
      stage.innerHTML = renderMedia(it);
      cap.innerHTML = `<b>${esc(it.title)}</b>${metaLine(it) ? `<br><span>${esc(metaLine(it))}</span>` : ""}`;
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
    this._sprache = aktiveSprache(this);
    this.render(`<div class="empty">${texte(this._sprache).laedt}</div>`);
    this._unsub = window.SiteI18n
      ? window.SiteI18n.onChange(() => { if (this._gezeichnet) this.load(); })
      : () => {};
    spracheBereit().then(() => { this._gezeichnet = true; this.load(); });
  }

  attributeChangedCallback() { if (this.shadowRoot) this.load(); }

  disconnectedCallback() { if (this._unsub) this._unsub(); }

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
      return `<iframe src="${esc(it.video.embed)}" allow="fullscreen; picture-in-picture" allowfullscreen></iframe>`;
    }
    if (it.image) return `<img src="${esc(it.image)}" alt="${esc(it.title)}" />`;
    return `<div class="tile__ph" style="aspect-ratio:var(--gal-aspect)">Bild folgt</div>`;
  }

  paint(items, idx) {
    const it = items[idx];
    const backUrl = this.getAttribute("back-url");
    const prev = items[(idx - 1 + items.length) % items.length];
    const next = items[(idx + 1) % items.length];
    const param = this.getAttribute("param") || "werk";
    const link = (s) => `?${param}=${encodeURIComponent(s)}`;

    this.render(`
      <article class="detail">
        ${backUrl ? `<a class="back" href="${esc(backUrl)}">← Zur Übersicht</a>` : ""}
        <div class="detail__media">${this.media(it)}</div>
        <h1 class="detail__title">${esc(it.title)}</h1>
        ${it.translated === false ? `<div class="detail__pending">${esc(t.uebersetzungFolgt)}</div>` : ""}
        <p class="detail__meta">${esc(metaLine(it))}${it.galleryLabel ? " · " + esc(it.galleryLabel) : ""}</p>
        ${it.description ? `<div class="detail__body">${it.description}</div>` : ""}
        <nav class="detail__nav">
          <a href="${link(prev.slug)}">‹ ${esc(prev.title)}</a>
          <a href="${link(next.slug)}">${esc(next.title)} ›</a>
        </nav>
      </article>
    `);
  }

  render(html) {
    this.shadowRoot.innerHTML = `<style>${STYLES}</style><div class="wrap">${html}</div>`;
  }
}

if (!customElements.get("gallery-grid")) customElements.define("gallery-grid", GalleryGrid);
if (!customElements.get("gallery-detail")) customElements.define("gallery-detail", GalleryDetail);

export { GalleryGrid, GalleryDetail };
