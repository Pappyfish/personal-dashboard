import { isAuthorized, json, readState, writeState } from "./_shared.js";

export async function onRequestGet({ env }) {
  return json(await readState(env));
}

export async function onRequestPut({ request, env }) {
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
