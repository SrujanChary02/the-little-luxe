// ===== The Little LUXE — site logic (you normally don't need to edit this file) =====
// Other scripts (account.js) talk to this one through window.TLL once TLL.ready resolves.
let markReady;
window.TLL = { ready: new Promise((r) => (markReady = r)) };

(async function () {
  const S = window.STORE || {};
  const AWS = S.aws || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;

  // ---------- helpers ----------
  // Escape text so product names like  Pearl "Drop" <Hoops>  can't break the page
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v, d) => (v === "" || v == null || isNaN(Number(v)) ? d : Number(v));
  const money = (n) => (S.currency || "₹") + Number(n || 0).toLocaleString("en-IN");
  const yes = (v) => v === true || /^(true|yes|y|1|x|✓)$/i.test(String(v ?? "").trim());
  const CFG = {
    freeShippingAbove: num(S.freeShippingAbove, 999),
    shippingFee: num(S.shippingFee, 79),
    giftWrapPrice: num(S.giftWrapPrice, 49),
    budgetPrice: num(S.budgetPrice, 499),
  };
  // Browser storage only remembers things for this visitor; it can be unavailable (private mode), so never rely on it
  const saved = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  };

  // ---------- how customers reach you ----------
  const waNumber = String(S.whatsapp || "").replace(/\D/g, "");
  const hasWhatsApp = waNumber.length >= 10 && !/^(91)?9{10}$/.test(waNumber); // ignore the old 99999 placeholder
  const igHandle = String(S.instagram || "").replace(/^@/, "").trim();
  const igProfile = igHandle ? `https://instagram.com/${igHandle}` : "";
  const igDM = igHandle ? `https://ig.me/m/${igHandle}` : "";
  const canOrder = hasWhatsApp || !!igDM;
  const waLink = (text) => `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;

  // ---------- fill in settings shown in the text (prices, days…) ----------
  $$("[data-store]").forEach((el) => {
    const key = el.dataset.store;
    const v = key in CFG ? CFG[key] : S[key];
    if (v == null || v === "") return;
    el.textContent = "money" in el.dataset ? (Number(v) === 0 && el.dataset.free ? el.dataset.free : money(v)) : v;
  });
  if (CFG.freeShippingAbove <= 0) $(".announce").textContent = "Free shipping on every order · New pieces every week";
  $$("[data-cod]").forEach((el) => (el.hidden = !S.cashOnDelivery));
  $("#year").textContent = new Date().getFullYear();

  // Optional free visitor stats (GoatCounter) — set statsCode in products.js
  if (S.statsCode) {
    const sc = document.createElement("script");
    sc.async = true;
    sc.src = "https://gc.zgo.at/count.js";
    sc.dataset.goatcounter = `https://${encodeURIComponent(S.statsCode)}.goatcounter.com/count`;
    document.head.appendChild(sc);
  }

  // ---------- products: owner page (AWS) → Google Sheet → products.js ----------
  function parseCSV(text) {
    const rows = []; let row = [], field = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c !== "\r") field += c;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows;
  }
  // Google Drive share links → direct image links
  const imgLink = (u) => {
    const m = u.match(/drive\.google\.com\/.*?(?:\/d\/|[?&]id=)([\w-]{20,})/);
    return m ? `https://lh3.googleusercontent.com/d/${m[1]}=w1200` : u;
  };
  async function fetchWithTimeout(url, ms = 6000) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try { return await fetch(url, { cache: "no-store", signal: ctl.signal }); } finally { clearTimeout(t); }
  }
  async function loadProducts() {
    if (AWS.cdnUrl) {
      try {
        const res = await fetchWithTimeout(`${AWS.cdnUrl.replace(/\/$/, "")}/catalog/products.json`);
        if (res.ok) {
          const list = (await res.json()).products || [];
          if (list.length) return list;
        }
      } catch (e) {
        console.warn("[The Little LUXE] Couldn't load products from the shop manager — trying the next source.", e);
      }
    }
    if (S.productsSheet) {
      try {
        const res = await fetchWithTimeout(S.productsSheet);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const rows = parseCSV(await res.text()).filter((r) => r.some((c) => c.trim()));
        const head = rows.shift().map((h) => h.trim().toLowerCase().replace(/[\s_-]+/g, ""));
        const list = rows.map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || "").trim()]))).filter((o) => o.name);
        if (list.length) return list.map((o, i) => ({
          id: o.id || "s" + i, name: o.name, category: o.category || "Jewelry",
          price: num(o.price, 0), oldPrice: num(o.oldprice, undefined),
          images: (o.images || o.image || "").split(/[|\n]+/).map((s) => s.trim()).filter(Boolean),
          description: o.description, isNew: yes(o.isnew), soldOut: yes(o.soldout),
        }));
      } catch (e) {
        console.warn("[The Little LUXE] Couldn't load the Google Sheet — showing products.js instead.", e);
      }
    }
    return window.PRODUCTS || [];
  }
  const products = (await loadProducts()).map((p, i) => ({
    ...p,
    id: String(p.id ?? i),
    price: num(p.price, 0),
    oldPrice: p.oldPrice ? num(p.oldPrice, undefined) : undefined,
    images: (Array.isArray(p.images) ? p.images : p.image ? [p.image] : []).map(imgLink),
    soldOut: yes(p.soldOut), isNew: yes(p.isNew), _order: i,
  }));
  const byId = new Map(products.map((p) => [p.id, p]));

  // ---------- product images ----------
  // Illustrated "studio" artwork shown until a product has real photos (gold/pearl gradients live in index.html)
  const G = 'url(#tll-gold)', P = 'url(#tll-pearl)', C = 'url(#tll-crystal)';
  const floor = '<ellipse cx="100" cy="176" rx="52" ry="5" fill="#7a5a2c" opacity=".08"/>';
  const ART = {
    Earrings: `${floor}<g filter="url(#tll-shadow)">
      <circle cx="72" cy="86" r="24" fill="none" stroke="${G}" stroke-width="6"/><circle cx="72" cy="124" r="12" fill="${P}"/>
      <circle cx="132" cy="96" r="24" fill="none" stroke="${G}" stroke-width="6"/><circle cx="132" cy="134" r="12" fill="${P}"/></g>`,
    Necklaces: `${floor}<path d="M28 30 C 60 140, 140 140, 172 30" fill="none" stroke="${G}" stroke-width="5" stroke-linecap="round" stroke-dasharray="0.1 8"/>
      <g filter="url(#tll-shadow)"><circle cx="100" cy="112" r="4" fill="none" stroke="${G}" stroke-width="2.5"/>
      <path d="M100 116 C 116 134, 120 148, 100 166 C 80 148, 84 134, 100 116 Z" fill="${G}"/>
      <path d="M100 128 C 108 138, 110 146, 100 156 C 90 146, 92 138, 100 128 Z" fill="${C}" opacity=".9"/></g>`,
    Rings: `${floor}<g filter="url(#tll-shadow)"><circle cx="100" cy="118" r="42" fill="none" stroke="${G}" stroke-width="9"/>
      <path d="M90 76 L94 66 M110 76 L106 66" stroke="${G}" stroke-width="3"/>
      <path d="M80 64 L90 50 H110 L120 64 L100 88 Z" fill="${C}" stroke="${G}" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M80 64 H120 M90 50 L96 64 L100 88 L104 64 L110 50" fill="none" stroke="#b9c6d4" stroke-width="1"/></g>`,
    Bracelets: `${floor}<g filter="url(#tll-shadow)"><ellipse cx="100" cy="100" rx="64" ry="36" fill="none" stroke="${G}" stroke-width="6"/>
      <ellipse cx="100" cy="100" rx="64" ry="36" fill="none" stroke="#fff6dc" stroke-width="1" stroke-dasharray="2 10" opacity=".8"/>
      <circle cx="100" cy="140" r="3" fill="${G}"/><circle cx="100" cy="152" r="10" fill="#3f6fb0"/><circle cx="100" cy="152" r="6" fill="#ffffff"/>
      <circle cx="100" cy="152" r="3.2" fill="#1d3557"/><circle cx="100" cy="152" r="10" fill="none" stroke="${G}" stroke-width="2"/></g>`,
    Anklets: `${floor}<path d="M22 64 C 60 130, 140 130, 178 64" fill="none" stroke="${G}" stroke-width="4" stroke-linecap="round" stroke-dasharray="0.1 7"/>
      <g filter="url(#tll-shadow)" fill="${G}">
      <path d="M68 116 c-4-6-12-2-8 5 l8 8 8-8 c4-7-4-11-8-5z"/><path d="M100 126 c-4-6-12-2-8 5 l8 8 8-8 c4-7-4-11-8-5z"/>
      <path d="M132 116 c-4-6-12-2-8 5 l8 8 8-8 c4-7-4-11-8-5z"/></g>`,
    "Gift Sets": `${floor}<g filter="url(#tll-shadow)"><rect x="52" y="92" width="96" height="74" rx="3" fill="#f3dcd2"/>
      <rect x="46" y="76" width="108" height="22" rx="3" fill="#f7e6de"/><rect x="92" y="76" width="16" height="90" fill="${G}"/>
      <path d="M100 76 C 84 52, 58 56, 70 72 C 76 79, 90 78, 100 76 Z M100 76 C 116 52, 142 56, 130 72 C 124 79, 110 78, 100 76 Z" fill="${G}"/></g>`,
    default: `${floor}<g filter="url(#tll-shadow)"><path d="M62 70 L78 46 H122 L138 70 L100 140 Z" fill="${C}" stroke="${G}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M62 70 H138 M78 46 L90 70 L100 140 L110 70 L122 46 M90 70 L100 46 L110 70" fill="none" stroke="#b9c6d4" stroke-width="1"/></g>`,
  };
  const TONE = { Earrings: "rose", Necklaces: "sand", Rings: "pearl", Bracelets: "sand", Anklets: "rose", "Gift Sets": "blush" };
  const art = (cat) => `<svg viewBox="0 0 200 200" aria-hidden="true">${ART[cat] || ART.default}</svg>`;
  const placeholder = (cat) => `<span class="ph tone-${TONE[cat] || "pearl"}">${art(cat)}</span>`;
  const imgTag = (src, alt, cat, lazy = true) =>
    `<img src="${esc(src)}" alt="${esc(alt)}" ${lazy ? 'loading="lazy"' : ""} data-cat="${esc(cat)}" draggable="false" />`;
  const thumb = (p) => (p.images[0] ? imgTag(p.images[0], p.name, p.category) : placeholder(p.category));

  // A photo that can't load (wrong name, or .JPG vs .jpg on the live site) shows the placeholder instead of a broken icon
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (img.tagName !== "IMG" || img.dataset.cat === undefined) return;
    console.warn("[The Little LUXE] Photo not found — check the file name and capitals:", img.getAttribute("src"));
    img.outerHTML = placeholder(img.dataset.cat);
  }, true);

  const priceHtml = (p) => money(p.price) + (p.oldPrice ? ` <s>${money(p.oldPrice)}</s>` : "");

  // ---------- wishlist (saved on this device; account.js also syncs it to the customer's account) ----------
  let wish = new Set(saved.get("tll-wish", []).map(String).filter((id) => byId.has(id)));
  const wishListeners = [];
  const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 6.9 4.5c2.1 0 3.9 1.2 5.1 3 1.2-1.8 3-3 5.1-3 3.5 0 5.5 3.5 4.2 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>';
  function setWish(ids, { silent = false } = {}) {
    wish = new Set([...ids].map(String).filter((id) => byId.has(id)));
    saved.set("tll-wish", [...wish]);
    renderWishUI();
    if (!silent) wishListeners.forEach((fn) => fn([...wish]));
  }
  function toggleWish(id) {
    const next = new Set(wish);
    const added = !next.has(id);
    added ? next.add(id) : next.delete(id);
    setWish(next);
    toast(added ? "Saved to your wishlist" : "Removed from your wishlist");
  }

  function card(p) {
    const badge = p.soldOut ? '<span class="badge sold">Sold out</span>'
      : p.isNew ? '<span class="badge">New</span>'
      : p.oldPrice ? '<span class="badge">Sale</span>' : "";
    const on = wish.has(p.id);
    return `<div class="card-wrap">
      <button type="button" class="card" data-id="${esc(p.id)}" aria-label="${esc(p.name)}, ${esc(money(p.price))}${p.soldOut ? ", sold out" : ""}">
        <span class="card-img">${thumb(p)}${badge}<span class="card-quick" aria-hidden="true">Quick view</span></span>
        <span class="card-cat">${esc(p.category)}</span>
        <span class="card-name">${esc(p.name)}</span>
        <span class="card-price">${priceHtml(p)}</span>
      </button>
      <button type="button" class="heart" data-wish="${esc(p.id)}" aria-pressed="${on}" aria-label="${on ? "Remove" : "Save"} ${esc(p.name)} ${on ? "from" : "to"} wishlist">${HEART}</button>
    </div>`;
  }

  // ---------- New In ----------
  const newOnes = products.filter((p) => p.isNew).slice(0, 4);
  const renderNew = () => ($("#new-grid").innerHTML = newOnes.map(card).join(""));
  renderNew();
  if (!newOnes.length) {
    $("#new").hidden = true;
    $$('a[href="#new"]').forEach((a) => (a.hidden = true));
  }

  // ---------- Shop: filters, search, sort ----------
  const BUDGET = "budget";
  const cats = [...new Set(products.map((p) => p.category))];
  const hasBudget = products.some((p) => p.price < CFG.budgetPrice);
  const shop = { filter: "All", q: "", sort: "featured" };

  $("#filters").innerHTML = ["All", ...cats, ...(hasBudget ? [BUDGET] : [])].map((c) =>
    `<button type="button" class="filter${c === "All" ? " active" : ""}" data-cat="${esc(c)}" aria-pressed="${c === "All"}">${c === BUDGET ? "Under " + esc(money(CFG.budgetPrice)) : esc(c)}</button>`).join("");

  // hide gift shortcuts that would show nothing
  $$("[data-filter]").forEach((t) => {
    const f = t.dataset.filter;
    if ((f === BUDGET && !hasBudget) || (f !== BUDGET && !cats.includes(f))) t.hidden = true;
  });

  function matches(p) {
    if (shop.filter === BUDGET ? p.price >= CFG.budgetPrice : shop.filter !== "All" && p.category !== shop.filter) return false;
    if (!shop.q) return true;
    const hay = `${p.name} ${p.category} ${p.description || ""}`.toLowerCase();
    return shop.q.split(/\s+/).every((w) => hay.includes(w));
  }
  const sorters = {
    featured: (a, b) => a._order - b._order,
    new: (a, b) => (b.isNew - a.isNew) || (Number(b.id) - Number(a.id)) || (a._order - b._order),
    "price-asc": (a, b) => a.price - b.price || a._order - b._order,
    "price-desc": (a, b) => b.price - a.price || a._order - b._order,
  };
  function renderShop() {
    const list = products.filter(matches).sort(sorters[shop.sort] || sorters.featured);
    $("#shop-grid").innerHTML = list.map(card).join("");
    $("#empty").hidden = list.length > 0;
    $("#result-count").textContent = shop.q || shop.filter !== "All"
      ? `${list.length} piece${list.length === 1 ? "" : "s"}${shop.q ? ` for “${shop.q}”` : ""}` : "";
  }
  function setFilter(f) {
    shop.filter = f;
    $$(".filter").forEach((b) => {
      const on = b.dataset.cat === f;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on);
    });
    renderShop();
  }
  $("#filters").addEventListener("click", (e) => { const b = e.target.closest(".filter"); if (b) setFilter(b.dataset.cat); });
  $("#search").addEventListener("input", (e) => { shop.q = e.target.value.trim().toLowerCase(); renderShop(); });
  $("#sort").addEventListener("change", (e) => { shop.sort = e.target.value; renderShop(); });
  renderShop();

  // ---------- Shop by category ----------
  const catCount = (c) => products.filter((p) => p.category === c).length;
  if (cats.length > 1) {
    $("#cat-tiles").innerHTML = cats.map((c) => `
      <button type="button" class="cat-tile" data-filter="${esc(c)}">
        <span class="cat-art">${placeholder(c)}</span>
        <span class="cat-name">${esc(c)}</span>
        <span class="cat-count">${catCount(c)} piece${catCount(c) === 1 ? "" : "s"}</span>
      </button>`).join("");
  } else {
    $("#categories").hidden = true;
  }

  // ---------- dialogs (product pop-up, bag, wishlist, account) ----------
  let openDlg = null, lastFocus = null;
  function lockScroll(on) {
    // both <html> and <body>, so the page behind doesn't scroll on iPhone
    root.style.overflow = on ? "hidden" : "";
    document.body.style.overflow = on ? "hidden" : "";
  }
  function openDialog(el, focusEl) {
    if (openDlg === el) return;
    if (openDlg) openDlg.hidden = true; else lastFocus = document.activeElement;
    openDlg = el;
    el.hidden = false;
    lockScroll(true);
    setMenu(false);
    (focusEl || el.querySelector("button")).focus();
  }
  function closeDialog() {
    if (!openDlg) return;
    openDlg.hidden = true;
    openDlg = null;
    lockScroll(false);
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
    lastFocus = null;
  }
  const focusables = (el) => $$('a[href], button:not([disabled]), input, textarea, select, summary', el)
    .filter((x) => !x.hidden && x.getClientRects().length);
  const drawerClose = (el) => el.querySelector(".drawer-head .modal-close");

  // ---------- product pop-up with photo gallery ----------
  const modal = $("#modal"), gallery = $("#m-gallery");
  let current = null, gIndex = 0, gCount = 1;

  function buildGallery(p) {
    const imgs = p.images.length ? p.images : [null];
    gCount = imgs.length; gIndex = 0;
    gallery.innerHTML = imgs.map((src, i) =>
      `<div class="slide">${src ? imgTag(src, gCount > 1 ? `${p.name} — photo ${i + 1}` : p.name, p.category, i > 0) : placeholder(p.category)}</div>`).join("");
    gallery.scrollLeft = 0;
    $("#m-dots").innerHTML = gCount > 1 ? imgs.map((_, i) => `<button type="button" data-dot="${i}" aria-label="Photo ${i + 1}"${i ? "" : ' aria-current="true"'}></button>`).join("") : "";
    $("#m-prev").hidden = $("#m-next").hidden = gCount < 2;
  }
  function showIndex(i) {
    gIndex = i;
    $$("#m-dots button").forEach((d, k) => d.toggleAttribute("aria-current", k === i));
    $$(".slide.zoomed", gallery).forEach((s) => s.classList.remove("zoomed"));
  }
  function goTo(i) {
    showIndex((i + gCount) % gCount);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    gallery.scrollTo({ left: gIndex * gallery.clientWidth, behavior: reduce ? "auto" : "smooth" });
  }
  let scrollTimer;
  gallery.addEventListener("scroll", () => {
    // when someone swipes, follow along once the swipe settles
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const i = Math.round(gallery.scrollLeft / Math.max(1, gallery.clientWidth));
      if (i !== gIndex) showIndex(i);
    }, 120);
  }, { passive: true });
  // Tap / click a photo to zoom in, move to look around, tap again to zoom out
  const setOrigin = (img, e) => {
    const r = img.getBoundingClientRect();
    img.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
  };
  gallery.addEventListener("click", (e) => {
    const img = e.target.closest(".slide img");
    if (!img) return;
    setOrigin(img, e);
    img.parentElement.classList.toggle("zoomed");
  });
  gallery.addEventListener("pointermove", (e) => {
    const img = e.target.closest(".slide.zoomed img");
    if (img) setOrigin(img, e);
  });

  function renderModalWish() {
    if (!current) return;
    const on = wish.has(current.id), b = $("#m-wish");
    b.setAttribute("aria-pressed", on);
    b.lastElementChild.textContent = on ? "Saved to wishlist" : "Save to wishlist";
  }
  function openProduct(id) {
    const p = byId.get(String(id));
    if (!p) return;
    current = p;
    buildGallery(p);
    $("#m-cat").textContent = p.category;
    $("#m-name").textContent = p.name;
    $("#m-price").innerHTML = priceHtml(p);
    $("#m-desc").textContent = p.description || "";
    $("#m-stock").textContent = p.soldOut
      ? "Currently sold out — message us to be notified when it's back."
      : `In stock · Dispatched in ${S.dispatchDays || "2–4"} working days`;
    const add = $("#m-add");
    add.disabled = p.soldOut;
    add.textContent = p.soldOut ? "Sold out" : "Add to bag";
    const order = $("#m-order");
    order.hidden = !canOrder;
    if (hasWhatsApp) {
      order.href = waLink(`Hi ${S.name}! I'd like to ${p.soldOut ? "be notified about" : "order"}: ${p.name} (${money(p.price)})`);
      order.textContent = p.soldOut ? "Notify me on WhatsApp" : "Buy now on WhatsApp";
    } else if (igDM) {
      order.href = igDM;
      order.textContent = p.soldOut ? "Notify me on Instagram" : "Ask on Instagram";
    }
    renderModalWish();
    openDialog(modal, modal.querySelector(".modal-close"));
  }

  // ---------- shopping bag ----------
  const bagEl = $("#bag");
  let bag = saved.get("tll-bag", []).filter((l) => byId.has(String(l.id)) && !byId.get(String(l.id)).soldOut);
  const extras = Object.assign({ wrap: false, note: "", name: "", address: "" }, saved.get("tll-bag-extras", {}));
  $("#gift-wrap").checked = !!extras.wrap;
  $("#gift-note").value = extras.note || "";
  $("#cust-name").value = extras.name || "";
  $("#cust-address").value = extras.address || "";
  const checkoutListeners = [];

  function totals() {
    const lines = bag.map((l) => ({ ...l, p: byId.get(String(l.id)) }));
    const sub = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
    const ship = sub === 0 || sub >= CFG.freeShippingAbove ? 0 : CFG.shippingFee;
    const gift = extras.wrap && sub > 0 ? CFG.giftWrapPrice : 0;
    return { lines, sub, ship, gift, total: sub + ship + gift, count: lines.reduce((s, l) => s + l.qty, 0) };
  }
  function orderMessage(t) {
    const out = [`Hi ${S.name}! I'd like to order:`, ""];
    t.lines.forEach((l, i) => out.push(`${i + 1}. ${l.p.name} × ${l.qty} — ${money(l.p.price * l.qty)}`));
    out.push("", `Subtotal: ${money(t.sub)}`, `Shipping: ${t.ship ? money(t.ship) : "Free"}`);
    if (extras.wrap) out.push(`Gift wrap: ${t.gift ? money(t.gift) : "Free"}`);
    out.push(`Total: ${money(t.total)}`);
    if (extras.wrap && extras.note.trim()) out.push("", `Gift note: "${extras.note.trim()}"`);
    if (extras.name.trim()) out.push("", `Name: ${extras.name.trim()}`);
    if (extras.address.trim()) out.push(`Deliver to: ${extras.address.trim()}`);
    return out.join("\n");
  }
  function saveBag() { saved.set("tll-bag", bag.map(({ id, qty }) => ({ id, qty }))); saved.set("tll-bag-extras", extras); }

  function renderBag() {
    const t = totals();
    // header count
    $("#bag-count").textContent = t.count;
    $("#bag-count").hidden = t.count === 0;
    $("#bag-btn").setAttribute("aria-label", `Open bag, ${t.count} item${t.count === 1 ? "" : "s"}`);
    // items
    $("#bag-items").innerHTML = t.lines.map((l) => `
      <li class="bag-item">
        <span class="bag-thumb">${thumb(l.p)}</span>
        <span class="bag-info">
          <span class="bag-name">${esc(l.p.name)}</span>
          <span class="bag-price">${money(l.p.price)}</span>
          <span class="qty" role="group" aria-label="Quantity of ${esc(l.p.name)}">
            <button type="button" data-qty="-1" data-id="${esc(l.p.id)}" aria-label="One less">−</button>
            <span aria-live="polite">${l.qty}</span>
            <button type="button" data-qty="1" data-id="${esc(l.p.id)}" aria-label="One more">+</button>
          </span>
        </span>
        <button type="button" class="bag-remove" data-remove="${esc(l.p.id)}" aria-label="Remove ${esc(l.p.name)}">Remove</button>
      </li>`).join("");
    const empty = t.count === 0;
    $("#bag-empty").hidden = !empty;
    $("#bag-extras").hidden = empty;
    $("#bag-foot").hidden = empty;
    $("#gift-note-wrap").hidden = !extras.wrap;
    // free-shipping nudge
    const left = CFG.freeShippingAbove - t.sub;
    const note = $("#ship-note");
    note.hidden = empty || CFG.freeShippingAbove <= 0;
    const pct = Math.min(100, Math.round((t.sub / Math.max(1, CFG.freeShippingAbove)) * 100));
    note.innerHTML = left > 0
      ? `Add <strong>${money(left)}</strong> more for free shipping<span class="bar"><span style="width:${pct}%"></span></span>`
      : `You've unlocked <strong>free shipping</strong><span class="bar"><span style="width:100%"></span></span>`;
    // totals
    $("#t-sub").textContent = money(t.sub);
    $("#t-ship").textContent = t.ship ? money(t.ship) : "Free";
    $("#t-gift-row").hidden = !extras.wrap;
    $("#t-gift").textContent = t.gift ? money(t.gift) : "Free";
    $("#t-total").textContent = money(t.total);
    // checkout
    const co = $("#checkout");
    co.removeAttribute("aria-disabled");
    if (hasWhatsApp) { co.href = waLink(orderMessage(t)); co.textContent = "Send order on WhatsApp"; }
    else if (igDM) { co.href = igDM; co.textContent = "Send order on Instagram"; }
    else { co.removeAttribute("href"); co.setAttribute("aria-disabled", "true"); co.textContent = "Ordering opens soon"; }
    // UPI
    const upi = String(S.upiId || "").trim();
    $("#upi").hidden = !upi || empty;
    if (upi && !empty) {
      const link = `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(S.name || "")}&am=${t.total.toFixed(2)}&cu=INR&tn=${encodeURIComponent((S.name || "") + " order")}`;
      $("#upi-link").href = link;
      $("#upi-link").textContent = `Pay ${money(t.total)} by UPI`;
      if ($(".upi-qr").open) drawQR(link);
    }
  }
  function addToBag(id) {
    const p = byId.get(String(id));
    if (!p || p.soldOut) return;
    const line = bag.find((l) => String(l.id) === p.id);
    if (line) line.qty = Math.min(line.qty + 1, 20); else bag.push({ id: p.id, qty: 1 });
    saveBag(); renderBag();
  }
  function changeQty(id, d) {
    const line = bag.find((l) => String(l.id) === String(id));
    if (!line) return;
    line.qty = Math.max(0, Math.min(20, line.qty + d));
    if (!line.qty) bag = bag.filter((l) => l !== line);
    saveBag(); renderBag();
  }
  function openBag() { renderBag(); openDialog(bagEl, drawerClose(bagEl)); }

  $("#gift-wrap").addEventListener("change", (e) => { extras.wrap = e.target.checked; saveBag(); renderBag(); });
  $("#gift-note").addEventListener("input", (e) => { extras.note = e.target.value; saveBag(); renderBag(); });
  $("#cust-name").addEventListener("input", (e) => { extras.name = e.target.value; saveBag(); renderBag(); });
  $("#cust-address").addEventListener("input", (e) => { extras.address = e.target.value; saveBag(); renderBag(); });
  $("#checkout").addEventListener("click", () => {
    if (!canOrder) return;
    const t = totals();
    if (!t.count) return;
    // let account.js save the order to the customer's account
    const order = {
      items: t.lines.map((l) => ({ id: l.p.id, name: l.p.name, price: l.p.price, qty: l.qty })),
      subtotal: t.sub, shipping: t.ship, giftWrap: t.gift, total: t.total,
      giftNote: extras.wrap ? extras.note.trim() : "", name: extras.name.trim(), address: extras.address.trim(),
    };
    checkoutListeners.forEach((fn) => fn(order));
    // Instagram can't take a pre-written message, so copy the order for the customer to paste
    if (!hasWhatsApp && igDM) {
      navigator.clipboard?.writeText(orderMessage(t)).then(() => toast("Order copied — paste it in the Instagram chat"), () => {});
    }
  });

  // UPI QR code (drawn only when someone opens it)
  let qrLib = null;
  async function drawQR(link) {
    const box = $("#upi-qr-box");
    try {
      qrLib = qrLib || await new Promise((ok, fail) => {
        if (window.qrcode) return ok(window.qrcode);
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
        s.onload = () => ok(window.qrcode); s.onerror = fail;
        document.head.appendChild(s);
      });
      const qr = qrLib(0, "M"); qr.addData(link); qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
      box.querySelector("svg")?.setAttribute("aria-label", "UPI payment QR code");
    } catch { box.textContent = "Couldn't load the QR code — use the UPI button on your phone instead."; }
  }
  $(".upi-qr").addEventListener("toggle", (e) => { if (e.target.open) drawQR($("#upi-link").href); });

  renderBag();

  // ---------- wishlist drawer & hearts ----------
  const wishEl = $("#wish");
  function renderWishUI() {
    const n = wish.size;
    $("#wish-count").textContent = n;
    $("#wish-count").hidden = n === 0;
    $("#wish-btn").setAttribute("aria-label", `Open wishlist, ${n} item${n === 1 ? "" : "s"}`);
    $$("[data-wish]").forEach((b) => {
      const on = wish.has(b.dataset.wish), name = byId.get(b.dataset.wish)?.name || "";
      b.setAttribute("aria-pressed", on);
      b.setAttribute("aria-label", `${on ? "Remove" : "Save"} ${name} ${on ? "from" : "to"} wishlist`);
    });
    renderModalWish();
    const items = [...wish].map((id) => byId.get(id)).filter(Boolean);
    $("#wish-empty").hidden = items.length > 0;
    $("#wish-items").innerHTML = items.map((p) => `
      <li class="bag-item">
        <button type="button" class="bag-thumb as-btn" data-open="${esc(p.id)}" aria-label="View ${esc(p.name)}">${thumb(p)}</button>
        <span class="bag-info">
          <span class="bag-name">${esc(p.name)}</span>
          <span class="bag-price">${priceHtml(p)}</span>
          ${p.soldOut ? '<span class="muted small">Sold out</span>'
            : `<button type="button" class="btn btn-line btn-sm" data-wish-add="${esc(p.id)}">Add to bag</button>`}
        </span>
        <button type="button" class="bag-remove" data-wish-remove="${esc(p.id)}" aria-label="Remove ${esc(p.name)} from wishlist">Remove</button>
      </li>`).join("");
  }
  renderWishUI();

  // ---------- toast ----------
  let toastTimer;
  function toast(text) {
    const t = $("#toast");
    t.textContent = text; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 3200);
  }

  // ---------- reviews (only shown when you've added some) ----------
  const reviews = (window.REVIEWS || []).filter((r) => r && r.text);
  if (reviews.length) {
    $("#reviews").hidden = false;
    $("#reviews-list").innerHTML = reviews.map((r) => {
      const n = Math.max(1, Math.min(5, Math.round(num(r.rating, 5))));
      return `<figure class="review">
        <div class="stars" role="img" aria-label="${n} out of 5 stars">${"★".repeat(n)}${"☆".repeat(5 - n)}</div>
        <blockquote>“${esc(r.text)}”</blockquote>
        <figcaption>${esc(r.name || "A happy customer")}${r.city ? ` · ${esc(r.city)}` : ""}</figcaption>
      </figure>`;
    }).join("");
  }

  // ---------- Google product info (for products that have photos) ----------
  const withPhotos = products.filter((p) => p.images.length);
  if (withPhotos.length) {
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.textContent = JSON.stringify({
      "@context": "https://schema.org", "@type": "ItemList",
      itemListElement: withPhotos.map((p, i) => ({
        "@type": "ListItem", position: i + 1,
        item: {
          "@type": "Product", name: p.name, description: p.description || p.name, category: p.category,
          image: p.images.map((u) => new URL(u, location.href).href),
          brand: { "@type": "Brand", name: S.name },
          offers: { "@type": "Offer", price: p.price, priceCurrency: "INR",
            availability: p.soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock" },
        },
      })),
    });
    document.head.appendChild(ld);
  }

  // ---------- mobile menu ----------
  const menuBtn = $(".menu-btn"), nav = $(".nav");
  function setMenu(open) {
    nav.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }
  menuBtn.addEventListener("click", () => setMenu(!nav.classList.contains("open")));

  // ---------- clicks & keys ----------
  document.addEventListener("click", (e) => {
    const t = e.target;
    const heart = t.closest("[data-wish]");
    if (heart) return toggleWish(heart.dataset.wish);
    const c = t.closest(".card");
    if (c) return openProduct(c.dataset.id);
    if (t.closest("#bag-btn")) return openBag();
    if (t.closest("#wish-btn")) { renderWishUI(); return openDialog(wishEl, drawerClose(wishEl)); }
    if (t.closest("#m-add") && current) { addToBag(current.id); return openBag(); }
    if (t.closest("#m-wish") && current) return toggleWish(current.id);
    const wAdd = t.closest("[data-wish-add]");
    if (wAdd) { addToBag(wAdd.dataset.wishAdd); return openBag(); }
    const wRm = t.closest("[data-wish-remove]");
    if (wRm) return toggleWish(wRm.dataset.wishRemove);
    const wOpen = t.closest("[data-open]");
    if (wOpen) return openProduct(wOpen.dataset.open);
    if (t.closest("[data-close]")) return closeDialog();
    const closeBag = t.closest("[data-close-bag]");
    if (closeBag) {
      closeDialog();
      if (closeBag.dataset.goto) $(closeBag.dataset.goto)?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    const q = t.closest("[data-qty]");
    if (q) return changeQty(q.dataset.id, Number(q.dataset.qty));
    const rm = t.closest("[data-remove]");
    if (rm) return changeQty(rm.dataset.remove, -99);
    const dot = t.closest("[data-dot]");
    if (dot) return goTo(Number(dot.dataset.dot));
    if (t.closest("#m-prev")) return goTo(gIndex - 1);
    if (t.closest("#m-next")) return goTo(gIndex + 1);
    const tile = t.closest("[data-filter]");
    if (tile) { setFilter(tile.dataset.filter); $("#shop").scrollIntoView({ behavior: "smooth" }); return; }
    if (t.closest(".nav a") || (!t.closest(".nav") && !t.closest(".menu-btn"))) setMenu(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (openDlg) closeDialog();
      else if (nav.classList.contains("open")) { setMenu(false); menuBtn.focus(); }
      return;
    }
    if (openDlg === modal && gCount > 1 && (e.key === "ArrowLeft" || e.key === "ArrowRight") && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
      goTo(gIndex + (e.key === "ArrowRight" ? 1 : -1));
    }
    // keep keyboard focus inside the open pop-up / drawer
    if (e.key === "Tab" && openDlg) {
      const f = focusables(openDlg);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (!openDlg.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    }
  });

  // ---------- contact section ----------
  const wa = $("#wa-link"), ig = $("#ig-link");
  wa.hidden = !hasWhatsApp;
  if (hasWhatsApp) wa.href = waLink(`Hi ${S.name}! I have a question.`);
  ig.hidden = !igProfile;
  if (igProfile) ig.href = igProfile;
  $(".contact-actions").hidden = !canOrder;
  if (!canOrder) $("#contact-text").textContent = "We're getting ready to take orders — check back very soon!";

  // ---------- hooks for account.js ----------
  Object.assign(window.TLL, {
    products, byId, money, esc, toast, openDialog, closeDialog, drawerClose, canOrder,
    wish: { get: () => [...wish], set: (ids) => setWish(ids, { silent: true }), onChange: (fn) => wishListeners.push(fn) },
    details: {
      get: () => ({ name: extras.name, address: extras.address }),
      fill(d) { // only fills empty fields, never overwrites what the customer typed
        if (d.name && !extras.name) { extras.name = d.name; $("#cust-name").value = d.name; }
        if (d.address && !extras.address) { extras.address = d.address; $("#cust-address").value = d.address; }
        saveBag(); renderBag();
      },
    },
    onCheckout: (fn) => checkoutListeners.push(fn),
  });
  markReady(window.TLL);
})();
