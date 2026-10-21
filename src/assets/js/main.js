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

  // Formulaires (contact / demande de rendez-vous) → /api/contact (Cloudflare Pages Function + R2)
  document.querySelectorAll("form[data-form]").forEach((form) => {
    const status = form.querySelector(".form-status");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector("button[type=submit]");
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
