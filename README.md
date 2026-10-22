# Odéon Dentaire — site internet

Site du cabinet Odéon Dentaire (Dr Richard Dahan & Dr Lenny Dahan, Paris 6ᵉ).
Site statique sans dépendance, hébergé sur **Cloudflare Workers**, formulaires stockés dans **Cloudflare R2**.

## Structure

```
site.config.json        Paramètres : lien de prise de RDV, téléphone, e-mail, adresse, horaires
build.mjs               Générateur (src/pages → dist/), sans dépendance
src/layout.html         En-tête, navigation, bandeau RDV, pied de page
src/pages/              Une page = un fichier .html (bloc JSON en tête : titre, description…)
src/assets/             CSS, JS, polices auto-hébergées, images, presse
worker/                 Worker Cloudflare : sert le site et enregistre les formulaires dans R2
wrangler.toml           Configuration du Worker « site » + liaison R2 (FORMS)
```

## Commandes

```bash
npm run build     # génère dist/
npm run serve     # aperçu local sur http://localhost:8080 (sans les formulaires)
npm run preview   # aperçu avec Wrangler (formulaires + R2 en local)
```

## Brancher le lien de prise de rendez-vous

Dans `site.config.json`, renseignez `rdvUrl` (Doctolib, Maiia…) puis reconstruisez :

```json
"rdvUrl": "https://www.doctolib.fr/..."
```

Tous les boutons « Prendre rendez-vous » (en-tête, accueil, bandeau, bouton flottant mobile, pages) pointeront alors vers ce lien, dans un nouvel onglet.
Tant que `rdvUrl` est vide, ils mènent à la page `/rendez-vous` (formulaire de demande enregistré dans R2).

Téléphones (`phones`), e-mail, adresse et horaires se règlent aussi dans `site.config.json`.

## Déploiement sur Cloudflare (Worker « site »)

Le site est déployé comme un **Worker avec fichiers statiques** : `dist/` est servi directement, `worker/index.js` ne traite que `/api/contact`.

Réglages du Worker (*Workers & Pages → site → Settings → Build*) :

| Réglage | Valeur |
|---|---|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/` (racine du dépôt — **pas** `/dist`) |

Le bucket R2 `databasesite` est lié automatiquement (variable `FORMS`, déclarée dans `wrangler.toml`).

(Facultatif) notification e-mail des demandes via [Resend](https://resend.com) : variables `RESEND_API_KEY`, `NOTIFY_EMAIL` (et `NOTIFY_FROM`).
Sans cela, les demandes sont consultables dans R2 : `forms/contact/AAAA-MM-JJ/…json` et `forms/rendez-vous/…`.

## Nom de domaine (GoDaddy → Cloudflare)

Méthode recommandée : déléguer le domaine à Cloudflare.

1. Cloudflare → *Add a site* → `odeondentaire.com` (offre gratuite). Cloudflare fournit 2 serveurs de noms.
2. GoDaddy → *Mes domaines* → `odeondentaire.com` → *DNS* → *Serveurs de noms* → *Modifier* → *Je vais utiliser mes propres serveurs de noms* → saisir les 2 serveurs Cloudflare.
3. Une fois le domaine actif sur Cloudflare : Worker « site » → *Settings → Domains & Routes* → ajouter `odeondentaire.com` et `www.odeondentaire.com`.

⚠️ Si des e-mails utilisent déjà ce domaine (MX GoDaddy / Microsoft 365), recopiez les enregistrements MX/TXT dans Cloudflare avant de changer les serveurs de noms.

## Référencement (SEO et assistants IA)

- Données structurées schema.org (`Dentist`) générées par `build.mjs` à partir de `site.config.json`
- Version anglaise : `src/pages/en/index.html` (gabarit `src/layout-en.html`), liée par `hreflang`
- `robots.txt` ouvert aux moteurs et aux robots IA, `llms.txt` (résumé du cabinet pour les assistants IA), `sitemap.xml` daté

## Reste à compléter

- Lien de prise de rendez-vous (`rdvUrl`)
- N° RPPS du Dr Lenny Dahan (mentions légales)
- Plateau technique : confirmer la liste d'équipements (`src/pages/cabinet.html`)
- (Facultatif) photos réelles pour remplacer les natures mortes IA des pages d'expertise (`src/assets/img/ai/`, mêmes noms de fichiers)
- Photos d'illustration des expertises : Unsplash (`src/assets/img/illustrations/`)
- Vidéo d'ambiance de l'accueil : emplacement prévu en commentaire dans `src/pages/index.html`
