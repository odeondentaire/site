(() => {
  const header = document.querySelector("[data-header]");
  const burger = document.querySelector("[data-burger]");
  const nav = document.querySelector("[data-nav]");
  const sticky = document.querySelector(".rdv-sticky");

  // En-tête compact + bouton RDV flottant après défilement
  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle("is-scrolled", y > 40);
    if (sticky) sticky.classList.toggle("is-visible", y > window.innerHeight * 0.6);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Menu mobile
  burger?.addEventListener("click", () => {
    const open = burger.getAttribute("aria-expanded") !== "true";
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
    nav.classList.toggle("is-open", open);
    document.body.classList.toggle("nav-open", open);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("is-open")) burger.click();
  });

  // Apparition progressive
  const items = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    items.forEach((el) => io.observe(el));
  } else {
    items.forEach((el) => el.classList.add("is-in"));
  }

  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const en = document.documentElement.lang === "en";

  // Badge « Ouvert maintenant » : horaires de site.config.json, heure de Paris, jours fériés exclus
  const badges = document.querySelectorAll("[data-open-status]");
  if (badges.length) {
    let hours = {};
    try { hours = JSON.parse(document.body.dataset.hours || "{}"); } catch {}
    const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const holidays = (y) => {
      // Pâques (algorithme de Meeus) → lundi de Pâques, Ascension, lundi de Pentecôte
      const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
      const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
      const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
      const easter = Date.UTC(y, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
      const iso = (t) => new Date(t).toISOString().slice(5, 10);
      return new Set(["01-01", "05-01", "05-08", "07-14", "08-15", "11-01", "11-11", "12-25", ...[1, 39, 50].map((n) => iso(easter + n * 864e5))]);
    };
    let paris;
    const parisNow = () => {
      paris ||= new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "long", hourCycle: "h23" });
      const p = Object.fromEntries(paris.formatToParts(new Date()).map((x) => [x.type, x.value]));
      return { y: +p.year, md: `${p.month}-${p.day}`, day: p.weekday, min: +p.hour * 60 + +p.minute };
    };
    const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    const fmt = (t) => { const [h, m] = t.split(":").map(Number); return en ? `${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""} ${h < 12 ? "am" : "pm"}` : `${h} h${m ? String(m).padStart(2, "0") : ""}`; };
    const update = () => {
      if (!hours.days || !hours.opens) return;
      const now = parisNow();
      const isOpenDay = (dayName, y, md) => hours.days.includes(dayName) && !holidays(y).has(md);
      const opens = toMin(hours.opens), closes = toMin(hours.closes);
      let text, open = false;
      if (isOpenDay(now.day, now.y, now.md) && now.min >= opens && now.min < closes) {
        open = true;
        text = en ? `Open now · closes at ${fmt(hours.closes)}` : `Ouvert maintenant · ferme à ${fmt(hours.closes)}`;
      } else {
        // Prochaine ouverture (aujourd'hui plus tard, demain, ou jour ouvré suivant)
        const today = new Date(Date.UTC(now.y, +now.md.slice(0, 2) - 1, +now.md.slice(3)));
        for (let n = 0; n < 15; n++) {
          const d = new Date(today.getTime() + n * 864e5);
          const name = DAYS[d.getUTCDay()], md = d.toISOString().slice(5, 10);
          if (!isOpenDay(name, d.getUTCFullYear(), md) || (n === 0 && now.min >= opens)) continue;
          const when = n === 0 ? (en ? "today" : "aujourd'hui") : n === 1 ? (en ? "tomorrow" : "demain") : new Intl.DateTimeFormat(en ? "en-GB" : "fr-FR", { weekday: "long", timeZone: "UTC" }).format(d);
          text = en ? `Closed · opens ${when} at ${fmt(hours.opens)}` : `Fermé · ouvre ${when} à ${fmt(hours.opens)}`;
          break;
        }
      }
      if (!text) return;
      badges.forEach((b) => { b.textContent = text; b.classList.toggle("is-open", open); b.hidden = false; });
    };
    // Hors du chemin critique : le formatage horaire (Intl) est coûteux au premier appel
    const later = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
    later(() => { update(); setInterval(update, 60000); });
  }

  // Chiffres clés de l'accueil : défilement jusqu'à leur valeur à l'apparition
  const counters = document.querySelectorAll(".hero-figures dt");
  if (counters.length && !calm && "IntersectionObserver" in window) {
    const run = (dt) => {
      const node = dt.firstChild;
      const target = parseInt(node?.nodeValue, 10);
      if (!node || node.nodeType !== 3 || isNaN(target)) return;
      const from = target > 1000 ? target - 25 : 0;
      const t0 = performance.now(), dur = 1400;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur), ease = 1 - Math.pow(1 - k, 4);
        node.nodeValue = String(Math.round(from + (target - from) * ease));
        if (k < 1) requestAnimationFrame(step);
      };
      node.nodeValue = String(from);
      requestAnimationFrame(step);
    };
    const co = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { run(en.target); co.unobserve(en.target); } }), { threshold: 0.6 });
    counters.forEach((dt) => co.observe(dt));
  }

  // Cartes Expertises : léger relief qui suit la souris (ordinateur uniquement)
  if (!calm && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    document.querySelectorAll(".pillar").forEach((card) => {
      const img = card.querySelector(".pillar-img");
      if (!img) return;
      card.addEventListener("pointermove", (e) => {
        const r = img.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        img.style.setProperty("--rx", `${(-y * 6).toFixed(2)}deg`);
        img.style.setProperty("--ry", `${(x * 8).toFixed(2)}deg`);
        img.style.setProperty("--gx", `${((x + 0.5) * 100).toFixed(1)}%`);
        img.style.setProperty("--gy", `${((y + 0.5) * 100).toFixed(1)}%`);
      });
      card.addEventListener("pointerleave", () => { img.style.removeProperty("--rx"); img.style.removeProperty("--ry"); });
    });
  }

  // Formulaires (contact / demande de rendez-vous) → /api/contact (Cloudflare Pages Function + R2)
  document.querySelectorAll("form[data-form]").forEach((form) => {
    const status = form.querySelector(".form-status");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector("button[type=submit]");
      // Champs obligatoires manquants : on le dit clairement et on montre le champ
      if (!form.checkValidity()) {
        status.className = "form-status err";
        const consent = form.querySelector("input[name=consentement]");
        status.textContent = consent && !consent.checked
          ? "Merci de cocher la case d'accord pour l'utilisation de vos données."
          : "Merci de remplir les champs obligatoires (nom, prénom, e-mail valide" + (form.dataset.form === "rendez-vous" ? ", téléphone" : ", message") + ").";
        form.reportValidity();
        return;
      }
      status.className = "form-status";
      status.textContent = "Envoi en cours…";
      btn.disabled = true;
      try {
        const data = Object.fromEntries(new FormData(form).entries());
        data.type = form.dataset.form;
        data.page = location.pathname;
        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.ok) throw new Error(json.error || "Erreur");
        form.reset();
        status.classList.add("ok");
        status.textContent = "Merci, votre message a bien été transmis. Le secrétariat vous recontactera rapidement.";
      } catch (err) {
        status.classList.add("err");
        status.textContent = "L'envoi n'a pas abouti. Merci de réessayer dans un instant ou de nous contacter par téléphone.";
      } finally {
        btn.disabled = false;
      }
    });
  });
})();
