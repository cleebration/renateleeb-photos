// Erzeugt die Audiodateien der Sokrates-Dialoge mit Google Cloud Text-to-Speech (Chirp 3: HD).
// Läuft in der GitHub-Action "Stimmen Sokrates"; der Schlüssel kommt aus dem Repo-Geheimnis GOOGLE_TTS_KEY.
//
//   node scripts/tts-sokrates.mjs proben   → 3 Stimmproben je Figur + Seite /unterricht/sokrates/stimmen-proben/
//   node scripts/tts-sokrates.mjs alle     → alle Repliken nach audio/stimmen.json, dazu audio/manifest.json
//
// Bereits erzeugte Repliken (gleicher Text, gleiche Stimme, gleiches Tempo) werden nicht neu erzeugt.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SEITE = path.join(ROOT, "unterricht/sokrates/index.html");
const AUDIO = path.join(ROOT, "unterricht/sokrates/audio");
const PROBEN = path.join(ROOT, "unterricht/sokrates/stimmen-proben");
const STIMMEN = path.join(AUDIO, "stimmen.json");
const MANIFEST = path.join(AUDIO, "manifest.json");
const KEY = process.env.GOOGLE_TTS_KEY;
const modus = process.argv[2] || "alle";
const API = "https://texttospeech.googleapis.com/v1";

if (!KEY) { console.error("GOOGLE_TTS_KEY fehlt (Repo-Geheimnis)."); process.exit(1); }

// --- Dialoge und Figuren aus der Seite lesen -----------------------------------
const html = fs.readFileSync(SEITE, "utf8");
function block(start, endMarker) {
  const a = html.indexOf(start);
  if (a < 0) throw new Error("Nicht gefunden: " + start);
  const b = html.indexOf(endMarker, a);
  return html.slice(a + start.length, b);
}
const C = Function('"use strict";return(' + block("const C=", ";\nconst D=") + ")")();
const D = Function('"use strict";return(' + block("const D=", ";\n\nconst picker") + ")")();
const PROF = Function('"use strict";return(' + block("const PROF=", ";\nconst FEM") + ")")();

const figuren = new Map(); // Name → {g, rate, beispiel}
function fig(p, text) {
  if (!figuren.has(p.n)) {
    const pr = PROF[p.n] || ["m", 1, 1];
    figuren.set(p.n, { g: pr[0], rate: pr[2], beispiel: text });
  }
}
for (const d of D) for (const l of d.L) {
  const p = l[0] === "S" ? C.S : d.cast[l[0]];
  if (p) fig(p, l[1]);
}

// --- Google-Aufrufe ------------------------------------------------------------
async function g(url, body) {
  for (let versuch = 1; ; versuch++) {
    const r = await fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
    if (r.ok) return r.json();
    const t = await r.text();
    if ((r.status === 429 || r.status >= 500) && versuch < 5) { await new Promise(res => setTimeout(res, 2000 * versuch)); continue; }
    throw new Error(`Google TTS ${r.status}: ${t.slice(0, 300)}`);
  }
}
async function stimmenListe() {
  const j = await g(`${API}/voices?languageCode=de-DE&key=${KEY}`);
  return j.voices.filter(v => /Chirp3-HD/.test(v.name) && v.languageCodes.includes("de-DE"))
    .map(v => ({ name: v.name, g: v.ssmlGender === "FEMALE" ? "w" : v.ssmlGender === "MALE" ? "m" : "n" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
let zeichen = 0;
async function sprich(text, voice, rate, ziel) {
  zeichen += text.length;
  const j = await g(`${API}/text:synthesize?key=${KEY}`, {
    input: { text },
    voice: { languageCode: "de-DE", name: voice },
    audioConfig: { audioEncoding: "MP3", speakingRate: rate },
  });
  fs.mkdirSync(path.dirname(ziel), { recursive: true });
  fs.writeFileSync(ziel, Buffer.from(j.audioContent, "base64"));
}
const kurz = s => (s.length <= 160 ? s : s.slice(0, s.lastIndexOf(" ", 160)) + " …");
const slug = s => s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Je Figur drei Kandidaten passenden Geschlechts, möglichst ohne Doppelungen
function kandidaten(liste) {
  const pools = { w: liste.filter(v => v.g === "w"), m: liste.filter(v => v.g === "m") };
  const zaehler = { w: 0, m: 0 };
  const out = new Map();
  for (const [name, f] of figuren) {
    const pool = f.g === "w" ? pools.w : f.g === "m" ? pools.m : [...pools.m, ...pools.w];
    const k = f.g === "n" ? "m" : f.g;
    const pick = [0, 1, 2].map(i => pool[(zaehler[k] + i) % pool.length].name);
    zaehler[k] += 3;
    out.set(name, pick);
  }
  return out;
}

const liste = await stimmenListe();
if (!liste.length) throw new Error("Keine deutschen Chirp-3-HD-Stimmen gefunden.");
console.log(`${liste.length} deutsche Chirp-3-HD-Stimmen (${liste.filter(v => v.g === "w").length} w, ${liste.filter(v => v.g === "m").length} m)`);
const kand = kandidaten(liste);

// stimmen.json: Figur → {stimme, tempo}. Fehlt eine Figur, nimmt sie Kandidat 1.
let stimmen = fs.existsSync(STIMMEN) ? JSON.parse(fs.readFileSync(STIMMEN, "utf8")) : {};
let neu = false;
for (const [name, f] of figuren) {
  if (!stimmen[name] || !liste.some(v => v.name === stimmen[name].stimme)) {
    stimmen[name] = { stimme: kand.get(name)[0], tempo: f.rate }; neu = true;
  }
}
if (neu) { fs.mkdirSync(AUDIO, { recursive: true }); fs.writeFileSync(STIMMEN, JSON.stringify(stimmen, null, 2) + "\n"); }

if (modus === "proben") {
  const zeilen = [];
  for (const [name, f] of figuren) {
    const text = kurz(f.beispiel);
    const opts = [];
    for (const [i, v] of kand.get(name).entries()) {
      const datei = `${slug(name)}-${i + 1}.mp3`;
      await sprich(text, v, f.rate, path.join(PROBEN, datei));
      opts.push({ i: i + 1, v, datei, aktiv: stimmen[name].stimme === v });
    }
    zeilen.push({ name, text, opts });
  }
  const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  fs.writeFileSync(path.join(PROBEN, "index.html"), `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>Stimmproben Sokrates</title>
<style>:root{--bg:#f7f5f0;--ink:#1d2a33;--muted:#5d6b73;--line:#d9d4c7;--mark:#f2e86d}
@media (prefers-color-scheme:dark){:root{--bg:#141a1e;--ink:#e8e4da;--muted:#9aa6ad;--line:#2c363c;--mark:#6b6420}}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,sans-serif}main{max-width:760px;margin:0 auto;padding:24px 16px 60px}
h1{font-size:1.5rem}p.m{color:var(--muted)}section{border-top:1px solid var(--line);padding:16px 0}h2{font-size:1.1rem;margin:0 0 4px}
q{display:block;color:var(--muted);font-style:italic;margin-bottom:10px}.o{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:6px 0}
.o b{width:1.6em}.o small{color:var(--muted)}.o.on b{background:var(--mark);border-radius:4px;text-align:center}audio{height:36px;max-width:100%}</style></head>
<body><main><h1>Stimmproben · Sokrates auf der Agora</h1>
<p class="m">Je Figur drei KI-Stimmen (Google Chirp 3: HD), keine nachempfundenen Stimmen echter Personen. Markiert ist die aktuell eingestellte. Sag Claude zum Beispiel „Sokrates 2, Pythia 3“.</p>
${zeilen.map(z => `<section><h2>${esc(z.name)}</h2><q>${esc(z.text)}</q>${z.opts.map(o => `<div class="o${o.aktiv ? " on" : ""}"><b>${o.i}</b><audio controls preload="none" src="${o.datei}"></audio><small>${esc(o.v.replace("de-DE-Chirp3-HD-", ""))}</small></div>`).join("")}</section>`).join("\n")}
</main></body></html>
`);
  console.log(`Proben: ${zeilen.length} Figuren, ${zeichen} Zeichen`);
} else {
  const alt = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : { dialoge: {} };
  const manifest = { erzeugt: new Date().toISOString(), modell: "Google Chirp 3: HD", dialoge: {} };
  const behalten = new Set(["stimmen.json", "manifest.json"]);
  let neuErzeugt = 0;
  for (const d of D) {
    manifest.dialoge[d.id] = [];
    for (const [i, l] of d.L.entries()) {
      const p = l[0] === "S" ? C.S : d.cast[l[0]];
      const st = stimmen[p.n];
      const h = crypto.createHash("sha1").update(`${l[1]}|${st.stimme}|${st.tempo}`).digest("hex").slice(0, 10);
      const datei = `${d.id}-${String(i).padStart(2, "0")}-${h}.mp3`;
      behalten.add(datei);
      manifest.dialoge[d.id].push(datei);
      if (!fs.existsSync(path.join(AUDIO, datei))) { await sprich(l[1], st.stimme, st.tempo, path.join(AUDIO, datei)); neuErzeugt++; }
    }
  }
  for (const f of fs.readdirSync(AUDIO)) if (!behalten.has(f)) fs.unlinkSync(path.join(AUDIO, f)); // veraltete Fassungen
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + "\n");
  console.log(`Alle: ${neuErzeugt} Repliken neu erzeugt, ${zeichen} Zeichen`);
}
