const STATE_KEY = "dashboard-state.json";

export const defaultState = {
  settings: { timezone: "Asia/Shanghai" },
  assignments: [],
  memos: [],
  notes: [],
};

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers || {}),
    },
  });
}

export function getPassword(env) {
  return env.EDIT_PASSWORD || "";
}

async function secretKey(env) {
  const secret = env.AUTH_SECRET || env.EDIT_PASSWORD || "development-secret";
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function base64Url(bytes) {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

export async function createToken(env) {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 14,
  };
  const encodedPayload = base64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await secretKey(env), new TextEncoder().encode(encodedPayload));
  return `${encodedPayload}.${base64Url(signature)}`;
}

export async function isAuthorized(request, env) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const [encodedPayload, encodedSignature] = token.split(".");
  if (!encodedPayload || !encodedSignature) return false;

  const ok = await crypto.subtle.verify(
    "HMAC",
    await secretKey(env),
    fromBase64Url(encodedSignature),
    new TextEncoder().encode(encodedPayload),
  );
  if (!ok) return false;

  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encodedPayload)));
    return Number(payload.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export async function readState(env) {
  const bucket = env.DASHBOARD_BUCKET;
  if (!bucket) return defaultState;

  const object = await bucket.get(STATE_KEY);
  if (!object) return defaultState;

  try {
    return { ...defaultState, ...(await object.json()) };
  } catch {
    return defaultState;
  }
}

export async function writeState(env, state) {
  const bucket = env.DASHBOARD_BUCKET;
  if (!bucket) throw new Error("DASHBOARD_BUCKET binding is missing");

  await bucket.put(STATE_KEY, JSON.stringify(state), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}
