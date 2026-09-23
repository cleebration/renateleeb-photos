// Bildschirmfotos der gebauten Seiten — nur zur Kontrolle beim Bauen.
import { chromium } from "playwright";

const seiten = process.argv[2] ? [process.argv[2]] : ["/", "/kuenstlernatur/", "/ueber-mich/", "/kontakt/"];
const breiten = { desktop: 1280, phone: 390 };

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
for (const [name, width] of Object.entries(breiten)) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  for (const url of seiten) {
    await page.goto("http://localhost:8099" + url, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const datei = "/tmp/shot-" + name + (url === "/" ? "-start" : "-" + url.replace(/\//g, "")) + ".png";
    await page.screenshot({ path: datei, fullPage: true });
    console.log(datei);
  }
  await page.close();
}
await browser.close();
