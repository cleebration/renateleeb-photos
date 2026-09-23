// ===========================================================================
//  Gemeinsamer Loader für beide Build-Skripte (build-feeds, build-images).
//  Liest ZWEI Quellen und führt sie zusammen:
//    1) data/medien.csv               (Bulk-Weg, Export aus Google Sheet)
//    2) content/medien/*.md           (eine Datei pro Medium, via Sveltia CMS)
//  Markdown-Einträge gewinnen bei gleichem Slug (sie sind die „kuratierte" Quelle).
// ===========================================================================

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { localeBlocks } from "./i18n.mjs";
import config from "../galleries.config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");
const CSV = path.join(ROOT, "data", "medien.csv");
const MD_DIR = path.join(ROOT, "content", "medien");

// --- Spalten-Synonyme (CSV) -> internes Feld ------------------------------
const COLS = {
  title: ["titel", "title", "werk"],
  firstName: ["vorname", "first name", "firstname", "first"],
  lastName: ["nachname", "last name", "lastname", "last", "familienname"],
  year: ["jahr", "jahrgang", "year"],
  technique: ["technik", "technique", "material"],
  gallery: ["galerie", "gallery", "sammlung", "collection"],
  tags: ["tags", "tag", "themen", "kategorie", "raum"],
  sites: ["seiten", "sites", "websites", "site"],
  media: ["medientyp", "medium", "media", "typ", "type"],
  image: ["datei", "bild", "image", "foto", "file", "poster"],
  video: ["video", "videolink", "videourl", "url"],
};

// --- robuster CSV-Parser (RFC 4180) ---------------------------------------
export function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\r") { /* skip */ }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const splitList = (v) =>
  String(v || "")
    .split(/[,;|\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);

function readCSVRows() {
  if (!fs.existsSync(CSV)) return [];
  const matrix = parseCSV(fs.readFileSync(CSV, "utf8"));
  if (!matrix.length) return [];
  const headers = matrix[0].map((h) => h.trim());
  return matrix.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((h, i) => (obj[h] = (cells[i] ?? "").trim()));
    return obj;
  });
}

function mapCSVRow(row) {
  const lower = {};
  for (const [k, v] of Object.entries(row)) lower[k.trim().toLowerCase()] = v;
  const pick = (field) => {
    for (const name of COLS[field]) if (name in lower) return String(lower[name]).trim();
    return "";
  };
  const year = parseInt(pick("year"), 10);
  return {
    _source: "csv",
    title: pick("title"),
    firstName: pick("firstName"),
    lastName: pick("lastName"),
    year: Number.isFinite(year) ? year : null,
    technique: pick("technique"),
    gallery: slugify(pick("gallery")),
    tags: splitList(pick("tags")).map(slugify),
    sites: splitList(pick("sites")).map((s) => s.toLowerCase()),
    media: (pick("media") || "").toLowerCase(),
    image: pick("image"),
    video: pick("video"),
    body: "",
  };
}

function readMarkdown() {
  if (!fs.existsSync(MD_DIR)) return [];
  return fs.readdirSync(MD_DIR)
    .filter((f) => f.endsWith(".md") && !f.startsWith("."))
    .map((f) => {
      const { data, content } = matter(fs.readFileSync(path.join(MD_DIR, f), "utf8"));
      const year = parseInt(data.year, 10);
      return {
        _source: "md",
        _file: f,
        slug: data.slug ? slugify(data.slug) : "",
        title: (data.title || "").toString().trim(),
        firstName: (data.firstName || data.vorname || "").toString().trim(),
        lastName: (data.lastName || data.nachname || "").toString().trim(),
        year: Number.isFinite(year) ? year : null,
        technique: (data.technique || data.technik || "").toString().trim(),
        gallery: slugify(data.gallery || data.galerie || ""),
        tags: (Array.isArray(data.tags) ? data.tags : splitList(data.tags)).map(slugify),
        sites: (Array.isArray(data.sites) ? data.sites : splitList(data.sites)).map((s) =>
          String(s).toLowerCase()
        ),
        media: (data.media || "").toString().toLowerCase(),
        image: (data.image || data.bild || "").toString().trim(),
        video: (data.video || "").toString().trim(),
        body: content.trim(),
        // Sprachbloecke unveraendert durchreichen (siehe scripts/i18n.mjs).
        // Ohne das faende der Feed-Builder sie nie.
        i18n: localeBlocks(data),
      };
    });
}

function uniqueSlug(base, used) {
  let slug = base || "medium";
  let i = 2;
  while (used.has(slug)) slug = `${base}-${i++}`;
  used.add(slug);
  return slug;
}

// Galerie-Default-Sites nachschlagen
function defaultSitesFor(galleryKey) {
  const g = config.galleries.find((x) => x.key === galleryKey);
  return g?.defaultSites ? [...g.defaultSites] : [];
}

// Liefert die normalisierte, zusammengeführte Medienliste.
// Jedes Item: { slug, title, firstName, lastName, year, technique, media,
//               image(roh-Dateiname/URL), video(roh), gallery, sites[], tags[], body }
export function loadItems() {
  const csv = readCSVRows().map(mapCSVRow);
  const md = readMarkdown();
  const all = [...csv, ...md].filter((r) => r.firstName || r.lastName || r.title);

  const used = new Set();
  const bySlug = new Map();

  for (const r of all) {
    // Medientyp ableiten: explizit, sonst „video" wenn Video-URL vorhanden
    const media = r.media === "video" || (!r.media && r.video) ? "video" : "photo";

    // Sites: Item-Angabe gewinnt, sonst Galerie-Default
    const sites = r.sites.length ? r.sites : defaultSitesFor(r.gallery);

    const baseSlug =
      r.slug ||
      slugify([r.firstName, r.lastName, r.title].filter(Boolean).join("-")) ||
      "medium";

    // MD gewinnt bei Slug-Kollision (kuratierte Quelle) und ersetzt den Eintrag.
    // Zwei Medien mit gleichem Titel in derselben Quelle sind dagegen KEINE
    // Kollision, sondern zwei Werke: sie bekommen fortlaufende Slugs. Vorher
    // fiel das zweite still unter den Tisch.
    if (r._source === "md" && bySlug.has(baseSlug)) {
      bySlug.set(baseSlug, { ...r, media, sites, slug: baseSlug });
      continue;
    }
    const slug = r._source === "md" && r.slug ? r.slug : uniqueSlug(baseSlug, used);
    used.add(slug);
    bySlug.set(slug, { ...r, media, sites, slug });
  }

  return [...bySlug.values()];
}

export { config };
