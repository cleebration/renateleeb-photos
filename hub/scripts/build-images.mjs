// ===========================================================================
//  Bild-Pipeline:  raw-media/<datei>  ->  public/media/<slug>.jpg
//  Aufruf:  npm run images   (lokal, nach `npm install`)
//
//  - Ordnet Originale den Medien zu (über den Dateinamen in den Daten).
//  - Gilt für Fotos UND Video-Poster (Spalte "Datei" beim Video = Standbild).
//  - Entfernt evtl. Drive-Hash-Präfix "<hex>-".
//  - Skaliert auf längste Kante 1600 px, JPEG q82, weißer Rand wird getrimmt.
//  - PDF braucht pdftoppm (brew install poppler / apt-get install poppler-utils).
//  - Rotation pro Medium über image-fixes.json:  { "<slug>": 90 }
//  - Schreibt public/media/_report.json (zugeordnet / fehlend / übersprungen).
//
//  YouTube/Vimeo-Videos brauchen KEINE lokale Datei – ihr Vorschaubild kommt
//  automatisch aus dem Feed (YouTube-Thumbnail). Nur selbst gehostete Videos
//  oder eigene Standbilder legst du als Datei ab.
// ===========================================================================

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { loadItems, ROOT } from "./lib.mjs";

const RAW = path.join(ROOT, "raw-media");
const OUT = path.join(ROOT, "public", "media");
const FIXES = path.join(ROOT, "image-fixes.json");

const HASH_PREFIX = /^[0-9a-f]{8,}-/i;
const MAX_EDGE = 1600;

function loadFixes() {
  try { return JSON.parse(fs.readFileSync(FIXES, "utf8")); } catch { return {}; }
}
function norm(name) {
  return name.replace(HASH_PREFIX, "").toLowerCase().replace(/\.[a-z0-9]+$/i, "");
}
function indexRaw() {
  if (!fs.existsSync(RAW)) return new Map();
  const map = new Map();
  for (const f of fs.readdirSync(RAW)) {
    if (f.startsWith(".")) continue;
    map.set(norm(f), path.join(RAW, f));
  }
  return map;
}
function pdfToPng(src) {
  const tmp = path.join(OUT, "_tmp_pdf");
  execFileSync("pdftoppm", ["-png", "-r", "200", "-singlefile", src, tmp]);
  return `${tmp}.png`;
}
async function process(srcPath, slug, rotate, options = {}) {
  let input = srcPath, tmp = null;
  if (/\.pdf$/i.test(srcPath)) { tmp = pdfToPng(srcPath); input = tmp; }
  let img = sharp(input, { failOn: "none" }).rotate(); // EXIF-Autorotate
  if (rotate) img = img.rotate(rotate);
  // Weißen Rand nur trimmen, wenn gewünscht (image-fixes.json: {"_options":{"trim":false}}).
  // Bei Fotos mit hellem Himmel/Hintergrund schneidet der Trim sonst ins Bild.
  if (options.trim !== false) img = img.trim({ threshold: 12 });
  img = img.resize(MAX_EDGE, MAX_EDGE, {
    fit: "inside", withoutEnlargement: true,
  });
  await img.jpeg({ quality: 82 }).toFile(path.join(OUT, `${slug}.jpg`));
  if (tmp && fs.existsSync(tmp)) fs.unlinkSync(tmp);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const raw = indexRaw();
  const fixes = loadFixes();
  const options = fixes._options || {};
  const report = { matched: [], missing: [], skipped: [] };

  // Nur Medien mit lokalem Dateinamen (Fotos + Video-Standbilder)
  const items = loadItems().filter((it) => it.image && !/^https?:\/\//.test(it.image));

  for (const it of items) {
    const src = raw.get(norm(it.image));
    if (!src) { report.missing.push(it.slug); continue; }
    try {
      await process(src, it.slug, fixes[it.slug], options);
      report.matched.push(it.slug);
    } catch (e) {
      report.skipped.push({ slug: it.slug, error: String(e.message || e) });
    }
  }

  fs.writeFileSync(path.join(OUT, "_report.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(`OK  ${report.matched.length} Bild(er) erzeugt · ` +
    `${report.missing.length} ohne Datei (zeigen „Bild folgt") · ${report.skipped.length} übersprungen`);
  if (report.skipped.length) for (const s of report.skipped) console.log("   ⚠", s.slug, s.error);
}

main();
