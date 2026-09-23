// ===========================================================================
//  Feed-Builder:  data/medien.csv + content/medien/*.md  ->  public/feed/*.json
//  Aufruf:  npm run build   (lokal UND auf Vercel)
//
//  Erzeugt:
//    public/feed/all.json                – alle Medien
//    public/feed/sites/<site>.json       – nur Medien für diese Website
//    public/feed/galleries/<gallery>.json– nur Medien dieser Galerie
//    public/feed/index.json              – Metadaten (Sites, Galerien, Zähler)
//
//  Diese Dateien liegen nach dem Build im Repo/Deploy und werden vom Anzeige-
//  Modul (module/) per fetch() gelesen.
// ===========================================================================

import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import { loadItems, config, ROOT } from "./lib.mjs";
import { pick, istUebersetzt, feedNamen } from "./i18n.mjs";

/* Sprachen dieses Hubs. Bewusst aus einer Datei gelesen statt im Code
   festgelegt: eine weitere Sprache ist damit ein Eintrag, keine Änderung
   am Build. */
const i18nPfad = path.join(ROOT, "i18n.config.json");
const i18nCfg = fs.existsSync(i18nPfad)
  ? JSON.parse(fs.readFileSync(i18nPfad, "utf8"))
  : {};
const LOCALES = i18nCfg.locales?.length ? i18nCfg.locales : ["de"];
const DEFAULT_LOCALE = i18nCfg.defaultLocale || LOCALES[0];

const OUT = path.join(ROOT, "public", "feed");
const MEDIA_URL = "/media"; // öffentlicher Pfad der verarbeiteten Bilder

// --- Namensanzeige (datenschutzgerecht) -----------------------------------
function displayName(item, privacy) {
  const first = (item.firstName || "").trim();
  const last = (item.lastName || "").trim();
  switch (privacy.nameDisplay) {
    case "full": return [first, last].filter(Boolean).join(" ");
    case "firstOnly": return first || last;
    case "firstInitial":
    default: return last ? `${first} ${last[0]}.` : first;
  }
}

function privacyFor(galleryKey) {
  const g = config.galleries.find((x) => x.key === galleryKey);
  return { ...config.privacy, ...(g?.privacy || {}) };
}

// --- Video-Normalisierung (YouTube / Vimeo / Datei) -----------------------
function normalizeVideo(url) {
  const u = String(url || "").trim();
  if (!u) return null;
  let m;
  if ((m = u.match(/(?:youtube\.com\/.*[?&]v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{6,})/))) {
    const id = m[1];
    return { kind: "youtube", id, src: u, embed: `https://www.youtube-nocookie.com/embed/${id}`,
             poster: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
  }
  if ((m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/))) {
    const id = m[1];
    return { kind: "vimeo", id, src: u, embed: `https://player.vimeo.com/video/${id}` };
  }
  // sonst: selbst gehostete Datei (mp4/webm) – relative Pfade auf /media zeigen lassen
  const src = /^https?:\/\//.test(u) ? u : `${MEDIA_URL}/${u.replace(/^\/?media\//, "")}`;
  return { kind: "file", src };
}

// Bildpfad bestimmen. Zwei Pflege-Wege:
//  - CSV/Drive + Pipeline:  Dateiname ("am-fluss.jpg") -> /media/<slug>.jpg
//    (npm run images erzeugt genau diese Datei aus dem Original)
//  - CMS-Direktupload/URL:  beginnt mit "http(s)://" oder "/" -> unverändert
function imageUrl(slug, rawFile) {
  if (!rawFile) return null;
  if (/^https?:\/\//.test(rawFile) || rawFile.startsWith("/")) return rawFile;
  return `${MEDIA_URL}/${slug}.jpg`;
}

function knownSiteKeys() {
  return new Set(config.sites.map((s) => s.key));
}
function knownGalleryKeys() {
  return new Set(config.galleries.map((g) => g.key));
}

function build() {
  const items = loadItems();
  const siteKeys = knownSiteKeys();
  const galleryKeys = knownGalleryKeys();
  /* Beschriftung eines Tags in einer Sprache. `label` darf eine Zeichenkette
     sein (gilt dann überall) oder ein Objekt je Sprache. Fehlt die Sprache,
     gilt die Standardsprache, sonst der Schlüssel selbst. */
  const tagLabel = (key, locale) => {
    const eintrag = (config.tags || []).find((x) => x.key === key);
    const l = eintrag?.label;
    if (l == null) return key;
    if (typeof l === "string") return l;
    return l[locale] || l[String(locale).split("-")[0]] || l[DEFAULT_LOCALE] || key;
  };
  const warnings = [];

  /* Ein vollständiger Satz Datensätze für eine Sprache. Die Fakten sind in
     allen Sprachen dieselben; nur Titel, Text und Technik kommen aus dem
     jeweiligen Sprachblock, mit Rückfall auf die Standardsprache. */
  const datensaetzeFuer = (locale) => items.map((it) => {
    const privacy = privacyFor(it.gallery);
    const g = config.galleries.find((x) => x.key === it.gallery);
    const video = it.media === "video" ? normalizeVideo(it.video) : null;

    // Bild: bei Video ggf. Poster (eigene Datei) ODER YouTube-Thumbnail
    let image = imageUrl(it.slug, it.image);
    if (!image && video?.poster) image = video.poster;

    if (it.gallery && !galleryKeys.has(it.gallery))
      warnings.push(`Galerie "${it.gallery}" (Medium "${it.slug}") fehlt in galleries.config.js`);
    for (const s of it.sites)
      if (!siteKeys.has(s)) warnings.push(`Site "${s}" (Medium "${it.slug}") fehlt in galleries.config.js`);
    if (!it.sites.length)
      warnings.push(`Medium "${it.slug}" hat keine Site (weder Spalte "Seiten" noch Galerie-defaultSites)`);

    const out = {
      slug: it.slug,
      lang: locale,
      title: pick(it, locale, "title", DEFAULT_LOCALE) || it.slug,
      translated: istUebersetzt(it, locale, DEFAULT_LOCALE),
      name: displayName(it, privacy),
      media: it.media,
      image,
      gallery: it.gallery || null,
      galleryLabel: g?.label || it.gallery || null,
      sites: it.sites,
      tags: it.tags,
    };
    /* Beschriftungen der Tags mitgeben. Ohne sie zeigt die Filterleiste auf
       der Website den Schlüssel statt des Namens — „buecher" statt „Bücher".
       Nur die Tags dieses Eintrags, damit der Feed ein Array bleibt. */
    if (it.tags?.length) {
      out.tagLabels = Object.fromEntries(
        it.tags.map((t) => [t, tagLabel(t, locale)])
      );
    }
    if (privacy.showYear && it.year) out.year = it.year;

    const technik = pick(it, locale, "technique", DEFAULT_LOCALE);
    if (technik) out.technique = technik;
    if (video) out.video = video;

    const text = pick(it, locale, "body", DEFAULT_LOCALE);
    if (text) out.description = marked.parse(String(text));
    return out;
  });

  fs.mkdirSync(path.join(OUT, "sites"), { recursive: true });
  fs.mkdirSync(path.join(OUT, "galleries"), { recursive: true });

  const writeJSON = (p, data) => fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf8");

  /* Ein Satz Feeds je Sprache. Die Standardsprache bekommt zusätzlich den
     Namen ohne Sprachkürzel, damit Einbindungen ohne {lang} weiterlaufen. */
  let geschrieben = 0;
  for (const locale of LOCALES) {
    const liste = datensaetzeFuer(locale);

    for (const name of feedNamen("all", locale, DEFAULT_LOCALE)) {
      writeJSON(path.join(OUT, name), liste);
      geschrieben++;
    }

    for (const s of config.sites) {
      const teil = liste.filter((i) => i.sites.includes(s.key));
      for (const name of feedNamen(s.key, locale, DEFAULT_LOCALE)) {
        writeJSON(path.join(OUT, "sites", name), teil);
        geschrieben++;
      }
    }

    for (const g of config.galleries) {
      const teil = liste.filter((i) => i.gallery === g.key);
      for (const name of feedNamen(g.key, locale, DEFAULT_LOCALE)) {
        writeJSON(path.join(OUT, "galleries", name), teil);
        geschrieben++;
      }
    }
  }

  const feedItems = datensaetzeFuer(DEFAULT_LOCALE);

  // Index / Metadaten
  const index = {
    generatedAt: new Date().toISOString(),
    sites: config.sites.map((s) => ({
      key: s.key, label: s.label,
      count: feedItems.filter((i) => i.sites.includes(s.key)).length,
    })),
    galleries: config.galleries.map((g) => ({
      key: g.key, label: g.label, intro: g.intro || "",
      defaultSites: g.defaultSites || [],
      count: feedItems.filter((i) => i.gallery === g.key).length,
    })),
    tags: config.tags || [],
    locales: LOCALES,
    defaultLocale: DEFAULT_LOCALE,
    /* Wie weit ist jede Sprache? Praktisch, um zu sehen, wo noch
       Übersetzungen fehlen, ohne jede Datei zu öffnen. */
    translationProgress: Object.fromEntries(
      LOCALES.map((l) => {
        const liste = datensaetzeFuer(l);
        return [l, { uebersetzt: liste.filter((i) => i.translated).length, gesamt: liste.length }];
      })
    ),
    total: feedItems.length,
  };
  writeJSON(path.join(OUT, "index.json"), index);

  // Bericht
  const photos = feedItems.filter((i) => i.media === "photo").length;
  const videos = feedItems.filter((i) => i.media === "video").length;
  console.log(`OK  ${feedItems.length} Medien (${photos} Foto, ${videos} Video) · ` +
    `${config.sites.length} Sites · ${config.galleries.length} Galerien`);
  console.log(`    Sprachen: ${LOCALES.join(", ")} (Standard: ${DEFAULT_LOCALE}) · ${geschrieben} Feed-Dateien`);
  for (const l of LOCALES) {
    if (l === DEFAULT_LOCALE) continue;
    const liste = datensaetzeFuer(l);
    const n = liste.filter((i) => i.translated).length;
    console.log(`    ${l}: ${n}/${liste.length} uebersetzt` + (n < liste.length ? " — der Rest faellt auf " + DEFAULT_LOCALE + " zurueck" : ""));
  }
  if (warnings.length) {
    console.log(`\n  ⚠ ${warnings.length} Hinweis(e):`);
    for (const w of [...new Set(warnings)]) console.log("   - " + w);
  }
}

build();
