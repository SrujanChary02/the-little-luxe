// ===== The Little LUXE — shop API (AWS Lambda, Node.js 22) =====
// Customers:  GET /me · PUT /me/profile · PUT /me/wishlist · GET /me/orders · POST /me/orders
// Owner:      GET /admin/orders · PATCH /admin/orders · GET|PUT /admin/products · POST /admin/photos
// Every request must carry a valid Cognito ID token; owner routes also need the "admins" group.
import { DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { createPublicKey, verify, randomUUID, randomBytes } from "node:crypto";

const { TABLE, BUCKET, CDN_URL, USER_POOL_ID, CLIENT_ID, AWS_REGION } = process.env;
const ISSUER = `https://cognito-idp.${AWS_REGION}.amazonaws.com/${USER_POOL_ID}`;
const db = new DynamoDBClient({});
const s3 = new S3Client({});
const STATUSES = ["new", "confirmed", "shipped", "delivered", "cancelled"];

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const reply = (statusCode, body) => ({
  statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(body),
});

// ---------- input cleaning ----------
const text = (v, max = 200) => String(v ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, max);
function int(v, min = 0, max = 10_000_000) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, "Invalid number.");
  return n;
}

// ---------- sign-in check (Cognito ID token, RS256) ----------
let jwks = null;
async function signingKey(kid) {
  if (!jwks) {
    const r = await fetch(`${ISSUER}/.well-known/jwks.json`);
    jwks = (await r.json()).keys || [];
  }
  const jwk = jwks.find((k) => k.kid === kid);
  return jwk ? createPublicKey({ key: jwk, format: "jwk" }) : null;
}
async function currentUser(event) {
  const token = (event.headers?.authorization || "").replace(/^Bearer\s+/i, "");
  const [h, p, sig] = token.split(".");
  if (!sig) throw new HttpError(401, "Please sign in.");
  let header, claims;
  try {
    header = JSON.parse(Buffer.from(h, "base64url").toString());
    claims = JSON.parse(Buffer.from(p, "base64url").toString());
  } catch { throw new HttpError(401, "Please sign in."); }
  const key = header.alg === "RS256" ? await signingKey(header.kid) : null;
  const valid = key && verify("RSA-SHA256", Buffer.from(`${h}.${p}`), key, Buffer.from(sig, "base64url"));
  if (!valid || claims.iss !== ISSUER || claims.aud !== CLIENT_ID || claims.token_use !== "id" || claims.exp * 1000 < Date.now()) {
    throw new HttpError(401, "Please sign in again.");
  }
  return { sub: claims.sub, email: claims.email || "", isAdmin: (claims["cognito:groups"] || []).includes("admins") };
}

// ---------- storage helpers (each record keeps its fields as JSON in "data") ----------
async function getData(pk, sk) {
  const r = await db.send(new GetItemCommand({ TableName: TABLE, Key: { pk: { S: pk }, sk: { S: sk } } }));
  return r.Item ? JSON.parse(r.Item.data.S) : null;
}
async function putData(pk, sk, data, extra = {}) {
  const Item = { pk: { S: pk }, sk: { S: sk }, data: { S: JSON.stringify(data) } };
  for (const [k, v] of Object.entries(extra)) Item[k] = { S: String(v) };
  await db.send(new PutItemCommand({ TableName: TABLE, Item }));
}
const fromItem = (it) => ({ ...JSON.parse(it.data.S), status: it.status?.S || "new", pk: it.pk.S, sk: it.sk.S });

async function readCatalog() {
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: "catalog/products.json" }));
    return JSON.parse(await r.Body.transformToString()).products || [];
  } catch (e) {
    if (e.name === "NoSuchKey") return [];
    throw e;
  }
}

// ---------- routes ----------
async function route(method, path, event, body) {
  const user = await currentUser(event);
  const pk = `USER#${user.sub}`;

  if (method === "GET" && path === "/me") {
    const [profile, wish] = await Promise.all([getData(pk, "PROFILE"), getData(pk, "WISH")]);
    return { email: user.email, isAdmin: user.isAdmin, profile: profile || {}, wishlist: (wish && wish.ids) || [] };
  }

  if (method === "PUT" && path === "/me/profile") {
    const profile = { name: text(body.name, 60), phone: text(body.phone, 20), address: text(body.address, 300), updatedAt: new Date().toISOString() };
    await putData(pk, "PROFILE", profile);
    return { profile };
  }

  if (method === "PUT" && path === "/me/wishlist") {
    const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map((x) => text(x, 40)).filter(Boolean))].slice(0, 200);
    await putData(pk, "WISH", { ids });
    return { ids };
  }

  if (method === "GET" && path === "/me/orders") {
    const r = await db.send(new QueryCommand({
      TableName: TABLE, KeyConditionExpression: "pk = :pk AND begins_with(sk, :o)",
      ExpressionAttributeValues: { ":pk": { S: pk }, ":o": { S: "ORDER#" } }, ScanIndexForward: false, Limit: 50,
    }));
    return { orders: (r.Items || []).map(fromItem).map(({ pk: _p, sk: _s, ...o }) => o) };
  }

  if (method === "POST" && path === "/me/orders") {
    const raw = Array.isArray(body.items) ? body.items.slice(0, 50) : [];
    if (!raw.length) throw new HttpError(400, "Your bag is empty.");
    // Use the real prices from the product list whenever we can, so totals can't be edited in the browser
    const catalog = new Map((await readCatalog()).map((p) => [String(p.id), p]));
    let unverified = false;
    const items = raw.map((i) => {
      const known = catalog.get(String(i.id));
      if (!known) unverified = true;
      return { id: text(i.id, 40), name: text(known ? known.name : i.name, 120), price: known ? int(known.price) : int(i.price), qty: int(i.qty, 1, 20) };
    });
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const shipping = int(body.shipping ?? 0, 0, 10_000), giftWrap = int(body.giftWrap ?? 0, 0, 10_000);
    const now = new Date().toISOString();
    const id = randomBytes(4).toString("hex").toUpperCase();
    const order = {
      number: `TLL-${id}`, createdAt: now, items, subtotal, shipping, giftWrap, total: subtotal + shipping + giftWrap,
      giftNote: text(body.giftNote, 200), name: text(body.name, 60), phone: text(body.phone, 20), address: text(body.address, 300),
      email: user.email, unverifiedPrices: unverified, clientTotal: int(body.total ?? 0),
    };
    await putData(pk, `ORDER#${now}#${id}`, order, { status: "new", gsi1pk: "ORDERS", gsi1sk: `${now}#${id}` });
    return { order: { ...order, status: "new" } };
  }

  // ---------- owner only ----------
  if (path.startsWith("/admin/") && !user.isAdmin) throw new HttpError(403, "This account doesn't have owner access.");

  if (method === "GET" && path === "/admin/orders") {
    const r = await db.send(new QueryCommand({
      TableName: TABLE, IndexName: "gsi1", KeyConditionExpression: "gsi1pk = :o",
      ExpressionAttributeValues: { ":o": { S: "ORDERS" } }, ScanIndexForward: false, Limit: 200,
    }));
    return { orders: (r.Items || []).map(fromItem) };
  }

  if (method === "PATCH" && path === "/admin/orders") {
    const okKeys = /^USER#[\w-]+$/.test(body.pk || "") && /^ORDER#/.test(body.sk || "");
    if (!okKeys || !STATUSES.includes(body.status)) throw new HttpError(400, "Invalid order update.");
    await db.send(new UpdateItemCommand({
      TableName: TABLE, Key: { pk: { S: body.pk }, sk: { S: body.sk } },
      UpdateExpression: "SET #s = :s", ConditionExpression: "attribute_exists(pk)",
      ExpressionAttributeNames: { "#s": "status" }, ExpressionAttributeValues: { ":s": { S: body.status } },
    }));
    return { ok: true, status: body.status };
  }

  if (method === "GET" && path === "/admin/products") {
    return { products: await readCatalog() };
  }

  if (method === "PUT" && path === "/admin/products") {
    if (!Array.isArray(body.products) || body.products.length > 500) throw new HttpError(400, "Invalid product list.");
    const seen = new Set();
    const products = body.products.map((p, i) => {
      const name = text(p.name, 120);
      if (!name) throw new HttpError(400, `Product ${i + 1} needs a name.`);
      let id = text(p.id, 40) || `p${Date.now().toString(36)}${i}`;
      if (seen.has(id)) id = `${id}-${i}`;
      seen.add(id);
      const images = (Array.isArray(p.images) ? p.images : []).slice(0, 10).map((u) => text(u, 500)).filter((u) => /^(https:\/\/|images\/)/.test(u));
      const out = { id, name, category: text(p.category, 40) || "Jewelry", price: int(p.price), images, description: text(p.description, 1000), isNew: !!p.isNew, soldOut: !!p.soldOut };
      if (p.oldPrice) out.oldPrice = int(p.oldPrice);
      return out;
    });
    const catalog = JSON.stringify({ updatedAt: new Date().toISOString(), products });
    await Promise.all([
      s3.send(new PutObjectCommand({
        Bucket: BUCKET, Key: "catalog/products.json", ContentType: "application/json",
        CacheControl: "public, max-age=30", Body: catalog,
      })),
      // The website loads this script version: browsers don't need CORS headers for scripts, and
      // CloudFront's CORS headers go missing on Chrome requests that carry a "priority" header.
      s3.send(new PutObjectCommand({
        Bucket: BUCKET, Key: "catalog/products.js", ContentType: "application/javascript; charset=utf-8",
        CacheControl: "public, max-age=30", Body: `window.TLL_CATALOG=${catalog};`,
      })),
    ]);
    return { count: products.length };
  }

  if (method === "POST" && path === "/admin/photos") {
    const types = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
    const ext = types[body.type];
    const bytes = Buffer.from(String(body.data || ""), "base64");
    if (!ext || !bytes.length) throw new HttpError(400, "Please choose a JPG, PNG or WebP photo.");
    if (bytes.length > 4 * 1024 * 1024) throw new HttpError(400, "That photo is too big (max 4 MB).");
    const key = `photos/${randomUUID()}.${ext}`;
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: bytes, ContentType: body.type, CacheControl: "public, max-age=31536000, immutable" }));
    return { url: `${CDN_URL}/${key}` };
  }

  throw new HttpError(404, "Not found.");
}

export async function handler(event) {
  const method = event.requestContext?.http?.method || "GET";
  const path = (event.rawPath || "/").replace(/\/+$/, "") || "/";
  try {
    let body = {};
    if (event.body) {
      const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString() : event.body;
      try { body = JSON.parse(raw); } catch { throw new HttpError(400, "Invalid request."); }
    }
    return reply(200, await route(method, path, event, body));
  } catch (e) {
    if (e instanceof HttpError) return reply(e.status, { error: e.message });
    console.error(e);
    return reply(500, { error: "Something went wrong. Please try again." });
  }
}
