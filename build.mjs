// Générateur statique minimal, sans dépendance.
// src/pages/**/*.html  →  dist/**/index.html (URLs propres), habillées par src/layout.html.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, cpSync, rmSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { createHash } from "node:crypto";

const ROOT = dirname(new URL(import.meta.url).pathname);
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");
const config = JSON.parse(readFileSync(join(ROOT, "site.config.json"), "utf8"));
const layouts = {
  fr: readFileSync(join(SRC, "layout.html"), "utf8"),
  en: readFileSync(join(SRC, "layout-en.html"), "utf8"),
};

// Versionnage des CSS/JS : une nouvelle URL à chaque modification (pas de vieux fichier en cache)
const ver = (f) => createHash("sha1").update(readFileSync(join(SRC, f))).digest("hex").slice(0, 10);
const assetVersions = { css: ver("assets/css/style.css"), js: ver("assets/js/main.js") };
// La feuille de style est intégrée dans chaque page (aucune requête bloquante au chargement)
const inlineCss = readFileSync(join(SRC, "assets/css/style.css"), "utf8")
  .replace(/url\("\.\.\/fonts\//g, 'url("/assets/fonts/')
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\s*\n\s*/g, "\n");
for (const k of Object.keys(layouts)) {
  layouts[k] = layouts[k]
    .replace(/<link rel="stylesheet" href="\/assets\/css\/style\.css"[^>]*>/, () => `<style>${inlineCss}</style>`)
    .replace('/assets/js/main.js"', `/assets/js/main.js?v=${assetVersions.js}"`);
}

// Images : variantes WebP générées à côté des JPEG (nom-480.webp, nom-800.webp…)
function webpSet(src) {
  const base = src.replace(/\.jpe?g$/, "");
  const dir = join(SRC, dirname(base).replace(/^\//, ""));
  const name = base.split("/").pop();
  let files = [];
  try { files = readdirSync(dir); } catch { return null; }
  const widths = files
    .map((f) => f.match(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)\\.webp$`)))
    .filter(Boolean).map((m) => +m[1]).sort((a, b) => a - b);
  if (!widths.length) return null;
  const fallback = widths.filter((w) => w <= 800).pop() || widths[0];
  return { src: `${base}-${fallback}.webp`, srcset: widths.map((w) => `${base}-${w}.webp ${w}w`).join(", ") };
}
function responsiveImages(html) {
  return html.replace(/<img\b([^>]*?)\ssrc="(\/assets\/(?:img|press)\/[^"]+\.jpe?g)"([^>]*)>/g, (m, before, src, after, offset) => {
    const set = webpSet(src);
    if (!set) return m;
    const ctx = html.slice(Math.max(0, offset - 160), offset);
    const attrs = before + after;
    let sizes = "(max-width: 860px) 100vw, 50vw";
    if (/fetchpriority="high"/.test(attrs) || /hero-media|page-hero-img/.test(ctx)) sizes = "100vw";
    else if (/pillar-img|news-img/.test(ctx)) sizes = "(max-width: 560px) 100vw, (max-width: 1000px) 50vw, 25vw";
    else if (/press-page/.test(attrs)) sizes = "(max-width: 860px) 55vw, 25vw";
    else if (/team-img|press-cover/.test(ctx)) sizes = "(max-width: 760px) 100vw, 40vw";
    return `<img${before} src="${set.src}" srcset="${set.srcset}" sizes="${sizes}"${after}>`;
  });
}

const rdvExternal = Boolean(config.rdvUrl);
const a = config.address;
const phones = config.phones || [];
const vars = {
  name: config.name,
  siteUrl: config.siteUrl,
  rdvHref: rdvExternal ? config.rdvUrl : "/rendez-vous",
  rdvAttrs: rdvExternal ? 'target="_blank" rel="noopener"' : "",
  phone: phones[0]?.tel || "",
  phoneDisplay: phones[0]?.display || "",
  phoneLinks: phones.map((p) => `<a href="tel:${p.tel}">${p.display}</a>`).join("<br>"),
  phoneLinksIntl: phones.map((p) => `<a href="tel:${p.tel}">${p.tel.replace(/^\+33(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/, "+33 $1 $2 $3 $4 $5")}</a>`).join("<br>"),
  email: config.email,
  street: a.street,
  postalCode: a.postalCode,
  city: a.city,
  addressLine: `${a.street}, ${a.postalCode} ${a.city}`,
  mapQuery: encodeURIComponent(`${a.street}, ${a.postalCode} ${a.city}`),
  metro: config.metro,
  hours: config.hours.map(([d, h]) => `<li><span>${d}</span><span>${h}</span></li>`).join(""),
  year: String(new Date().getFullYear()),
  // Horaires lus par le badge « Ouvert maintenant » (main.js)
  hoursData: JSON.stringify(config.openingHours || {}).replace(/"/g, "&quot;"),
};
const flags = { phone: phones.length > 0, email: !!config.email, rdvExternal, rdvInternal: !rdvExternal };

// Données structurées (schema.org) : fiche du cabinet, lue par Google et les moteurs d'IA.
const oh = config.openingHours;
const jsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${config.siteUrl}/#website`,
      url: `${config.siteUrl}/`,
      name: config.name,
      alternateName: ["Odeon Dentaire", "Cabinet dentaire Odéon", "Odéon Dental Clinic Paris"],
      inLanguage: ["fr-FR", "en"],
    },
    {
      "@type": ["Dentist", "MedicalClinic"],
      "@id": `${config.siteUrl}/#cabinet`,
      name: config.name,
      alternateName: ["Odeon Dentaire", "Cabinet dentaire Odéon — Dr Richard Dahan"],
      description: "Cabinet de chirurgie dentaire à Odéon, Paris 6ᵉ : parodontologie, implantologie et chirurgie, dentisterie esthétique, prothèse et réhabilitation, accompagnement bucco-dentaire en cancérologie.",
      url: `${config.siteUrl}/`,
      image: [`${config.siteUrl}/assets/img/facade-cabinet.jpg`, `${config.siteUrl}/assets/img/passage-du-commerce.jpg`, `${config.siteUrl}/assets/img/salle-de-soins-1.jpg`, `${config.siteUrl}/assets/img/salle-de-soins-2.jpg`, `${config.siteUrl}/assets/img/salle-de-soins-3.jpg`],
      logo: `${config.siteUrl}/assets/img/favicon.svg`,
      telephone: phones.map((p) => p.tel),
      email: config.email || undefined,
      address: { "@type": "PostalAddress", streetAddress: a.street, postalCode: a.postalCode, addressLocality: a.city, addressRegion: "Île-de-France", addressCountry: "FR" },
      geo: a.lat ? { "@type": "GeoCoordinates", latitude: a.lat, longitude: a.lng } : undefined,
      hasMap: `https://www.openstreetmap.org/?mlat=${a.lat}&mlon=${a.lng}#map=18/${a.lat}/${a.lng}`,
      openingHoursSpecification: oh ? [{ "@type": "OpeningHoursSpecification", dayOfWeek: oh.days, opens: oh.opens, closes: oh.closes }] : undefined,
      areaServed: ["Paris 6e", "Saint-Germain-des-Prés", "Odéon", "Quartier latin", "Paris"],
      availableLanguage: ["French", "English"],
      paymentAccepted: "Carte Vitale (tiers payant selon actes), carte bancaire",
      isAcceptingNewPatients: true,
      medicalSpecialty: ["Dentistry", "Periodontics", "Prosthodontics", "Oral and Maxillofacial Surgery"],
      availableService: ["Parodontologie", "Implants dentaires", "Chirurgie guidée", "Greffe osseuse", "Facettes céramiques", "Éclaircissement dentaire", "Couronnes et bridges", "Soins dentaires et urgences", "Santé orale et cancer"].map((n) => ({ "@type": "MedicalProcedure", name: n })),
      employee: [
        { "@type": "Person", "@id": `${config.siteUrl}/equipe/#richard-dahan`, name: "Dr Richard Dahan", jobTitle: "Chirurgien-dentiste", honorificPrefix: "Dr", alumniOf: ["Université Paris Diderot", "New York University"], memberOf: "Société française de dentisterie en cancérologie (SFDC)", image: `${config.siteUrl}/assets/img/dr-richard-dahan.jpg`, url: `${config.siteUrl}/equipe/#richard-dahan` },
        { "@type": "Person", "@id": `${config.siteUrl}/equipe/#lenny-dahan`, name: "Dr Lenny Dahan", jobTitle: "Chirurgien-dentiste", honorificPrefix: "Dr", alumniOf: ["Université Paris Cité", "Université Paris Descartes", "HEC Paris"], image: `${config.siteUrl}/assets/img/dr-lenny-dahan-portrait.jpg`, url: `${config.siteUrl}/equipe/#lenny-dahan` },
      ],
      sameAs: [config.rdvUrl].filter(Boolean),
    },
  ],
});
vars.jsonLd = jsonLd.replace(/</g, "\\u003c");

function render(tpl, extra = {}) {
  const v = { ...vars, ...extra };
  // <!--if:flag--> … <!--else--> … <!--endif:flag-->
  tpl = tpl.replace(/<!--if:(\w+)-->([\s\S]*?)<!--endif:\1-->/g, (_, f, body) => {
    const [yes, no = ""] = body.split("<!--else-->");
    return flags[f] ? yes : no;
  });
  return tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in v ? v[k] : m));
}

// Données structurées propres à chaque page : fil d'Ariane et questions fréquentes
const strip = (h) => h.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
function pageJsonLd(body, path, meta) {
  const graph = [];
  const bc = body.match(/<p class="breadcrumb">([\s\S]*?)<\/p>/);
  if (bc) {
    const items = [...bc[1].matchAll(/<a href="([^"]+)">([\s\S]*?)<\/a>/g)].map(([, href, label]) => ({ url: config.siteUrl + href.replace(/([^/])$/, "$1/"), name: strip(label) }));
    items.push({ url: config.siteUrl + path, name: strip(bc[1].split("</span>").pop()) });
    graph.push({ "@type": "BreadcrumbList", itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: it.url })) });
  }
  const faq = [...body.matchAll(/<details><summary>([\s\S]*?)<\/summary><div>([\s\S]*?)<\/div><\/details>/g)];
  if (faq.length) {
    graph.push({ "@type": "FAQPage", inLanguage: meta.lang === "en" ? "en" : "fr-FR", mainEntity: faq.map(([, q, r]) => ({ "@type": "Question", name: strip(render(q)), acceptedAnswer: { "@type": "Answer", text: strip(render(r)) } })) });
  }
  if (!graph.length) return "";
  return `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c")}</script>`;
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
for (const f of ["_headers", "_redirects", "robots.txt", "llms.txt"]) {
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
  const lang = meta.lang || "fr";
  const alt = meta.alternate; // URL de la version dans l'autre langue
  const hreflang = alt
    ? `<link rel="alternate" hreflang="${lang}" href="${config.siteUrl + path}">\n  <link rel="alternate" hreflang="${lang === "fr" ? "en" : "fr"}" href="${config.siteUrl + alt}">\n  <link rel="alternate" hreflang="x-default" href="${config.siteUrl + (lang === "fr" ? path : alt)}">`
    : "";
  const html = render(layouts[lang], {
    title: meta.fullTitle || (meta.title ? `${meta.title} | ${config.name}, Paris 6ᵉ` : config.name),
    hreflang,
    altHref: alt || (lang === "fr" ? "/en/" : "/"),
    description: meta.description || "",
    canonical: config.siteUrl + path,
    bodyClass: meta.bodyClass || "",
    ogImage: config.siteUrl + (meta.image || "/assets/img/facade-cabinet.jpg"),
    content: render(body),
    pageLd: pageJsonLd(body, path, meta),
    ...Object.fromEntries(["expertises", "cabinet", "equipe", "actualites", "contact"].map((k) => [`nav_${k}`, nav === k ? 'aria-current="page"' : ""])),
  });
  // Liens internes vers l'URL finale (avec « / ») : pas de redirection pour Google
  const linked = responsiveImages(html).replace(/href="(\/(?!assets\/|api\/)[^"#?.]*[^"#?./])(#[^"]*)?"/g, (m, p1, hash = "") => `href="${p1}/${hash}"`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, linked);
  if (!meta.noindex) urls.push(path);
}

// 404 à la racine pour Cloudflare Pages
cpSync(join(DIST, "404", "index.html"), join(DIST, "404.html"));

writeFileSync(
  join(DIST, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .filter((u) => u !== "/404/")
    .map((u) => `  <url><loc>${config.siteUrl}${u}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>`)
    .join("\n")}\n</urlset>\n`
);
console.log(`${urls.length} pages générées dans dist/`);
