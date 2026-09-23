// ===========================================================================
//  Vorschau-Fassung: nimmt dist/ und macht daraus eine Version mit flachen
//  Dateinamen (index.html, kuenstlernatur.html …), damit die Seite sich auch
//  ohne Server anschauen lässt — z. B. als Artifact zur Abnahme.
//  Der Echtbetrieb bleibt unberührt: dist/ ist und bleibt die Wahrheit.
// ===========================================================================

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const OUT = path.join(ROOT, "preview");

const SEITEN = {
  "/": "index.html",
  "/kuenstlernatur/": "kuenstlernatur.html",
  "/ueber-mich/": "ueber-mich.html",
  "/kontakt/": "kontakt.html",
  "/impressum/": "impressum.html",
  "/datenschutz/": "datenschutz.html",
};

const BANNER = `<div style="background:#46592c;color:#f4f6f0;font:14px/1.5 system-ui;padding:10px 24px;text-align:center">
Vorschau von renateleeb.photos — Kontaktformular und Weiterleitungen laufen erst nach dem Deploy auf Cloudflare.
</div>`;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

function copyDir(from, to) {
  if (!fs.existsSync(from)) return 0;
  fs.mkdirSync(to, { recursive: true });
  let n = 0;
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, e.name), dst = path.join(to, e.name);
    if (e.isDirectory()) n += copyDir(src, dst);
    else { fs.copyFileSync(src, dst); n++; }
  }
  return n;
}

let seiten = 0;
for (const [url, datei] of Object.entries(SEITEN)) {
  const quelle = url === "/" ? path.join(DIST, "index.html") : path.join(DIST, url.replace(/^\/|\/$/g, ""), "index.html");
  let html = fs.readFileSync(quelle, "utf8");
  for (const [u, d] of Object.entries(SEITEN)) {
    html = html.replaceAll(`href="${u}"`, `href="${d}"`);
  }
  html = html.replace(/<body>/, `<body>\n${BANNER}`);
  fs.writeFileSync(path.join(OUT, datei), html, "utf8");
  seiten++;
}

for (const f of ["styles.css", "fonts.css", "kontakt.js", "gallery-widget.js"]) {
  fs.copyFileSync(path.join(DIST, f), path.join(OUT, f));
}
const nFeed = copyDir(path.join(DIST, "feed"), path.join(OUT, "feed"));
const nMedia = copyDir(path.join(DIST, "media"), path.join(OUT, "media"));
const nAssets = copyDir(path.join(DIST, "assets"), path.join(OUT, "assets"));

console.log(`OK  Vorschau in preview/ · ${seiten} Seiten · ${nFeed} Feeds · ${nMedia} Bilder · ${nAssets} Assets`);
