// Générateur statique minimal, sans dépendance.
// src/pages/**/*.html  →  dist/**/index.html (URLs propres), habillées par src/layout.html.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, cpSync, rmSync } from "node:fs";
import { join, dirname, relative } from "node:path";

const ROOT = dirname(new URL(import.meta.url).pathname);
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");
const config = JSON.parse(readFileSync(join(ROOT, "site.config.json"), "utf8"));
const layouts = {
  fr: readFileSync(join(SRC, "layout.html"), "utf8"),
  en: readFileSync(join(SRC, "layout-en.html"), "utf8"),
};

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
      image: `${config.siteUrl}/assets/img/ai/hero.jpg`,
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
        { "@type": "Person", "@id": `${config.siteUrl}/equipe/#lenny-dahan`, name: "Dr Lenny Dahan", jobTitle: "Chirurgien-dentiste", honorificPrefix: "Dr", alumniOf: ["Université Paris Cité", "Université Paris Descartes", "HEC Paris"], url: `${config.siteUrl}/equipe/#lenny-dahan` },
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
    .map((u) => `  <url><loc>${config.siteUrl}${u}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>`)
    .join("\n")}\n</urlset>\n`
);
console.log(`${urls.length} pages générées dans dist/`);
