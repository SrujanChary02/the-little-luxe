// ===== The Little LUXE — shop manager (owner only) =====
(async function () {
  const A = window.TLLAuth, S = window.STORE || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = $("#admin-root");
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => (S.currency || "₹") + Number(n || 0).toLocaleString("en-IN");
  let toastTimer;
  const toast = (t) => { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.hidden = true), 3000); };

  if (!A || !A.enabled) {
    root.innerHTML = `<div class="admin-card"><h1>Shop manager</h1><p class="muted">Sign-in isn't set up yet. Once the AWS backend is deployed (see README), this page lets you manage products and orders.</p></div>`;
    return;
  }
  await A.ready;
  const user = A.user();
  if (!user) {
    root.innerHTML = `<div class="admin-card"><h1>Shop manager</h1><p class="muted">Sign in with the owner account to manage products and orders.</p>
      <div class="acct-actions" style="width:100%;max-width:320px">${A.providerButtons()}
      <button type="button" class="btn btn-dark btn-block" id="signin">Sign in with email</button></div></div>`;
    $("#signin").onclick = () => A.signIn();
    return;
  }
  $("#signout").hidden = false;
  $("#signout").onclick = () => A.signOut();
  if (!user.admin) {
    root.innerHTML = `<div class="admin-card"><h1>Shop manager</h1><p>You're signed in as <strong>${esc(user.email)}</strong>, but this account doesn't have owner access.</p>
      <p class="muted">The developer can give it access with <code>bash aws/make-owner.sh ${esc(user.email)}</code>, then sign out and back in.</p></div>`;
    return;
  }

  // ---------- layout ----------
  root.innerHTML = `
    <div class="admin-top">
      <div><p class="eyebrow">Shop manager</p><h1>Hello, owner</h1></div>
      <p class="admin-save" id="save-status" aria-live="polite"></p>
    </div>
    <div class="admin-tabs" role="tablist">
      <button type="button" role="tab" aria-selected="true" data-tab="products">Products</button>
      <button type="button" role="tab" aria-selected="false" data-tab="orders">Orders</button>
    </div>
    <section id="tab-products"></section>
    <section id="tab-orders" hidden></section>`;
  $$(".admin-tabs [data-tab]").forEach((b) => b.addEventListener("click", () => {
    $$(".admin-tabs [data-tab]").forEach((x) => x.setAttribute("aria-selected", x === b));
    $("#tab-products").hidden = b.dataset.tab !== "products";
    $("#tab-orders").hidden = b.dataset.tab !== "orders";
    if (b.dataset.tab === "orders") loadOrders();
  }));

  // ---------- products ----------
  let products = [];
  let loaded = false;
  const PH = '<span class="ph admin-ph">♢</span>';

  async function loadProducts() {
    try { products = (await A.api("/admin/products")).products || []; loaded = true; }
    catch (e) { $("#tab-products").innerHTML = `<p class="acct-status">Couldn't load products: ${esc(e.message)}</p>`; return; }
    renderProducts();
  }
  function renderProducts() {
    const el = $("#tab-products");
    const banner = products.length ? "" : `
      <div class="admin-note">
        <p><strong>Your shop is still showing the sample products from products.js.</strong>
        Add your first product here and the shop switches to the products you manage on this page.</p>
        <button type="button" class="btn btn-line btn-sm" id="import">Start from the ${(window.PRODUCTS || []).length} sample products instead</button>
      </div>`;
    el.innerHTML = `${banner}
      <div class="admin-bar">
        <button type="button" class="btn btn-dark" id="add">+ Add product</button>
        <span class="muted small">${products.length} product${products.length === 1 ? "" : "s"} · changes save automatically</span>
      </div>
      <ul class="admin-list">${products.map((p, i) => `
        <li class="admin-item">
          <span class="admin-thumb">${p.images && p.images[0] ? `<img src="${esc(p.images[0])}" alt="" loading="lazy" />` : PH}</span>
          <span class="admin-info">
            <strong>${esc(p.name)}</strong>
            <span class="muted small">${esc(p.category)} · ${money(p.price)}${p.oldPrice ? ` <s>${money(p.oldPrice)}</s>` : ""} · ${(p.images || []).length} photo${(p.images || []).length === 1 ? "" : "s"}</span>
            <span class="admin-flags">
              <label class="check small"><input type="checkbox" data-flag="isNew" data-i="${i}" ${p.isNew ? "checked" : ""} /> New</label>
              <label class="check small"><input type="checkbox" data-flag="soldOut" data-i="${i}" ${p.soldOut ? "checked" : ""} /> Sold out</label>
            </span>
          </span>
          <span class="admin-actions">
            <button type="button" class="icon-mini" data-move="-1" data-i="${i}" aria-label="Move ${esc(p.name)} up" ${i === 0 ? "disabled" : ""}>↑</button>
            <button type="button" class="icon-mini" data-move="1" data-i="${i}" aria-label="Move ${esc(p.name)} down" ${i === products.length - 1 ? "disabled" : ""}>↓</button>
            <button type="button" class="btn btn-line btn-sm" data-edit="${i}">Edit</button>
            <button type="button" class="link-btn small" data-delete="${i}">Delete</button>
          </span>
        </li>`).join("")}</ul>`;
    $("#cat-list").innerHTML = [...new Set(["Earrings", "Necklaces", "Rings", "Bracelets", "Anklets", "Gift Sets", ...products.map((p) => p.category)])]
      .map((c) => `<option value="${esc(c)}">`).join("");
  }

  let saveTimer;
  function save(now = false) {
    $("#save-status").textContent = "Saving…";
    clearTimeout(saveTimer);
    const run = async () => {
      try {
        await A.api("/admin/products", { method: "PUT", body: { products } });
        $("#save-status").textContent = "All changes saved ✓ — live on the shop within a minute";
      } catch (e) { $("#save-status").textContent = "Not saved: " + e.message; }
    };
    if (now) return run();
    saveTimer = setTimeout(run, 600);
  }

  $("#tab-products").addEventListener("click", (e) => {
    const t = e.target;
    if (t.closest("#add")) return openEditor(-1);
    if (t.closest("#import")) {
      products = (window.PRODUCTS || []).map((p) => ({ ...p, id: String(p.id), images: p.images || (p.image ? [p.image] : []) }));
      renderProducts(); save(true); return;
    }
    const ed = t.closest("[data-edit]");
    if (ed) return openEditor(Number(ed.dataset.edit));
    const del = t.closest("[data-delete]");
    if (del) {
      const p = products[Number(del.dataset.delete)];
      if (confirm(`Delete “${p.name}” from the shop? This can't be undone.`)) { products.splice(Number(del.dataset.delete), 1); renderProducts(); save(); }
      return;
    }
    const mv = t.closest("[data-move]");
    if (mv) {
      const i = Number(mv.dataset.i), j = i + Number(mv.dataset.move);
      [products[i], products[j]] = [products[j], products[i]];
      renderProducts(); save();
    }
  });
  $("#tab-products").addEventListener("change", (e) => {
    const f = e.target.closest("[data-flag]");
    if (!f) return;
    products[Number(f.dataset.i)][f.dataset.flag] = f.checked;
    save();
  });

  // ---------- product editor ----------
  const editor = $("#editor"), form = $("#editor-form");
  let editIndex = -1, photos = [], uploading = 0;
  function renderPhotos() {
    $("#photo-grid").innerHTML = photos.map((u, i) => `
      <span class="photo-tile">
        <img src="${esc(u)}" alt="Photo ${i + 1}" />
        ${i === 0 ? '<span class="photo-main">Main</span>' : `<button type="button" class="photo-btn star" data-main="${i}" aria-label="Make photo ${i + 1} the main photo">★</button>`}
        <button type="button" class="photo-btn" data-unphoto="${i}" aria-label="Remove photo ${i + 1}">×</button>
      </span>`).join("");
  }
  function openEditor(i) {
    editIndex = i;
    const p = i >= 0 ? products[i] : { name: "", category: "", price: "", oldPrice: "", description: "", isNew: true, soldOut: false, images: [] };
    $("#editor-title").textContent = i >= 0 ? "Edit product" : "Add a product";
    form.name.value = p.name; form.category.value = p.category; form.price.value = p.price;
    form.oldPrice.value = p.oldPrice || ""; form.description.value = p.description || "";
    form.isNew.checked = !!p.isNew; form.soldOut.checked = !!p.soldOut;
    photos = [...(p.images || [])];
    renderPhotos();
    $("#editor-error").textContent = ""; $("#photo-status").textContent = "";
    editor.hidden = false;
    document.documentElement.style.overflow = "hidden";
    form.name.focus();
  }
  function closeEditor() { editor.hidden = true; document.documentElement.style.overflow = ""; }
  editor.addEventListener("click", (e) => {
    if (e.target.closest("[data-close-editor]")) return closeEditor();
    const m = e.target.closest("[data-main]");
    if (m) { const [x] = photos.splice(Number(m.dataset.main), 1); photos.unshift(x); return renderPhotos(); }
    const r = e.target.closest("[data-unphoto]");
    if (r) { photos.splice(Number(r.dataset.unphoto), 1); renderPhotos(); }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !editor.hidden) closeEditor(); });

  // Shrink phone photos before uploading (max 1600px, JPEG) so the shop stays fast
  async function shrink(file) {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
    if (!bmp) throw new Error(`Couldn't read ${file.name} — try a JPG or PNG.`);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85).split(",")[1];
  }
  $("#photo-input").addEventListener("change", async (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    for (let k = 0; k < files.length; k++) {
      uploading++;
      $("#photo-status").textContent = `Uploading photo ${k + 1} of ${files.length}…`;
      try {
        const { url } = await A.api("/admin/photos", { method: "POST", body: { type: "image/jpeg", data: await shrink(files[k]) } });
        photos.push(url); renderPhotos();
      } catch (err) { $("#photo-status").textContent = err.message; uploading--; return; }
      uploading--;
    }
    $("#photo-status").textContent = `${files.length} photo${files.length === 1 ? "" : "s"} added ✓`;
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const err = $("#editor-error");
    if (uploading) { err.textContent = "Please wait for the photos to finish uploading."; return; }
    const name = form.name.value.trim(), price = Number(form.price.value);
    if (!name) { err.textContent = "Please give the product a name."; return form.name.focus(); }
    if (!(price >= 0) || form.price.value === "") { err.textContent = "Please enter a price."; return form.price.focus(); }
    const p = {
      id: editIndex >= 0 ? products[editIndex].id : "p" + Date.now().toString(36),
      name, category: form.category.value.trim() || "Jewelry", price: Math.round(price),
      oldPrice: form.oldPrice.value ? Math.round(Number(form.oldPrice.value)) : undefined,
      description: form.description.value.trim(), isNew: form.isNew.checked, soldOut: form.soldOut.checked, images: photos,
    };
    if (editIndex >= 0) products[editIndex] = p; else products.unshift(p);
    closeEditor(); renderProducts(); save(true);
    toast(editIndex >= 0 ? "Product updated" : "Product added");
  });

  // ---------- orders ----------
  const STATUSES = ["new", "confirmed", "shipped", "delivered", "cancelled"];
  let orders = [], filter = "open";
  const when = (iso) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  async function loadOrders() {
    const el = $("#tab-orders");
    el.innerHTML = `<p class="muted">Loading orders…</p>`;
    try { orders = (await A.api("/admin/orders")).orders || []; }
    catch (e) { el.innerHTML = `<p class="acct-status">Couldn't load orders: ${esc(e.message)}</p>`; return; }
    renderOrders();
  }
  function renderOrders() {
    const list = orders.filter((o) => filter === "all" || (filter === "open" ? !["delivered", "cancelled"].includes(o.status) : o.status === filter));
    $("#tab-orders").innerHTML = `
      <div class="admin-bar">
        <label class="sort"><span>Show</span>
          <select id="order-filter">
            ${[["open", "Open orders"], ["all", "All orders"], ...STATUSES.map((s) => [s, s[0].toUpperCase() + s.slice(1)])]
              .map(([v, l]) => `<option value="${v}" ${v === filter ? "selected" : ""}>${l}</option>`).join("")}
          </select></label>
        <button type="button" class="link-btn small" id="refresh-orders">Refresh</button>
      </div>
      <p class="muted small" style="margin-bottom:14px">Orders appear here when signed-in customers send them. Orders from guests arrive only in WhatsApp.</p>
      ${list.length ? list.map((o) => {
        const phone = String(o.phone || "").replace(/\D/g, "");
        return `
        <article class="order-card admin-order">
          <div class="order-top"><span class="order-no">${esc(o.number)}</span><span class="muted small">${esc(when(o.createdAt))}</span></div>
          <p><strong>${esc(o.name || "No name")}</strong> · ${esc(o.email)}${phone ? ` · <a href="https://wa.me/${phone}" target="_blank" rel="noopener">${esc(o.phone)}</a>` : ""}</p>
          ${o.address ? `<p class="muted small">${esc(o.address)}</p>` : ""}
          <ul class="order-items">${o.items.map((i) => `<li>${esc(i.name)} × ${i.qty} — ${money(i.price * i.qty)}</li>`).join("")}</ul>
          <p>Total <strong>${money(o.total)}</strong>${o.giftWrap ? " · gift wrapped" : ""}${o.shipping ? ` · shipping ${money(o.shipping)}` : " · free shipping"}</p>
          ${o.giftNote ? `<p class="muted small">Gift note: “${esc(o.giftNote)}”</p>` : ""}
          ${o.unverifiedPrices ? `<p class="acct-status">Some prices couldn't be checked against your product list — double-check this order.</p>` : ""}
          <label class="sort"><span>Status</span>
            <select data-order="${esc(o.pk)}|${esc(o.sk)}">${STATUSES.map((s) => `<option ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}</select>
          </label>
        </article>`;
      }).join("") : `<p class="muted">No ${filter === "all" ? "" : filter === "open" ? "open " : filter + " "}orders.</p>`}`;
  }
  $("#tab-orders").addEventListener("change", async (e) => {
    if (e.target.id === "order-filter") { filter = e.target.value; return renderOrders(); }
    const sel = e.target.closest("[data-order]");
    if (!sel) return;
    const [pk, sk] = sel.dataset.order.split("|");
    try {
      await A.api("/admin/orders", { method: "PATCH", body: { pk, sk, status: sel.value } });
      const o = orders.find((x) => x.pk === pk && x.sk === sk);
      if (o) o.status = sel.value;
      toast(`Marked as ${sel.value}`);
    } catch (err) { toast(err.message); }
  });
  $("#tab-orders").addEventListener("click", (e) => { if (e.target.closest("#refresh-orders")) loadOrders(); });

  await loadProducts();
  if (!loaded) return;
})();
