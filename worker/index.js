// Point d'entrée du Worker Cloudflare « site ».
// Les fichiers statiques (dist/) sont servis directement par Cloudflare ;
// seules les requêtes qui ne correspondent à aucun fichier arrivent ici.
import { onRequestPost } from "./contact.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/contact") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ ok: false, error: "Méthode non autorisée" }), {
          status: 405,
          headers: { "Content-Type": "application/json; charset=utf-8", Allow: "POST" },
        });
      }
      return onRequestPost({ request, env });
    }
    return env.ASSETS.fetch(request);
  },
};
