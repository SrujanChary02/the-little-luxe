// ===== The Little LUXE — sign-in with Amazon Cognito (shared by the shop and the owner page) =====
// Uses Cognito's own secure sign-in page (OAuth 2 with PKCE). Passwords never touch this website.
(function () {
  const C = (window.STORE && window.STORE.aws) || {};
  const enabled = !!(C.authDomain && C.clientId && C.apiUrl);
  const KEY = "tll-auth";
  const authBase = String(C.authDomain || "").replace(/\/$/, "");

  // The exact page address registered with Cognito (".../" or ".../admin.html")
  const redirectUri = () => location.origin + location.pathname.replace(/index\.html$/, "");

  const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const random = (n) => b64url(crypto.getRandomValues(new Uint8Array(n)));
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } };
  const write = (t) => { try { t ? localStorage.setItem(KEY, JSON.stringify(t)) : localStorage.removeItem(KEY); } catch { /* ignore */ } };
  function decode(jwt) {
    try {
      const b = atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"));
      return JSON.parse(new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0))));
    } catch { return null; }
  }

  // screen: "signup" opens the create-account page; provider: e.g. "Google" goes straight to Google
  async function signIn(screen, provider) {
    const verifier = random(48);
    const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
    const state = random(16);
    try { sessionStorage.setItem("tll-pkce", JSON.stringify({ verifier, state, back: location.hash })); } catch { /* ignore */ }
    const u = new URL(`${authBase}/${screen === "signup" && !provider ? "signup" : "oauth2/authorize"}`);
    Object.entries({
      response_type: "code", client_id: C.clientId, redirect_uri: redirectUri(), scope: "openid email profile",
      state, code_challenge: challenge, code_challenge_method: "S256",
      ...(provider ? { identity_provider: provider } : {}),
    }).forEach(([k, v]) => u.searchParams.set(k, v));
    location.assign(u.toString());
  }
  const providers = (Array.isArray(C.providers) ? C.providers : []).filter((p) => /^[\w.-]+$/.test(p));

  // "Continue with Google" style buttons for whichever providers are switched on
  const GOOGLE_G = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
  const providerButtons = () => providers.map((p) =>
    `<button type="button" class="btn btn-social btn-block" data-signin-with="${p}">${p === "Google" ? GOOGLE_G : ""}<span>Continue with ${p}</span></button>`).join("");
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-signin-with]");
    if (b) signIn(null, b.dataset.signinWith);
  });

  async function tokenRequest(params) {
    const r = await fetch(`${authBase}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: C.clientId, ...params }),
    });
    if (!r.ok) throw new Error("Sign-in failed (" + r.status + ")");
    return r.json();
  }
  function store(t, old) {
    write({ id: t.id_token, refresh: t.refresh_token || (old && old.refresh), exp: Date.now() + (t.expires_in || 3600) * 1000 });
  }

  // Coming back from the sign-in page: swap the one-time code for tokens, then tidy the address bar
  async function handleRedirect() {
    const q = new URLSearchParams(location.search);
    const code = q.get("code"), state = q.get("state"), error = q.get("error");
    if (!code && !error) return;
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem("tll-pkce") || "null"); sessionStorage.removeItem("tll-pkce"); } catch { /* ignore */ }
    history.replaceState(null, "", location.pathname + ((saved && saved.back) || ""));
    if (!code || !saved || saved.state !== state) return;
    try {
      store(await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri(), code_verifier: saved.verifier }));
    } catch (e) { console.warn("[The Little LUXE]", e); }
  }

  async function idToken() {
    const t = read();
    if (!t) return null;
    if (Date.now() < t.exp - 60000) return t.id;
    if (!t.refresh) { write(null); return null; }
    try { store(await tokenRequest({ grant_type: "refresh_token", refresh_token: t.refresh }), t); return read().id; }
    catch { write(null); return null; }
  }

  function user() {
    const t = read();
    const p = t && decode(t.id);
    if (!p) return null;
    return { sub: p.sub, email: p.email || "", name: p.name || "", admin: (p["cognito:groups"] || []).includes("admins") };
  }

  function signOut() {
    write(null);
    const u = new URL(`${authBase}/logout`);
    u.searchParams.set("client_id", C.clientId);
    u.searchParams.set("logout_uri", redirectUri());
    location.assign(u.toString());
  }

  async function api(path, { method = "GET", body } = {}) {
    const tok = await idToken();
    if (!tok) throw Object.assign(new Error("Please sign in again."), { status: 401 });
    const r = await fetch(String(C.apiUrl).replace(/\/$/, "") + path, {
      method,
      headers: { Authorization: `Bearer ${tok}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.error || "Something went wrong (" + r.status + ")"), { status: r.status });
    return data;
  }

  window.TLLAuth = {
    enabled, config: C, signIn, signOut, user, idToken, api, providers, providerButtons,
    ready: enabled ? handleRedirect() : Promise.resolve(),
  };
})();
