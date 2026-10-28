import { json } from "./lib/gemini.js";
import * as decode from "./functions/api/decode.js";
import * as compare from "./functions/api/compare.js";
import * as learn from "./functions/api/learn.js";
import * as ask from "./functions/api/ask.js";
import * as labels from "./functions/api/labels.js";

const ROUTES = {
  "/api/decode": decode,
  "/api/compare": compare,
  "/api/learn": learn,
  "/api/ask": ask,
  "/api/labels": labels
};

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname.replace(/\/+$/, "");
    const route = ROUTES[path];

    if (route) {
      return request.method === "POST" ? route.onRequestPost({ request, env }) : route.onRequest({ request, env });
    }
    if (path.startsWith("/api/")) {
      return json({ error: "Not found." }, 404);
    }
    return env.ASSETS.fetch(request);
  }
};
