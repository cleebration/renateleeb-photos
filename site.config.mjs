// ===========================================================================
//  Steckbrief der Website renateleeb.photos
//  Die einzige Datei mit projektweiten Werten. Alles andere leitet sich ab.
// ===========================================================================

export default {
  domain: "renateleeb.photos",
  siteUrl: "https://renateleeb.photos", // kanonisch: OHNE www
  lang: "de",
  title: "Renate Leeb — Fotografie",
  shortTitle: "Renate Leeb",
  description:
    "Naturfotografie von Renate Leeb: Makroaufnahmen von Blüten, Blättern und Wasser — die Natur als Gestalterin.",

  author: {
    name: "Renate Leeb",
    role: "Fotografin",
  },

  // Verantwortlich im Sinne von ECG/MedienG (betreibt und pflegt die Seite)
  owner: {
    name: "Chris H. Leeb",
    street: "Willingerstraße 17",
    zip: "4030",
    city: "Linz",
    country: "Österreich",
    email: "kontakt@renateleeb.photos",
  },

  contactEmail: "kontakt@renateleeb.photos",

  social: {
    facebook: "https://www.facebook.com/renatephotos",
    x: "https://x.com/RenatePhotos",
  },

  // Kanonische Buchseiten liegen auf renateundchris.com (kein Duplicate Content)
  books: {
    url: "https://renateundchris.com",
    label: "Buchprojekte",
  },

  // Gemeinsames Foto-Tagebuch fürs Essen & Trinken (eigene Seite)
  food: {
    url: "https://cleebration.food/de/",
    label: "Essen & Trinken",
  },

  // Standardregel der Dachmarke
  credit: {
    text: "Ein Kunstprojekt von",
    label: "cleebration",
    url: "https://www.cleebration.com",
  },

  // Galerie-Feed (wird vom Hub gebaut und mit ausgeliefert)
  galleryFeed: "/feed/galleries/kuenstlernatur.json",
};
