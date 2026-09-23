// ===========================================================================
//  Cloudflare Worker — eine Stelle für alles, was nicht statisch ist:
//   1. Weiterleitungen (alte Wix-Adressen, www → ohne www)
//   2. Kontaktformular  POST /api/kontakt
//  Alles andere kommt aus dem Asset-Ordner (dist/).
//
//  Lehre aus dem cleebration-Umzug: Weiterleitungen gehören an EINE Stelle,
//  sonst entscheiden zwei Schichten dasselbe verschieden. Darum hier im Worker
//  und nicht zusätzlich in public/_redirects.
// ===========================================================================

const CANONICAL_HOST = "renateleeb.photos";
const BOOKS_URL = "https://renateundchris.com";

// Alte Wix-Adressen → neues Ziel. Schlüssel ohne abschließenden Schrägstrich.
const REDIRECTS = new Map([
  ["/kuenstlernatur", "/kuenstlernatur/"],
  ["/copy-of-kuenstlernatur-naturkuenstl", BOOKS_URL],        // „Meine Buchprojekte"
  ["/copy-of-kuenstlernatur-naturkuenstl-1", BOOKS_URL],      // „Dubbles" (kommt dorthin)
  ["/dubbles", BOOKS_URL],
  ["/buchprojekte", BOOKS_URL],
  ["/ueber-mich", "/ueber-mich/"],
  ["/kontakt", "/kontakt/"],
  ["/impressum", "/impressum/"],
  ["/datenschutz", "/datenschutz/"],
  ["/home", "/"],
]);

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

const textPage = (title, body, status = 200) =>
  new Response(
    `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<link rel="stylesheet" href="/styles.css"></head><body><div class="wrap">
<section class="hero"><h1>${title}</h1><p class="lede">${body}</p>
<p><a href="/">Zur Startseite</a></p></section></div></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );

function clean(v, max) {
  return String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
}

async function handleKontakt(request, env) {
  const wantsJson = (request.headers.get("accept") || "").includes("application/json");
  let data = {};
  const ct = request.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) data = await request.json();
    else data = Object.fromEntries((await request.formData()).entries());
  } catch {
    return wantsJson ? json({ error: "Ungültige Anfrage." }, 400)
                     : textPage("Ungültige Anfrage", "Bitte versuch es noch einmal.", 400);
  }

  // Honigtopf: ausgefüllt = Maschine. Wir antworten freundlich und tun nichts.
  if (clean(data.website, 200)) return wantsJson ? json({ ok: true }) : textPage("Danke", "Die Nachricht ist unterwegs.");

  const name = clean(data.name, 120);
  const email = clean(data.email, 200);
  const nachricht = String(data.nachricht || "").trim().slice(0, 5000);
  const einwilligung = data.einwilligung === "ja" || data.einwilligung === true || data.einwilligung === "on";

  const fehler = [];
  if (name.length < 2) fehler.push("Name fehlt.");
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) fehler.push("E-Mail-Adresse sieht nicht gültig aus.");
  if (nachricht.length < 5) fehler.push("Nachricht fehlt.");
  if (!einwilligung) fehler.push("Ohne Einwilligung dürfen wir die Anfrage nicht verarbeiten.");
  if (fehler.length) {
    return wantsJson ? json({ error: fehler.join(" ") }, 422)
                     : textPage("Das hat nicht geklappt", fehler.join(" "), 422);
  }

  const empfaenger = env.KONTAKT_EMPFAENGER || "kontakt@renateleeb.photos";
  const betreff = `Kontaktformular renateleeb.photos — ${name}`;
  const text = `Von: ${name} <${email}>\n\n${nachricht}\n\n—\nGesendet über das Formular auf renateleeb.photos`;

  try {
    if (env.RESEND_API_KEY) {
      // Variante A: Resend (eigener Absender auf der Domain nötig)
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.RESEND_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from: env.RESEND_FROM || `Formular <formular@${CANONICAL_HOST}>`,
          to: [empfaenger],
          reply_to: email,
          subject: betreff,
          text,
        }),
      });
      if (!res.ok) throw new Error(`Resend ${res.status}`);
    } else if (env.FORM_WEBHOOK_URL) {
      // Variante B: Webhook (z. B. Zapier Catch Hook → Gmail)
      const res = await fetch(env.FORM_WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, nachricht, betreff, empfaenger, quelle: CANONICAL_HOST }),
      });
      if (!res.ok) throw new Error(`Webhook ${res.status}`);
    } else {
      throw new Error("Kein Versandweg konfiguriert (RESEND_API_KEY oder FORM_WEBHOOK_URL setzen).");
    }
  } catch (err) {
    console.log("Kontaktformular fehlgeschlagen:", err.message);
    const msg = "Die Nachricht konnte gerade nicht zugestellt werden. Schreib bitte direkt an " + empfaenger + ".";
    return wantsJson ? json({ error: msg }, 502) : textPage("Das hat nicht geklappt", msg, 502);
  }

  return wantsJson
    ? json({ ok: true })
    : textPage("Danke", "Die Nachricht ist unterwegs. Ich melde mich.");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Kanonischer Name: www und alte Hosts auf renateleeb.photos
    if (url.hostname !== CANONICAL_HOST && url.hostname.endsWith(CANONICAL_HOST)) {
      url.hostname = CANONICAL_HOST;
      return Response.redirect(url.toString(), 301);
    }

    // 2. Kontaktformular
    if (url.pathname === "/api/kontakt") {
      if (request.method !== "POST") return json({ error: "Nur POST." }, 405);
      return handleKontakt(request, env);
    }

    // 3. Weiterleitungen (ohne abschließenden Schrägstrich vergleichen)
    const key = url.pathname.replace(/\/+$/, "").toLowerCase() || "/";
    if (REDIRECTS.has(key)) {
      const ziel = REDIRECTS.get(key);
      if (ziel !== url.pathname) {
        return Response.redirect(ziel.startsWith("http") ? ziel : url.origin + ziel, 301);
      }
    }

    // 4. Alles andere: statische Dateien
    return env.ASSETS.fetch(request);
  },
};
