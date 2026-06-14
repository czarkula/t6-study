const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "leaderboard.json");
const MAX_BODY_BYTES = 4096;
const MAX_RESULTS = 100;

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function readScores() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (error) {
    return [];
  }
}

function writeScores(scores) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(scores, null, 2));
}

function cleanScore(score) {
  const name = String(score.name || "Anonymous").trim().slice(0, 32);
  const kind = score.kind === "ops" ? "ops" : "boldface";
  const elapsedMs = Number(score.elapsedMs);

  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs > 60 * 60 * 1000) {
    return null;
  }

  return {
    name: name || "Anonymous",
    kind,
    elapsedMs: Math.round(elapsedMs),
    date: new Date().toISOString()
  };
}

function collectBody(req, callback) {
  let body = "";
  req.on("data", chunk => {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      req.destroy();
    }
  });
  req.on("end", () => callback(body));
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    return sendJson(res, 204, {});
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/health") {
    return sendJson(res, 200, { ok: true });
  }

  if (url.pathname !== "/scores") {
    return sendJson(res, 404, { error: "Not found" });
  }

  if (req.method === "GET") {
    const scores = readScores()
      .sort((a, b) => a.elapsedMs - b.elapsedMs)
      .slice(0, 20);
    return sendJson(res, 200, scores);
  }

  if (req.method === "POST") {
    return collectBody(req, body => {
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch (error) {
        return sendJson(res, 400, { error: "Invalid JSON" });
      }

      const score = cleanScore(parsed);
      if (!score) {
        return sendJson(res, 400, { error: "Invalid score" });
      }

      const scores = readScores();
      scores.push(score);
      scores.sort((a, b) => a.elapsedMs - b.elapsedMs);
      writeScores(scores.slice(0, MAX_RESULTS));
      return sendJson(res, 201, score);
    });
  }

  return sendJson(res, 405, { error: "Method not allowed" });
});

server.listen(PORT, () => {
  console.log(`T-6 practice leaderboard API listening on ${PORT}`);
});
