// Signale toutes les pages du sitemap en ligne aux moteurs IndexNow (Bing, Yandex…).
// Usage : npm run indexnow   (après un déploiement)
import { readdirSync, readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../site.config.json", import.meta.url)));
const keyFile = readdirSync(new URL("../src/", import.meta.url)).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) throw new Error("Clé IndexNow introuvable dans src/");
const key = keyFile.slice(0, -4);
const host = new URL(config.siteUrl).host;

const sitemap = await (await fetch(`${config.siteUrl}/sitemap.xml`)).text();
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host, key, keyLocation: `${config.siteUrl}/${keyFile}`, urlList }),
});
console.log(`IndexNow : ${urlList.length} pages envoyées → HTTP ${res.status}`);
