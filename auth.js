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

  async function signIn(screen) {
    const verifier = random(48);
    const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
    const state = random(16);
    try { sessionStorage.setItem("tll-pkce", JSON.stringify({ verifier, state, back: location.hash })); } catch { /* ignore */ }
    const u = new URL(`${authBase}/${screen === "signup" ? "signup" : "oauth2/authorize"}`);
    Object.entries({
      response_type: "code", client_id: C.clientId, redirect_uri: redirectUri(), scope: "openid email profile",
      state, code_challenge: challenge, code_challenge_method: "S256",
    }).forEach(([k, v]) => u.searchParams.set(k, v));
    location.assign(u.toString());
  }

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
    enabled, config: C, signIn, signOut, user, idToken, api,
    ready: enabled ? handleRedirect() : Promise.resolve(),
  };
})();
