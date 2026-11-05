import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readProject, root } from "./helpers.mjs";
import { resetGuard } from "../lib/guard.js";
import worker from "../worker.js";

const env = {
  GEMINI_API_KEY: "k",
  ASSETS: { fetch: async (request) => new Response("asset " + new URL(request.url).pathname) }
};

const call = (method, route, body, headers = {}) =>
  worker.fetch(new Request("https://site.test" + route, { method, headers, body: body ? JSON.stringify(body) : undefined }), env);

beforeEach(() => resetGuard());

test("pages and files are served from the assets binding", async () => {
  for (const route of ["/", "/about", "/styles.css", "/vendor/tesseract/lang/eng.traineddata.gz"]) {
    const response = await call("GET", route);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "asset " + route);
  }
});

test("API routes reach their handlers", async () => {
  let response = await call("POST", "/api/decode", { text: "short" });
  assert.equal(response.status, 400);
  response = await call("POST", "/api/labels", { language: "en", strings: ["a"] });
  assert.equal(response.status, 400);
  response = await call("POST", "/api/ask", { text: "short", question: "What is it?" });
  assert.equal(response.status, 400);
  response = await call("POST", "/api/learn", {});
  assert.equal(response.status, 400);
  response = await call("POST", "/api/compare", { text: "short" });
  assert.equal(response.status, 400);
});

test("wrong methods, other origins and unknown API paths are refused", async () => {
  assert.equal((await call("GET", "/api/decode")).status, 405);
  assert.equal((await call("POST", "/api/decode", { text: "short" }, { origin: "https://evil.test" })).status, 403);
  const unknown = await call("GET", "/api/unknown");
  assert.equal(unknown.status, 404);
  assert.deepEqual(await unknown.json(), { error: "Not found." });
});

test("a trailing slash on an API path still routes", async () => {
  assert.equal((await call("POST", "/api/decode/", { text: "short" })).status, 400);
});

test("every function file has a route and every route has a file", () => {
  const files = fs
    .readdirSync(path.join(root, "functions", "api"))
    .filter((name) => name.endsWith(".js"))
    .map((name) => "/api/" + name.replace(".js", ""))
    .sort();
  const source = readProject("worker.js");
  const routes = [...source.matchAll(/"(\/api\/[a-z]+)":/g)].map((match) => match[1]).sort();
  assert.equal(routes.join(","), files.join(","));
});

test("the Cloudflare configuration points at real files", () => {
  const config = JSON.parse(readProject("wrangler.jsonc"));
  const pkg = JSON.parse(readProject("package.json"));
  assert.equal(config.name, pkg.name);
  assert.ok(fs.existsSync(path.join(root, config.main)));
  assert.equal(config.assets.directory, "./dist");
  assert.equal(config.assets.binding, "ASSETS");
  assert.deepEqual(config.assets.run_worker_first, ["/api/*"]);
  assert.equal(config.build.command, "npm run build");
  assert.equal(config.keep_vars, true);
});
