// POST /api/contact (appelé par worker/index.js)
// Enregistre chaque demande (contact ou rendez-vous) en JSON dans le bucket R2 lié sous le nom FORMS.
// Envoie aussi un e-mail au cabinet via Cloudflare Email Routing (liaison MAILER, voir wrangler.toml).

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

  // Notification e-mail au cabinet (Cloudflare Email Routing, liaison MAILER)
  if (env.MAILER) {
    try {
      await sendNotification(env, type, clean, now, key);
    } catch (err) {
      // La demande est déjà enregistrée dans R2 : un échec d'envoi ne doit pas bloquer le patient.
      console.error("Envoi e-mail impossible :", err);
    }
  }

  return json({ ok: true, id });
}

const LABELS = {
  prenom: "Prénom", nom: "Nom", telephone: "Téléphone", email: "E-mail", praticien: "Praticien",
  motif: "Motif", objet: "Objet", disponibilites: "Disponibilités", message: "Message",
};

// Encodage base64 UTF-8, en lignes de 76 caractères (MIME)
function b64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/.{76}(?=.)/g, "$&\r\n");
}

async function sendNotification(env, type, clean, now, key) {
  const { EmailMessage } = await import("cloudflare:email");
  const from = env.MAIL_FROM || "site@odeondentaire.com";
  const to = env.MAIL_TO || "odeondentaire@gmail.com";
  const kind = type === "rendez-vous" ? "Demande de rendez-vous" : "Message de contact";
  const subject = `${kind} — ${clean.prenom} ${clean.nom}`;
  const when = now.toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "full", timeStyle: "short" });
  const body = [
    `${kind} ${type === "rendez-vous" ? "reçue" : "reçu"} depuis odeondentaire.com`,
    "",
    ...Object.entries(LABELS).filter(([k]) => clean[k]).map(([k, label]) => `${label} : ${clean[k]}`),
    "",
    `Reçu le ${when}`,
    "Pour répondre au patient, utilisez simplement « Répondre ».",
    "",
    `Archive : ${key}`,
  ].join("\n");

  const raw = [
    `From: =?UTF-8?B?${b64("Site Odéon Dentaire")}?= <${from}>`,
    `To: ${to}`,
    `Reply-To: ${clean.email}`,
    `Subject: =?UTF-8?B?${b64(subject).replace(/\r\n/g, "")}?=`,
    `Date: ${now.toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@odeondentaire.com>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(body),
  ].join("\r\n");

  await env.MAILER.send(new EmailMessage(from, to, raw));
}
