// Générateur statique minimal, sans dépendance.
// src/pages/**/*.html  →  dist/**/index.html (URLs propres), habillées par src/layout.html.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, cpSync, rmSync } from "node:fs";
import { join, dirname, relative } from "node:path";

const ROOT = dirname(new URL(import.meta.url).pathname);
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");
const config = JSON.parse(readFileSync(join(ROOT, "site.config.json"), "utf8"));
const layout = readFileSync(join(SRC, "layout.html"), "utf8");

const rdvExternal = Boolean(config.rdvUrl);
const a = config.address;
const vars = {
  name: config.name,
  siteUrl: config.siteUrl,
  rdvHref: rdvExternal ? config.rdvUrl : "/rendez-vous",
  rdvAttrs: rdvExternal ? 'target="_blank" rel="noopener"' : "",
  phone: config.phone,
  phoneDisplay: config.phoneDisplay || config.phone,
  email: config.email,
  street: a.street,
  postalCode: a.postalCode,
  city: a.city,
  addressNote: a.note,
  addressLine: `${a.street}, ${a.postalCode} ${a.city}`,
  mapQuery: encodeURIComponent(`${a.street}, ${a.postalCode} ${a.city}`),
  metro: config.metro,
  hours: config.hours.map(([d, h]) => `<li><span>${d}</span><span>${h}</span></li>`).join(""),
  year: String(new Date().getFullYear()),
};
const flags = { phone: !!config.phone, email: !!config.email, addressNote: !!a.note, rdvExternal, rdvInternal: !rdvExternal };

function render(tpl, extra = {}) {
  const v = { ...vars, ...extra };
  // <!--if:flag--> … <!--else--> … <!--endif:flag-->
  tpl = tpl.replace(/<!--if:(\w+)-->([\s\S]*?)<!--endif:\1-->/g, (_, f, body) => {
    const [yes, no = ""] = body.split("<!--else-->");
    return flags[f] ? yes : no;
  });
  return tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in v ? v[k] : m));
}

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".html") ? [p] : [];
  });
}

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
cpSync(join(SRC, "assets"), join(DIST, "assets"), { recursive: true });
for (const f of ["_headers", "_redirects", "robots.txt"]) {
  try { cpSync(join(SRC, f), join(DIST, f)); } catch {}
}

const urls = [];
for (const file of walk(join(SRC, "pages"))) {
  const raw = readFileSync(file, "utf8");
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  const meta = m ? JSON.parse(m[1]) : {};
  const body = m ? raw.slice(m[0].length) : raw;

  let rel = relative(join(SRC, "pages"), file).replace(/\\/g, "/").replace(/\.html$/, "");
  if (rel.endsWith("index")) rel = rel.slice(0, -5);
  else rel += "/";
  const path = "/" + rel;
  const out = join(DIST, rel, "index.html");

  const nav = meta.nav || "";
  const html = render(layout, {
    title: meta.title ? `${meta.title} — ${config.name}` : `${config.name} — Cabinet dentaire, Paris 6ᵉ`,
    description: meta.description || "",
    canonical: config.siteUrl + path,
    bodyClass: meta.bodyClass || "",
    ogImage: config.siteUrl + (meta.image || "/assets/img/ai/hero.jpg"),
    content: render(body),
    ...Object.fromEntries(["expertises", "cabinet", "equipe", "actualites", "contact"].map((k) => [`nav_${k}`, nav === k ? 'aria-current="page"' : ""])),
  });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  if (!meta.noindex) urls.push(path);
}

// 404 à la racine pour Cloudflare Pages
cpSync(join(DIST, "404", "index.html"), join(DIST, "404.html"));

writeFileSync(
  join(DIST, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .filter((u) => u !== "/404/")
    .map((u) => `  <url><loc>${config.siteUrl}${u}</loc></url>`)
    .join("\n")}\n</urlset>\n`
);
console.log(`${urls.length} pages générées dans dist/`);
