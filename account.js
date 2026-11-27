// ===== The Little LUXE — customer accounts (sign in, details, orders, wishlist sync) =====
// Does nothing unless sign-in is set up (STORE.aws in products.js).
(async function () {
  const A = window.TLLAuth;
  if (!A || !A.enabled) return;
  const [T] = await Promise.all([window.TLL.ready, A.ready]);
  const $ = (s, r = document) => r.querySelector(s);
  const esc = T.esc, money = T.money;
  const drawer = $("#account"), body = $("#account-body");

  let me = null;        // { email, isAdmin, profile, wishlist }
  let orders = null;    // loaded when the account panel opens
  const user = () => A.user();

  // ---------- header button ----------
  document.querySelectorAll("[data-account]").forEach((el) => (el.hidden = false));
  function renderButton() {
    const u = user();
    const first = ((me && me.profile && me.profile.name) || (u && u.name) || "").split(" ")[0];
    $("#account-label").textContent = u ? (first || "Account") : "Sign in";
    $("#account-btn").setAttribute("aria-label", u ? "Your account" : "Sign in");
    document.querySelectorAll(".nav-account").forEach((a) => (a.textContent = u ? "My account" : "Sign in"));
    $("#wish-note").textContent = u ? "Saved to your account." : "Saved on this device — sign in to keep it on all your devices.";
  }

  // ---------- account panel ----------
  const statusPill = (s) => `<span class="pill ${esc(s)}">${esc(s)}</span>`;
  const when = (iso) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

  function render() {
    const u = user();
    if (!u) {
      $("#account-title").textContent = "Sign in";
      body.innerHTML = `
        <p class="acct-intro">Sign in or create a free account to:</p>
        <ul class="acct-perks">
          <li>Keep your wishlist on every device</li>
          <li>Fill in your name and address automatically</li>
          <li>See your past orders and their status</li>
        </ul>
        <div class="acct-actions">
          ${A.providerButtons()}
          ${A.providerButtons() ? '<p class="or-line"><span>or use your email</span></p>' : ""}
          <button type="button" class="btn btn-dark btn-block" data-signin>Sign in</button>
          <button type="button" class="btn btn-line btn-block" data-signup>Create an account</button>
        </div>
        <p class="muted small" style="margin-top:16px">You'll sign in on a secure page and come straight back here. You can still shop without an account.</p>`;
      return;
    }
    const p = (me && me.profile) || {};
    $("#account-title").textContent = "Your account";
    body.innerHTML = `
      <p class="acct-hello">Hello${p.name ? ", " + esc(p.name.split(" ")[0]) : ""}!</p>
      <p class="acct-email">${esc(u.email)}</p>
      ${me && me.isAdmin ? `<p style="margin-bottom:16px"><a class="btn btn-gold btn-block" href="admin.html">Manage the shop</a></p>` : ""}
      <section class="acct-section">
        <h4>Your details</h4>
        <form class="acct-form" id="profile-form">
          <label class="field"><span>Name</span><input name="name" autocomplete="name" maxlength="60" value="${esc(p.name || "")}" /></label>
          <label class="field"><span>Phone</span><input name="phone" type="tel" autocomplete="tel" maxlength="20" value="${esc(p.phone || "")}" placeholder="For delivery updates" /></label>
          <label class="field"><span>Delivery address</span><textarea name="address" rows="3" maxlength="300" autocomplete="street-address" placeholder="House no, street, area, city, PIN code">${esc(p.address || "")}</textarea></label>
          <button type="submit" class="btn btn-dark">Save details</button>
          <p class="acct-status" id="profile-status" aria-live="polite">${me ? "" : "Loading your details…"}</p>
        </form>
      </section>
      <section class="acct-section">
        <h4>Your orders</h4>
        <div id="orders-list">${renderOrders()}</div>
      </section>
      <section class="acct-section">
        <button type="button" class="link-btn" data-signout>Sign out</button>
      </section>`;
  }
  function renderOrders() {
    if (orders === null) return `<p class="muted small">Loading…</p>`;
    if (orders === "error") return `<p class="muted small">Couldn't load your orders right now.</p>`;
    if (!orders.length) return `<p class="muted small">No orders yet. When you send an order while signed in, it shows up here.</p>`;
    return orders.map((o) => `
      <div class="order-card">
        <div class="order-top"><span class="order-no">${esc(o.number)}</span>${statusPill(o.status)}</div>
        <div class="muted small">${esc(when(o.createdAt))}</div>
        <ul class="order-items">${o.items.map((i) => `<li>${esc(i.name)} × ${i.qty}</li>`).join("")}</ul>
        <strong>${money(o.total)}</strong>
      </div>`).join("");
  }

  async function loadOrders() {
    try { orders = (await A.api("/me/orders")).orders || []; } catch { orders = "error"; }
    const el = $("#orders-list");
    if (el) el.innerHTML = renderOrders();
  }
  function openPanel() {
    render();
    T.openDialog(drawer, T.drawerClose(drawer));
    if (user()) loadOrders();
  }

  // ---------- events ----------
  document.addEventListener("click", (e) => {
    const t = e.target;
    if (t.closest("[data-account]")) { e.preventDefault(); return openPanel(); }
    if (t.closest("[data-signin]")) return A.signIn();
    if (t.closest("[data-signup]")) return A.signIn("signup");
    if (t.closest("[data-signout]")) return A.signOut();
  });
  document.addEventListener("submit", async (e) => {
    if (e.target.id !== "profile-form") return;
    e.preventDefault();
    const f = new FormData(e.target);
    const profile = { name: f.get("name"), phone: f.get("phone"), address: f.get("address") };
    const st = $("#profile-status");
    st.textContent = "Saving…";
    try {
      const r = await A.api("/me/profile", { method: "PUT", body: profile });
      me = { ...(me || {}), profile: r.profile };
      st.textContent = "Saved ✓";
      T.details.fill(r.profile);
      renderButton();
    } catch (err) { st.textContent = err.message; }
  });

  // ---------- wishlist sync ----------
  let wishTimer;
  T.wish.onChange((ids) => {
    if (!user()) return;
    clearTimeout(wishTimer);
    wishTimer = setTimeout(() => A.api("/me/wishlist", { method: "PUT", body: { ids } }).catch(() => {}), 500);
  });

  // ---------- save orders to the account ----------
  let lastOrderKey = "";
  T.onCheckout(async (order) => {
    if (!user()) return;
    const key = JSON.stringify([order.items, order.total]);
    if (key === lastOrderKey) return; // don't save the same order twice if the button is tapped again
    lastOrderKey = key;
    try {
      const r = await A.api("/me/orders", { method: "POST", body: { ...order, phone: (me && me.profile && me.profile.phone) || "" } });
      T.toast(`Order ${r.order.number} saved to your account`);
      orders = null;
    } catch { lastOrderKey = ""; }
  });

  // ---------- on load: fetch the customer's details ----------
  renderButton();
  if (user()) {
    try {
      me = await A.api("/me");
      // merge this device's wishlist with the account's
      const local = T.wish.get(), remote = (me.wishlist || []).map(String);
      const merged = [...new Set([...remote, ...local])];
      T.wish.set(merged);
      if (merged.length !== remote.length) A.api("/me/wishlist", { method: "PUT", body: { ids: merged } }).catch(() => {});
      T.details.fill(me.profile || {});
    } catch (e) {
      if (e.status === 401) T.toast("Please sign in again.");
    }
    renderButton();
    if (!drawer.hidden) render();
  }
})();
