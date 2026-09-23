/**
 * i18n.mjs — Mehrsprachigkeit für den Hub.
 *
 * Absichtlich NICHT auf Deutsch und Englisch festgelegt: die Sprachen stehen
 * in i18n.config.json, und alles hier arbeitet über diese Liste. Eine dritte
 * Sprache hinzufügen heißt: Code in `locales` ergänzen, neu bauen, fertig.
 *
 * Wie ein Inhalt aussieht
 * -----------------------
 * Übersetzbare Felder stehen in einem Block pro Sprache. Die Fakten
 * (Datum, Bild, Ort, Tags …) stehen nur einmal — sie sind in jeder Sprache
 * dieselben, und doppelt gepflegte Daten laufen früher oder später
 * auseinander.
 *
 *     ---
 *     slug: bejoy
 *     image: /media/bejoy.jpg
 *     de:
 *       title: "BeJoy"
 *       body: "Leb dein Leben."
 *     en:
 *       title: "BeJoy"
 *       body: "Live your life."
 *     ---
 *
 * Altbestand ohne Sprachblöcke funktioniert weiter: stehen `title` und der
 * Fließtext direkt oben, gelten sie als Standardsprache.
 */

/** Sieht der Schlüssel aus wie ein Sprachcode? "de", "en", "pt-BR" … */
const SPRACHCODE = /^[a-z]{2}(-[A-Za-z0-9]{2,8})?$/;

/**
 * Sammelt alle Sprachblöcke aus dem Vorspann einer Inhalts-Datei.
 * Nur Schlüssel, die wie ein Sprachcode aussehen UND ein Objekt enthalten —
 * so kann ein Feld namens `de` als Zeichenkette nie versehentlich als
 * Sprachblock gelesen werden.
 */
export function localeBlocks(data = {}) {
  const out = {};
  for (const [key, value] of Object.entries(data)) {
    if (!SPRACHCODE.test(key)) continue;
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    out[key] = value;
  }
  return out;
}

/**
 * Einen übersetzbaren Wert holen, mit Rückfallkette:
 *   1. der Sprachblock der gewünschten Sprache
 *   2. der Sprachblock der Standardsprache
 *   3. das gleichnamige Feld direkt im Vorspann (Altbestand)
 *
 * @returns {string|null}
 */
export function pick(item, locale, field, defaultLocale) {
  const blocks = item.i18n || {};

  const hier = blocks[locale]?.[field];
  if (hier != null && String(hier).trim() !== "") return hier;

  const standard = blocks[defaultLocale]?.[field];
  if (standard != null && String(standard).trim() !== "") return standard;

  const alt = item[field];
  if (alt != null && String(alt).trim() !== "") return alt;

  return null;
}

/**
 * Liegt dieser Inhalt in dieser Sprache wirklich übersetzt vor?
 *
 * Maßstab ist der Titel: wer einen Titel übersetzt hat, hat den Eintrag
 * angefasst. Die Standardsprache gilt immer als übersetzt — sie ist das
 * Original.
 *
 * Das Anzeige-Modul macht daraus den Hinweis „Übersetzung folgt", damit ein
 * Rückfall auf die Standardsprache sichtbar ist statt stillschweigend.
 */
export function istUebersetzt(item, locale, defaultLocale) {
  if (locale === defaultLocale) return true;
  const block = (item.i18n || {})[locale];
  return !!(block && block.title && String(block.title).trim() !== "");
}

/**
 * Dateiname eines Feeds für eine Sprache.
 *
 * Die Standardsprache bekommt zusätzlich den Namen ohne Sprachkürzel.
 * Das ist kein Schönheitsfehler, sondern Absicht: bestehende Einbindungen,
 * die noch `cleebration.json` abrufen, funktionieren unverändert weiter.
 */
export function feedNamen(basis, locale, defaultLocale) {
  const namen = [`${basis}.${locale}.json`];
  if (locale === defaultLocale) namen.push(`${basis}.json`);
  return namen;
}
