import { json } from "./gemini.js";

const WINDOW_MS = 60 * 1000;
const LIMIT = 12;
const MAX_BODY_BYTES = 120000;
const PRUNE_AT = 2000;

const hits = new Map();

function prune(now) {
  for (const [key, times] of hits) {
    if (!times.length || now - times[times.length - 1] > WINDOW_MS) hits.delete(key);
  }
}

export function guard(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY_BYTES) {
    return json({ error: "The request is too large." }, 413);
  }

  const origin = request.headers.get("origin");
  if (origin) {
    let allowed = false;
    try {
      allowed = new URL(origin).host === new URL(request.url).host;
    } catch (error) {
      allowed = false;
    }
    if (!allowed) return json({ error: "This request is not allowed." }, 403);
  }

  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((time) => now - time < WINDOW_MS);

  if (recent.length >= LIMIT) {
    hits.set(ip, recent);
    return json({ error: "Too many requests from this connection. Wait a minute and try again." }, 429);
  }

  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > PRUNE_AT) prune(now);
  return null;
}

export function resetGuard() {
  hits.clear();
}
