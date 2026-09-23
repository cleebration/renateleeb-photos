// ===========================================================================
//  Rauchtest — prüft das gebaute dist/ und den Worker.
//  Aufruf:  npm run build && npm test
// ===========================================================================

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import site from "../site.config.mjs";
import worker from "../worker/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");

let ok = 0;
const fails = [];
const check = (name, cond, detail = "") => {
  if (cond) { ok++; }
  else fails.push(name + (detail ? ` — ${detail}` : ""));
};
const read = (p) => fs.readFileSync(path.join(DIST, p), "utf8");
const dom = (p) => new JSDOM(read(p)).window.document;

// --- 1. Alle Seiten da -----------------------------------------------------
const seiten = [
  "index.html", "kuenstlernatur/index.html", "ueber-mich/index.html",
  "kontakt/index.html", "impressum/index.html", "datenschutz/index.html", "404.html",
];
for (const s of seiten) check(`Seite ${s} gebaut`, fs.existsSync(path.join(DIST, s)));
check("sitemap.xml gebaut", fs.existsSync(path.join(DIST, "sitemap.xml")));
check("robots.txt gebaut", fs.existsSync(path.join(DIST, "robots.txt")));

// --- 2. Kopf, Navigation, Fuß ---------------------------------------------
for (const s of seiten) {
  const d = dom(s);
  check(`${s}: Titel gesetzt`, (d.title || "").length > 3);
  check(`${s}: Sprache de`, d.documentElement.lang === "de");
  check(`${s}: Navigation vorhanden`, !!d.querySelector(".mast-nav a"));
  check(`${s}: Impressum im Fuß verlinkt`, !!d.querySelector('footer a[href="/impressum/"]'));
  check(`${s}: cleebration-Credit`, read(s).includes("cleebration.com"));
}

// --- 3. Buchprojekte zeigen nach außen, nicht auf eine eigene Seite --------
for (const s of ["index.html", "kuenstlernatur/index.html", "kontakt/index.html"]) {
  const d = dom(s);
  const buch = [...d.querySelectorAll(".mast-nav a")].find((a) => /Buchprojekte/i.test(a.textContent));
  check(`${s}: Menüpunkt Buchprojekte vorhanden`, !!buch);
  check(`${s}: Buchprojekte zeigt auf renateundchris.com`,
    !!buch && buch.getAttribute("href").startsWith(site.books.url));
  check(`${s}: Buchprojekte öffnet extern`, !!buch && buch.getAttribute("rel") === "noopener");
}

// --- 4. Galerie ------------------------------------------------------------
{
  const d = dom("kuenstlernatur/index.html");
  const grid = d.querySelector("gallery-grid");
  check("Galerie: <gallery-grid> eingebaut", !!grid);
  check("Galerie: Feed-Adresse gesetzt", !!grid && grid.getAttribute("feed") === site.galleryFeed);
  check("Galerie: Filterleiste an", !!grid && grid.getAttribute("filter") === "on");
  check("Galerie: Modul wird geladen", read("kuenstlernatur/index.html").includes("/gallery-widget.js"));
  check("Galerie: Modul liegt in dist", fs.existsSync(path.join(DIST, "gallery-widget.js")));

  const feedPfad = path.join(DIST, site.galleryFeed.replace(/^\//, ""));
  check("Galerie: Feed liegt in dist", fs.existsSync(feedPfad));
  if (fs.existsSync(feedPfad)) {
    const feed = JSON.parse(fs.readFileSync(feedPfad, "utf8"));
    const items = Array.isArray(feed) ? feed : feed.items || [];
    check("Galerie: 53 Medien im Feed", items.length === 53, `${items.length} gefunden`);
    check("Galerie: beide Tags vorhanden",
      ["motiv", "collage"].every((t) => items.some((i) => i.tags.includes(t))));
    const slugs = new Set(items.map((i) => i.slug));
    check("Galerie: Slugs eindeutig", slugs.size === items.length);
    check("Galerie: jedes Medium hat einen Titel", items.every((i) => (i.title || "").length > 0));
    check("Galerie: doppelter Titel behält beide Bilder",
      items.filter((i) => i.title === "Rotes Blatt").length === 2);
  }
}

// --- 5. Über mich ----------------------------------------------------------
{
  const html = read("ueber-mich/index.html");
  check("Über mich: Text übernommen", html.includes("Thales von Milet"));
  check("Über mich: Schlusszitat vorhanden", html.includes("offenen Augen durchs Leben"));
}

// --- 6. Kontaktformular ----------------------------------------------------
{
  const d = dom("kontakt/index.html");
  const form = d.querySelector("form.kontakt");
  check("Kontakt: Formular vorhanden", !!form);
  check("Kontakt: sendet an /api/kontakt", !!form && form.getAttribute("action") === "/api/kontakt");
  for (const f of ["name", "email", "nachricht", "einwilligung"]) {
    check(`Kontakt: Feld ${f}`, !!d.querySelector(`[name="${f}"]`));
  }
  check("Kontakt: Honigtopf vorhanden", !!d.querySelector('.hp [name="website"]'));
  check("Kontakt: Einwilligung verpflichtend", !!d.querySelector('[name="einwilligung"][required]'));
  check("Kontakt: Datenschutz verlinkt", read("kontakt/index.html").includes('href="/datenschutz/"'));
  check("Kontakt: E-Mail-Adresse als Rückfallebene",
    read("kontakt/index.html").includes(`mailto:${site.contactEmail}`));
}

// --- 7. Rechtstexte --------------------------------------------------------
{
  const imp = read("impressum/index.html");
  check("Impressum: § 5 ECG genannt", imp.includes("§ 5 ECG"));
  check("Impressum: Medieninhaber genannt", imp.includes(site.owner.name) && imp.includes(site.owner.street));
  check("Impressum: keine offenen Platzhalter", !imp.includes("{{"));
  const dsg = read("datenschutz/index.html");
  check("Datenschutz: Hoster ist Cloudflare", dsg.includes("Cloudflare"));
  check("Datenschutz: nicht mehr Vercel", !dsg.includes("Vercel"));
  check("Datenschutz: Kontaktformular beschrieben", dsg.includes("Kontaktformular"));
  check("Datenschutz: Schriften kommen vom eigenen Server", dsg.includes("Cormorant Garamond"));
  check("Datenschutz: sagt ausdrücklich, dass nichts bei Google geladen wird",
    /keine\s+Verbindung\s+zu\s+Google\s+Fonts/.test(dsg));
  check("Datenschutz: keine IP-Übertragung an Google mehr behauptet",
    !dsg.includes("wird deine IP-Adresse an Google übertragen"));
  check("Datenschutz: keine offenen Platzhalter", !dsg.includes("{{"));
}

// --- 8. Nichts hängt mehr am alten Anbieter -------------------------------
{
  const alle = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(html|css|js|json|xml|txt)$/.test(e.name)) alle.push(p);
    }
  })(DIST);
  const fremd = alle.filter((p) => /wixstatic|wixsite|wixdns|parastorage|blogspot|blogger\.com/i.test(fs.readFileSync(p, "utf8")));
  const google = alle.filter((p) => /fonts\.(googleapis|gstatic)\.com/i.test(fs.readFileSync(p, "utf8")));
  check("Keine Schriften von Google — alles vom eigenen Server", google.length === 0,
    google.map((p) => path.relative(DIST, p)).join(", "));
  for (const f of ["fonts.css", "assets/fonts/karla-latin-400-normal.woff2",
                   "assets/fonts/cormorant-garamond-latin-ext-400-normal.woff2"]) {
    check(`Schriftdatei ${f} liegt in dist`, fs.existsSync(path.join(DIST, f)));
  }
  check("Keine Adressen des alten Anbieters im Bestand", fremd.length === 0,
    fremd.map((p) => path.relative(DIST, p)).join(", "));

  const copyOf = alle.filter((p) => /copy-of-kuenstlernatur/.test(fs.readFileSync(p, "utf8")));
  check("Keine alten Wix-Slugs in den Seiten", copyOf.length === 0,
    copyOf.map((p) => path.relative(DIST, p)).join(", "));
}

// --- 9. Worker: Weiterleitungen und Formularprüfung ------------------------
const env = {
  KONTAKT_EMPFAENGER: "kontakt@renateleeb.photos",
  ASSETS: { fetch: async () => new Response("asset", { status: 200 }) },
};
const anfrage = (url, init) => worker.fetch(new Request(url, init), env);

{
  const faelle = [
    ["https://www.renateleeb.photos/", "https://renateleeb.photos/"],
    ["https://renateleeb.photos/copy-of-kuenstlernatur-naturkuenstl", site.books.url],
    ["https://renateleeb.photos/copy-of-kuenstlernatur-naturkuenstl-1", site.books.url],
    ["https://renateleeb.photos/kuenstlernatur", "https://renateleeb.photos/kuenstlernatur/"],
    ["https://renateleeb.photos/home", "https://renateleeb.photos/"],
  ];
  for (const [von, nach] of faelle) {
    const res = await anfrage(von);
    check(`Weiterleitung ${new URL(von).pathname || "/"} → ${nach}`,
      res.status === 301 && (res.headers.get("location") || "").startsWith(nach),
      `${res.status} ${res.headers.get("location")}`);
  }
  const normal = await anfrage("https://renateleeb.photos/kuenstlernatur/");
  check("Normale Adresse wird ausgeliefert, nicht weitergeleitet", normal.status === 200);
}

// --- 10. Worker: Formular --------------------------------------------------
{
  const post = (body, e = env) =>
    worker.fetch(new Request("https://renateleeb.photos/api/kontakt", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    }), e);

  const gueltig = { name: "Test Person", email: "test@example.org", nachricht: "Hallo Renate!", einwilligung: "ja" };

  check("Formular: GET wird abgewiesen",
    (await worker.fetch(new Request("https://renateleeb.photos/api/kontakt"), env)).status === 405);
  check("Formular: ohne Einwilligung abgelehnt",
    (await post({ ...gueltig, einwilligung: "" })).status === 422);
  check("Formular: ohne Namen abgelehnt", (await post({ ...gueltig, name: "" })).status === 422);
  check("Formular: kaputte E-Mail abgelehnt", (await post({ ...gueltig, email: "keine-mail" })).status === 422);
  check("Formular: leere Nachricht abgelehnt", (await post({ ...gueltig, nachricht: "" })).status === 422);
  check("Formular: ohne Versandweg sauberer Fehler (kein Absturz)",
    (await post(gueltig)).status === 502);

  // Honigtopf: sieht für die Maschine wie Erfolg aus, verschickt aber nichts
  let verschickt = 0;
  const envHook = { ...env, FORM_WEBHOOK_URL: "https://hook.example/x" };
  const echtesFetch = globalThis.fetch;
  globalThis.fetch = async () => { verschickt++; return new Response("{}", { status: 200 }); };
  try {
    const spam = await post({ ...gueltig, website: "http://spam.example" }, envHook);
    check("Formular: Honigtopf verschickt nichts", spam.status === 200 && verschickt === 0);
    const echt = await post(gueltig, envHook);
    check("Formular: gültige Nachricht geht raus", echt.status === 200 && verschickt === 1);
  } finally {
    globalThis.fetch = echtesFetch;
  }
}

// --- Ergebnis --------------------------------------------------------------
console.log(`\n${ok} Prüfungen bestanden` + (fails.length ? `, ${fails.length} fehlgeschlagen:` : ""));
for (const f of fails) console.log("   ✗ " + f);
process.exit(fails.length ? 1 : 0);
