// ===== The Little LUXE — site logic (you normally don't need to edit this file) =====
(function () {
  const S = window.STORE || {};
  const products = window.PRODUCTS || [];
  const $ = (s) => document.querySelector(s);
  const root = document.documentElement;

  // Escape text so product names like  Pearl "Drop" <Hoops>  can't break the page
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => (S.currency || "₹") + Number(n).toLocaleString("en-IN");

  // ----- How customers reach you -----
  const waNumber = String(S.whatsapp || "").replace(/\D/g, "");
  const hasWhatsApp = waNumber.length >= 10 && !/^(91)?9{10}$/.test(waNumber); // ignore the old 99999 placeholder
  const igHandle = String(S.instagram || "").replace(/^@/, "").trim();
  const waLink = (text) => `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;
  const igProfile = igHandle ? `https://instagram.com/${igHandle}` : "";
  const igDM = igHandle ? `https://ig.me/m/${igHandle}` : "";

  // Points a button at WhatsApp, or Instagram DMs if no WhatsApp number is set yet
  function setOrderLink(a, message, waLabel) {
    a.removeAttribute("aria-disabled");
    if (hasWhatsApp) { a.href = waLink(message); a.textContent = waLabel; return; }
    if (igDM) { a.href = igDM; a.textContent = waLabel.replace("WhatsApp", "Instagram"); return; }
    a.removeAttribute("href");
    a.setAttribute("aria-disabled", "true");
    a.textContent = "Ordering opens soon";
  }

  // ----- Product images: line-art placeholder when there's no photo, or the photo fails to load -----
  const ICONS = {
    Earrings: '<svg viewBox="0 0 100 100"><circle cx="35" cy="22" r="4" fill="currentColor"/><path d="M35 26v10" stroke="currentColor" stroke-width="2"/><circle cx="35" cy="56" r="20" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="68" cy="22" r="4" fill="currentColor"/><path d="M68 26v14" stroke="currentColor" stroke-width="2"/><path d="M68 40l-9 22h18z" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    Necklaces: '<svg viewBox="0 0 100 100"><path d="M15 15 Q50 80 85 15" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M50 58 l8 10 -8 12 -8 -12z" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    Rings: '<svg viewBox="0 0 100 100"><circle cx="50" cy="58" r="26" fill="none" stroke="currentColor" stroke-width="4"/><path d="M42 30 l8 -12 8 12 -8 6z" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>',
    Bracelets: '<svg viewBox="0 0 100 100"><ellipse cx="50" cy="50" rx="36" ry="22" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="50" cy="72" r="5" fill="currentColor"/></svg>',
    Anklets: '<svg viewBox="0 0 100 100"><path d="M14 40 Q50 75 86 40" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="4 5"/><circle cx="34" cy="58" r="4" fill="currentColor"/><circle cx="50" cy="62" r="4" fill="currentColor"/><circle cx="66" cy="58" r="4" fill="currentColor"/></svg>',
    default: '<svg viewBox="0 0 100 100"><path d="M50 18 l22 22 -22 42 -22 -42z" fill="none" stroke="currentColor" stroke-width="3"/><path d="M28 40h44" stroke="currentColor" stroke-width="2"/></svg>',
  };
  const PH_BG = { Earrings: "#f3e6df", Necklaces: "#efe4d6", Rings: "#f1e8e1", Bracelets: "#ece3d9", Anklets: "#f5ebe4" };

  function placeholder(category) {
    return `<span class="ph" style="background:${PH_BG[category] || "#f3e6df"}">${ICONS[category] || ICONS.default}</span>`;
  }
  function media(p) {
    if (p.image) return `<img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" data-cat="${esc(p.category)}" />`;
    return placeholder(p.category);
  }
  // A photo that can't load (wrong name, or .JPG vs .jpg on the live site) shows the placeholder instead of a broken icon
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (img.tagName !== "IMG" || img.dataset.cat === undefined) return;
    console.warn("[The Little LUXE] Photo not found — check the file name and capitals in products.js:", img.getAttribute("src"));
    img.outerHTML = placeholder(img.dataset.cat);
  }, true);

  function priceHtml(p) {
    return money(p.price) + (p.oldPrice ? ` <s>${money(p.oldPrice)}</s>` : "");
  }

  function card(p) {
    const badge = p.soldOut ? '<span class="badge sold">Sold out</span>'
      : p.isNew ? '<span class="badge">New</span>'
      : p.oldPrice ? '<span class="badge">Sale</span>' : "";
    return `<button type="button" class="card" data-id="${esc(p.id)}" aria-label="${esc(p.name)}, ${esc(money(p.price))}${p.soldOut ? ", sold out" : ""}">
      <span class="card-img">${media(p)}${badge}</span>
      <span class="card-cat">${esc(p.category)}</span>
      <span class="card-name">${esc(p.name)}</span>
      <span class="card-price">${priceHtml(p)}</span>
    </button>`;
  }

  // ----- New In -----
  const newOnes = products.filter((p) => p.isNew).slice(0, 4);
  $("#new-grid").innerHTML = newOnes.map(card).join("");
  if (!newOnes.length) {
    $("#new").hidden = true;
    document.querySelectorAll('a[href="#new"]').forEach((a) => (a.hidden = true));
  }

  // ----- Filters + Shop grid -----
  const cats = ["All", ...new Set(products.map((p) => p.category))];
  let current = "All";
  $("#filters").innerHTML = cats.map((c) =>
    `<button type="button" class="filter${c === "All" ? " active" : ""}" data-cat="${esc(c)}" aria-pressed="${c === "All"}">${esc(c)}</button>`).join("");

  function renderShop() {
    const list = current === "All" ? products : products.filter((p) => p.category === current);
    $("#shop-grid").innerHTML = list.map(card).join("");
    $("#empty").hidden = list.length > 0;
  }
  $("#filters").addEventListener("click", (e) => {
    const b = e.target.closest(".filter");
    if (!b) return;
    current = b.dataset.cat;
    document.querySelectorAll(".filter").forEach((f) => {
      f.classList.toggle("active", f === b);
      f.setAttribute("aria-pressed", f === b);
    });
    renderShop();
  });
  renderShop();

  // ----- Product pop-up -----
  const modal = $("#modal");
  const modalCard = modal.querySelector(".modal-card");
  let lastFocus = null;

  function lockScroll(on) {
    // both <html> and <body>, so the page behind doesn't scroll on iPhone
    root.style.overflow = on ? "hidden" : "";
    document.body.style.overflow = on ? "hidden" : "";
  }
  function openProduct(id) {
    const p = products.find((x) => String(x.id) === String(id));
    if (!p) return;
    lastFocus = document.activeElement;
    $("#m-img").innerHTML = media(p);
    $("#m-cat").textContent = p.category;
    $("#m-name").textContent = p.name;
    $("#m-price").innerHTML = priceHtml(p);
    $("#m-desc").textContent = p.description || "";
    $("#m-stock").textContent = p.soldOut ? "Currently sold out — message us to be notified when it's back." : "In stock · Ships in 2–4 days";
    setOrderLink($("#m-order"),
      `Hi ${S.name}! I'd like to ${p.soldOut ? "be notified about" : "order"}: ${p.name} (${money(p.price)})`,
      p.soldOut ? "Notify me on WhatsApp" : "Order on WhatsApp");
    modal.hidden = false;
    lockScroll(true);
    modal.querySelector(".modal-close").focus();
  }
  function closeModal() {
    if (modal.hidden) return;
    modal.hidden = true;
    lockScroll(false);
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }

  // ----- Mobile menu -----
  const btn = $(".menu-btn"), nav = $(".nav");
  function setMenu(open) {
    nav.classList.toggle("open", open);
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }
  btn.addEventListener("click", () => setMenu(!nav.classList.contains("open")));

  // ----- Clicks & keys -----
  document.addEventListener("click", (e) => {
    const c = e.target.closest(".card");
    if (c) openProduct(c.dataset.id);
    if (e.target.closest("[data-close]")) closeModal();
    if (e.target.closest(".nav a") || (!e.target.closest(".nav") && !e.target.closest(".menu-btn"))) setMenu(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!modal.hidden) closeModal();
      else if (nav.classList.contains("open")) { setMenu(false); btn.focus(); }
    }
    // keep keyboard focus inside the pop-up while it's open
    if (e.key === "Tab" && !modal.hidden) {
      const f = [...modalCard.querySelectorAll("a[href], button")].filter((el) => !el.hidden);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!modalCard.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    }
  });

  // ----- Contact section -----
  const wa = $("#wa-link"), ig = $("#ig-link");
  wa.hidden = !hasWhatsApp;
  if (hasWhatsApp) wa.href = waLink(`Hi ${S.name}! I have a question.`);
  ig.hidden = !igProfile;
  if (igProfile) ig.href = igProfile;
  const noContact = !hasWhatsApp && !igProfile;
  $(".contact-actions").hidden = noContact;
  if (noContact) $("#contact-text").textContent = "We're getting ready to take orders — check back very soon!";
  $("#year").textContent = new Date().getFullYear();
})();
