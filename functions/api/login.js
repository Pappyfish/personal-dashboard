import { createToken, getPassword, json } from "./_shared.js";

export async function onRequestPost({ request, env }) {
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
