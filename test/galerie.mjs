// ===========================================================================
//  Galerie im Leerlauf: lässt das Modul mit UNSEREM Feed in jsdom laufen.
//  Prüft, was der Rauchtest über dist/ nicht sehen kann — der Inhalt des
//  Galerie-Moduls steht im Shadow DOM und ist für jede Textprüfung unsichtbar.
//  Aufruf:  npm run build && node test/galerie.mjs
// ===========================================================================

import fs from "node:fs";
import path from "node:path";
import { JSDOM } from "jsdom";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FEED = JSON.parse(fs.readFileSync(path.join(ROOT, "dist", "feed", "galleries", "kuenstlernatur.json"), "utf8"));

const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "https://renateleeb.photos/kuenstlernatur/" });
const { window } = dom;
for (const k of ["window", "document", "customElements", "HTMLElement", "Node", "location"]) {
  globalThis[k] = window[k];
}
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => FEED });

let ok = 0;
const fails = [];
const check = (name, cond, detail = "") => { cond ? ok++ : fails.push(name + (detail ? ` — ${detail}` : "")); };
const tick = () => new Promise((r) => setTimeout(r, 0));

await import(pathToFileURL(path.join(ROOT, "module", "gallery-widget.js")).href);

const grid = window.document.createElement("gallery-grid");
grid.setAttribute("feed", "/feed/galleries/kuenstlernatur.json");
grid.setAttribute("gallery", "kuenstlernatur");
grid.setAttribute("filter", "on");
window.document.body.appendChild(grid);
await tick(); await tick();

const sr = grid.shadowRoot;
const tiles = sr.querySelectorAll(".tile");
check("53 Kacheln", tiles.length === 53, `${tiles.length} gezeichnet`);

const chipText = [...sr.querySelectorAll(".chip")].map((c) => c.textContent.trim());
check("Filter zeigt Motive", chipText.some((t) => t.includes("Motive")), chipText.join(", "));
check("Filter zeigt Collagen", chipText.some((t) => t.includes("Collagen")), chipText.join(", "));
check("kein roher Tag-Schlüssel auf den Knöpfen",
  !chipText.includes("motiv") && !chipText.includes("collage"), chipText.join(", "));

const bilder = [...sr.querySelectorAll(".tile img")].map((i) => i.getAttribute("src") || "");
check("jede Kachel hat ein Bild", bilder.length === 53, `${bilder.length} Bilder`);
check("Bilder zeigen auf /media/", bilder.every((s) => s.startsWith("/media/")));
check("alle Bilddateien liegen wirklich in dist",
  bilder.every((s) => fs.existsSync(path.join(ROOT, "dist", s.replace(/^\//, "")))));

check("Lightbox vorhanden", !!sr.querySelector(".lb"));
sr.querySelector('.tile[data-idx="0"]').dispatchEvent(new window.Event("click", { bubbles: true }));
await tick();
check("Lightbox öffnet", !!sr.querySelector(".lb[open]"));
check("Foto wird groß gezeigt", !!sr.querySelector(".lb__stage img"));

console.log(`\n${ok} Galerie-Prüfungen bestanden` + (fails.length ? `, ${fails.length} fehlgeschlagen:` : ""));
for (const f of fails) console.log("   ✗ " + f);
process.exit(fails.length ? 1 : 0);
