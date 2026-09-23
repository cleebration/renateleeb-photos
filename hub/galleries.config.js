// ===========================================================================
//  HUB-KONFIGURATION (Galerie-Kit) — renateleeb.photos
//  sites     = WO ein Medium erscheint
//  galleries = WELCHE Galerie (eigene Überschrift/URL)
//  tags      = Filter INNERHALB einer Galerie
// ===========================================================================

const config = {
  sites: [{ key: "renateleeb", label: "Renate Leeb — Fotografie" }],

  privacy: {
    nameDisplay: "full",
    showYear: false,
  },

  galleries: [
    {
      key: "kuenstlernatur",
      label: "Künstlernatur · Naturkünstler",
      intro:
        "Makroaufnahmen von Blüten, Blättern und Wasser — die Natur als Gestalterin, gesehen aus nächster Nähe.",
      defaultSites: ["renateleeb"],
    },
  ],

  tags: [
    { key: "motiv", label: "Motive", color: "#46592c" },
    { key: "collage", label: "Collagen", color: "#7a6a3c" },
  ],

  tagPalette: ["#46592c", "#7a6a3c", "#5b7a52", "#6c7064"],
};

export default config;
