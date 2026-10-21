# Odéon Dentaire — site internet

Site du cabinet Odéon Dentaire (Dr Richard Dahan & Dr Lenny Dahan, Paris 6ᵉ).
Site statique sans dépendance, hébergé sur **Cloudflare Pages**, formulaires stockés dans **Cloudflare R2**.

## Structure

```
site.config.json        Paramètres : lien de prise de RDV, téléphone, e-mail, adresse, horaires
build.mjs               Générateur (src/pages → dist/), sans dépendance
src/layout.html         En-tête, navigation, bandeau RDV, pied de page
src/pages/              Une page = un fichier .html (bloc JSON en tête : titre, description…)
src/assets/             CSS, JS, polices auto-hébergées, images, presse
functions/api/contact.js  Fonction Cloudflare : enregistre les formulaires dans R2
wrangler.toml           Configuration Cloudflare Pages + liaison R2 (FORMS)
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

Renseignez aussi `phone` (format `+33…`), `phoneDisplay` (format affiché) et `email` : ils s'affichent automatiquement lorsqu'ils sont remplis.

## Déploiement sur Cloudflare Pages

1. Cloudflare → **Workers & Pages** → *Create* → *Pages* → *Connect to Git* → dépôt `odeondentaire/site`.
2. Réglages de build : commande `npm run build`, répertoire de sortie `dist`.
3. **R2** : créez (ou choisissez) un bucket, puis *Settings → Bindings → R2 bucket* : nom de variable **`FORMS`**.
   Mettez aussi le nom du bucket dans `wrangler.toml` (`bucket_name`).
4. (Facultatif) notification e-mail des demandes via [Resend](https://resend.com) : variables `RESEND_API_KEY`, `NOTIFY_EMAIL` (et `NOTIFY_FROM`).
   Sans cela, les demandes sont consultables dans R2 : `forms/contact/AAAA-MM-JJ/…json` et `forms/rendez-vous/…`.

## Nom de domaine (GoDaddy → Cloudflare)

Méthode recommandée : déléguer le domaine à Cloudflare.

1. Cloudflare → *Add a site* → `odeondentaire.com` (offre gratuite). Cloudflare fournit 2 serveurs de noms.
2. GoDaddy → *Mes domaines* → `odeondentaire.com` → *DNS* → *Serveurs de noms* → *Modifier* → *Je vais utiliser mes propres serveurs de noms* → saisir les 2 serveurs Cloudflare.
3. Une fois le domaine actif sur Cloudflare : projet Pages → *Custom domains* → ajouter `odeondentaire.com` et `www.odeondentaire.com`.

⚠️ Si des e-mails utilisent déjà ce domaine (MX GoDaddy / Microsoft 365), recopiez les enregistrements MX/TXT dans Cloudflare avant de changer les serveurs de noms.

## À compléter avant la mise en ligne

- Téléphone, e-mail, horaires et confirmation de l'adresse (`site.config.json`)
- Lien de prise de rendez-vous (`rdvUrl`)
- Mentions légales : raison sociale, SIRET, n° RPPS, situation conventionnelle, assurance RCP (`src/pages/mentions-legales.html`, passages surlignés)
- Plateau technique : vérifier que la liste d'équipements (`src/pages/cabinet.html`) correspond au cabinet
- Photographies réelles : remplacer les visuels provisoires générés par IA (`src/assets/img/ai/`) en conservant les mêmes noms de fichiers ; portrait du Dr Lenny Dahan (remplacer le monogramme « LD » dans `index.html` et `equipe.html`)
- Vidéo d'ambiance de l'accueil : emplacement prévu en commentaire dans `src/pages/index.html`
