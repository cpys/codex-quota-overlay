const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

function reply(status, body) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function validString(value, min, max) {
  return typeof value === "string" && value.length >= min && value.length <= max;
}

function validateHeartbeat(body) {
  if (!body || typeof body !== "object") return "invalid JSON object";
  if (body.schemaVersion !== 1) return "unsupported schemaVersion";
  if (body.event !== "daily_active") return "unsupported event";
  if (!validString(body.installationId, 36, 36) || !/^[0-9a-f-]{36}$/i.test(body.installationId)) return "invalid installationId";
  if (!validString(body.appVersion, 5, 32) || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(body.appVersion)) return "invalid appVersion";
  if (body.platform !== "windows") return "invalid platform";
  if (!validString(body.osVersion, 1, 48)) return "invalid osVersion";
  if (!validString(body.locale, 1, 32)) return "invalid locale";
  if (!validString(body.sentAt, 20, 40) || Number.isNaN(Date.parse(body.sentAt))) return "invalid sentAt";
  return null;
}

async function hashInstallationId(id, salt) {
  const bytes = new TextEncoder().encode(`${salt}:${id.toLowerCase()}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function heartbeat(request, env) {
  if (!env.DB || !env.INSTALL_ID_SALT) return reply(503, { ok: false, error: "service_not_configured" });

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("application/json")) return reply(415, { ok: false, error: "json_required" });
  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (declaredLength > 4096) return reply(413, { ok: false, error: "payload_too_large" });

  let body;
  try {
    const text = await request.text();
    if (text.length > 4096) return reply(413, { ok: false, error: "payload_too_large" });
    body = JSON.parse(text);
  } catch {
    return reply(400, { ok: false, error: "invalid_json" });
  }

  const validationError = validateHeartbeat(body);
  if (validationError) return reply(400, { ok: false, error: "invalid_payload", detail: validationError });

  const installHash = await hashInstallationId(body.installationId, env.INSTALL_ID_SALT);
  const now = new Date().toISOString();
  const activeDay = now.slice(0, 10);

  await env.DB.prepare(`
    INSERT INTO daily_active
      (install_hash, active_day, app_version, os_version, locale, first_seen_at, last_seen_at, heartbeat_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(install_hash, active_day) DO UPDATE SET
      app_version = excluded.app_version,
      os_version = excluded.os_version,
      locale = excluded.locale,
      last_seen_at = excluded.last_seen_at,
      heartbeat_count = daily_active.heartbeat_count + 1
  `).bind(installHash, activeDay, body.appVersion, body.osVersion, body.locale, now, now).run();

  return reply(202, { ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/healthz") return reply(200, { ok: true });
    if (request.method === "POST" && url.pathname === "/v1/heartbeat") return heartbeat(request, env);
    return reply(404, { ok: false, error: "not_found" });
  },

  async scheduled(_controller, env) {
    if (!env.DB) return;
    await env.DB.prepare("DELETE FROM daily_active WHERE active_day < date('now', '-90 days')").run();
  },
};
