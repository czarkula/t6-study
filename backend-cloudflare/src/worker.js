const MAX_BODY_BYTES = 4096;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return json({}, 204, env);
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true }, 200, env);
    }

    if (url.pathname !== "/scores") {
      return json({ error: "Not found" }, 404, env);
    }

    if (request.method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT name, kind, elapsed_ms AS elapsedMs, created_at AS date FROM scores ORDER BY elapsed_ms ASC LIMIT 20"
      ).all();
      return json(results, 200, env);
    }

    if (request.method === "POST") {
      const body = await readJson(request);
      const score = cleanScore(body);
      if (!score) {
        return json({ error: "Invalid score" }, 400, env);
      }

      await env.DB.prepare(
        "INSERT INTO scores (name, kind, elapsed_ms, created_at) VALUES (?, ?, ?, ?)"
      ).bind(score.name, score.kind, score.elapsedMs, score.date).run();

      return json(score, 201, env);
    }

    return json({ error: "Method not allowed" }, 405, env);
  }
};

async function readJson(request) {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function cleanScore(score) {
  if (!score || typeof score !== "object") return null;

  const name = String(score.name || "Anonymous").trim().slice(0, 32) || "Anonymous";
  const kind = score.kind === "ops" ? "ops" : "boldface";
  const elapsedMs = Number(score.elapsedMs);

  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs > 60 * 60 * 1000) {
    return null;
  }

  return {
    name,
    kind,
    elapsedMs: Math.round(elapsedMs),
    date: new Date().toISOString()
  };
}

function json(payload, status, env) {
  const allowedOrigin = env.ALLOWED_ORIGIN || "*";

  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
