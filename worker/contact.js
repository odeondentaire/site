// POST /api/contact (appelé par worker/index.js)
// Enregistre chaque demande (contact ou rendez-vous) en JSON dans le bucket R2 lié sous le nom FORMS.
// Notification e-mail optionnelle via Resend si RESEND_API_KEY et NOTIFY_EMAIL sont définis.

const MAX = { prenom: 80, nom: 80, email: 160, telephone: 40, objet: 120, praticien: 80, motif: 120, disponibilites: 300, message: 4000 };
const TYPES = new Set(["contact", "rendez-vous"]);

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

export async function onRequestPost({ request, env }) {
  let data;
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, error: "Requête invalide" }, 400);
  }

  // Pot de miel anti-robots : on répond OK sans rien enregistrer
  if (data.website) return json({ ok: true });

  const type = TYPES.has(data.type) ? data.type : "contact";
  const clean = {};
  for (const [k, max] of Object.entries(MAX)) {
    if (data[k] != null) clean[k] = String(data[k]).trim().slice(0, max);
  }

  if (!clean.prenom || !clean.nom || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email || "")) {
    return json({ ok: false, error: "Champs obligatoires manquants" }, 422);
  }
  if (type === "contact" && !clean.message) return json({ ok: false, error: "Message manquant" }, 422);
  if (type === "rendez-vous" && !clean.telephone) return json({ ok: false, error: "Téléphone manquant" }, 422);
  if (data.consentement !== "oui") return json({ ok: false, error: "Consentement requis" }, 422);

  const now = new Date();
  const id = crypto.randomUUID();
  const record = {
    id,
    type,
    receivedAt: now.toISOString(),
    page: String(data.page || "").slice(0, 200),
    ...clean,
    consentement: true,
  };

  if (!env.FORMS) return json({ ok: false, error: "Stockage non configuré" }, 500);
  const key = `forms/${type}/${now.toISOString().slice(0, 10)}/${now.getTime()}-${id}.json`;
  await env.FORMS.put(key, JSON.stringify(record, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });

  if (env.RESEND_API_KEY && env.NOTIFY_EMAIL) {
    const lines = Object.entries(clean).map(([k, v]) => `${k} : ${v}`).join("\n");
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: env.NOTIFY_FROM || "Site Odéon Dentaire <site@odeondentaire.com>",
          to: env.NOTIFY_EMAIL.split(",").map((s) => s.trim()),
          reply_to: clean.email,
          subject: `[Site] Nouvelle demande ${type === "rendez-vous" ? "de rendez-vous" : "de contact"} — ${clean.prenom} ${clean.nom}`,
          text: `${lines}\n\nRéférence : ${key}`,
        }),
      });
    } catch {
      // La demande est déjà enregistrée dans R2 : un échec d'envoi ne doit pas bloquer le patient.
    }
  }

  return json({ ok: true, id });
}
