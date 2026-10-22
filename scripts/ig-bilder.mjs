// Instagram-Fassungen der Galerie-Bilder: 1080×1350 (4:5), ganzes Foto ohne Beschnitt auf Papierton.
// Instagram nimmt nur Seitenverhältnisse 4:5 bis 1,91:1 – die Panoramen (3:1) und Hochformate (1:3) der
// Künstlernatur würden sonst abgelehnt. Ziel: public/ig/<name>.jpg → https://renateleeb.photos/ig/<name>.jpg
// Benutzt von der Redaktion (Fotoserie „Künstlernatur“, wöchentlich auf Instagram). Vorhandene Dateien bleiben.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const QUELLE = process.argv[2] || path.join(ROOT, "hub", "public", "media");
const ZIEL = process.argv[3] || path.join(ROOT, "public", "ig");
const W = 1080, H = 1350, RAND = 60;
const PAPIER = { r: 0xec, g: 0xef, b: 0xe7 };

fs.mkdirSync(ZIEL, { recursive: true });
let neu = 0, da = 0;
for (const f of fs.readdirSync(QUELLE).filter((x) => /\.jpe?g$/i.test(x)).sort()) {
  const aus = path.join(ZIEL, f.replace(/\.jpe?g$/i, ".jpg"));
  if (fs.existsSync(aus) && fs.statSync(aus).mtimeMs >= fs.statSync(path.join(QUELLE, f)).mtimeMs) { da++; continue; }
  const bild = await sharp(path.join(QUELLE, f)).rotate()
    .resize(W - 2 * RAND, H - 2 * RAND, { fit: "inside", withoutEnlargement: false }).toBuffer();
  await sharp({ create: { width: W, height: H, channels: 3, background: PAPIER } })
    .composite([{ input: bild, gravity: "center" }]).jpeg({ quality: 88, mozjpeg: true }).toFile(aus);
  neu++;
}
console.log(`OK  Instagram-Bilder: ${neu} neu, ${da} vorhanden → ${path.relative(ROOT, ZIEL)}`);
