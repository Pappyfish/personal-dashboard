import { createToken, getPassword, isAuthorized, json, readState, writeState } from "../functions/api/_shared.js";

async function handleLogin(request, env) {
  const configuredPassword = getPassword(env);
  if (!configuredPassword) {
    return json({ error: "EDIT_PASSWORD is not configured" }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body?.password !== configuredPassword) {
    return json({ error: "Invalid password" }, { status: 401 });
  }

  return json({ token: await createToken(env) });
}

async function handleState(request, env) {
  if (request.method === "GET") {
    return json(await readState(env));
  }

  if (request.method !== "PUT") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  if (!(await isAuthorized(request, env))) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, { status: 400 });
  }

  await writeState(env, {
    settings: body?.settings || { timezone: "Asia/Shanghai" },
    assignments: Array.isArray(body?.assignments) ? body.assignments : [],
    memos: Array.isArray(body?.memos) ? body.memos : [],
    notes: Array.isArray(body?.notes) ? body.notes : [],
  });

  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/login" && request.method === "POST") {
      return handleLogin(request, env);
    }

    if (url.pathname === "/api/state") {
      return handleState(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
