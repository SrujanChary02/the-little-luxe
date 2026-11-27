// ===== The Little LUXE — site logic (you normally don't need to edit this file) =====
(function () {
  const S = window.STORE;
  const products = window.PRODUCTS || [];
  const $ = (s) => document.querySelector(s);

  const money = (n) => S.currency + Number(n).toLocaleString("en-IN");
  const waNumber = String(S.whatsapp).replace(/\D/g, "");
  const waLink = (text) => `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;

  // Simple line-art placeholders used when a product has no photo yet
  const ICONS = {
    Earrings: '<svg viewBox="0 0 100 100"><circle cx="35" cy="22" r="4" fill="currentColor"/><path d="M35 26v10" stroke="currentColor" stroke-width="2"/><circle cx="35" cy="56" r="20" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="68" cy="22" r="4" fill="currentColor"/><path d="M68 26v14" stroke="currentColor" stroke-width="2"/><path d="M68 40l-9 22h18z" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    Necklaces: '<svg viewBox="0 0 100 100"><path d="M15 15 Q50 80 85 15" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M50 58 l8 10 -8 12 -8 -12z" fill="none" stroke="currentColor" stroke-width="3"/></svg>',
    Rings: '<svg viewBox="0 0 100 100"><circle cx="50" cy="58" r="26" fill="none" stroke="currentColor" stroke-width="4"/><path d="M42 30 l8 -12 8 12 -8 6z" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>',
    Bracelets: '<svg viewBox="0 0 100 100"><ellipse cx="50" cy="50" rx="36" ry="22" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="50" cy="72" r="5" fill="currentColor"/></svg>',
    Anklets: '<svg viewBox="0 0 100 100"><path d="M14 40 Q50 75 86 40" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="4 5"/><circle cx="34" cy="58" r="4" fill="currentColor"/><circle cx="50" cy="62" r="4" fill="currentColor"/><circle cx="66" cy="58" r="4" fill="currentColor"/></svg>',
    default: '<svg viewBox="0 0 100 100"><path d="M50 18 l22 22 -22 42 -22 -42z" fill="none" stroke="currentColor" stroke-width="3"/><path d="M28 40h44" stroke="currentColor" stroke-width="2"/></svg>',
  };

  function media(p) {
    if (p.image) return `<img src="${p.image}" alt="${p.name}" loading="lazy" />`;
    const bg = { Earrings: "#f3e6df", Necklaces: "#efe4d6", Rings: "#f1e8e1", Bracelets: "#ece3d9", Anklets: "#f5ebe4" }[p.category] || "#f3e6df";
    return `<div class="ph" style="background:${bg}">${ICONS[p.category] || ICONS.default}</div>`;
  }

  function priceHtml(p) {
    return money(p.price) + (p.oldPrice ? `<s>${money(p.oldPrice)}</s>` : "");
  }

  function card(p) {
    const badge = p.soldOut ? '<span class="badge sold">Sold out</span>'
      : p.isNew ? '<span class="badge">New</span>'
      : p.oldPrice ? '<span class="badge">Sale</span>' : "";
    return `<button class="card" data-id="${p.id}">
      <div class="card-img">${media(p)}${badge}</div>
      <div class="card-cat">${p.category}</div>
      <div class="card-name">${p.name}</div>
      <div class="card-price">${priceHtml(p)}</div>
    </button>`;
  }

  // New In
  const newOnes = products.filter((p) => p.isNew).slice(0, 4);
  $("#new-grid").innerHTML = newOnes.map(card).join("");
  if (!newOnes.length) $("#new").hidden = true;

  // Filters + Shop grid
  const cats = ["All", ...new Set(products.map((p) => p.category))];
  let current = "All";
  $("#filters").innerHTML = cats.map((c) => `<button class="filter${c === "All" ? " active" : ""}" data-cat="${c}">${c}</button>`).join("");

  function renderShop() {
    const list = current === "All" ? products : products.filter((p) => p.category === current);
    $("#shop-grid").innerHTML = list.map(card).join("");
    $("#empty").hidden = list.length > 0;
  }
  $("#filters").addEventListener("click", (e) => {
    const b = e.target.closest(".filter");
    if (!b) return;
    current = b.dataset.cat;
    document.querySelectorAll(".filter").forEach((f) => f.classList.toggle("active", f === b));
    renderShop();
  });
  renderShop();

  // Modal
  const modal = $("#modal");
  function openProduct(id) {
    const p = products.find((x) => String(x.id) === String(id));
    if (!p) return;
    $("#m-img").innerHTML = media(p);
    $("#m-cat").textContent = p.category;
    $("#m-name").textContent = p.name;
    $("#m-price").innerHTML = priceHtml(p);
    $("#m-desc").textContent = p.description || "";
    $("#m-stock").textContent = p.soldOut ? "Currently sold out — message us to be notified when it's back." : "In stock · Ships in 2–4 days";
    const order = $("#m-order");
    order.textContent = p.soldOut ? "Notify me on WhatsApp" : "Order on WhatsApp";
    order.href = waLink(`Hi ${S.name}! I'd like to ${p.soldOut ? "be notified about" : "order"}: ${p.name} (${money(p.price)})`);
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeModal() { modal.hidden = true; document.body.style.overflow = ""; }
  document.addEventListener("click", (e) => {
    const c = e.target.closest(".card");
    if (c) openProduct(c.dataset.id);
    if (e.target.closest("[data-close]")) closeModal();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  // Contact links
  $("#wa-link").href = waLink(`Hi ${S.name}! I have a question.`);
  $("#ig-link").href = `https://instagram.com/${S.instagram.replace("@", "")}`;
  $("#year").textContent = new Date().getFullYear();

  // Mobile menu
  const btn = $(".menu-btn"), nav = $(".nav");
  btn.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    btn.setAttribute("aria-expanded", open);
  });
  nav.addEventListener("click", (e) => { if (e.target.tagName === "A") { nav.classList.remove("open"); btn.setAttribute("aria-expanded", false); } });
})();
