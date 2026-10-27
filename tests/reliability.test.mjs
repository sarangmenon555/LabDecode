import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { generate } from "../lib/gemini.js";

const realFetch = globalThis.fetch;
const env = { GEMINI_API_KEY: "k", GEMINI_RETRY_DELAY_MS: "0", GEMINI_TIMEOUT_MS: "40" };
const okReply = (data) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(data) }] } }] }), { status: 200 });
const status = (code, headers = {}) => new Response("{}", { status: code, headers });

function script(steps) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(decodeURIComponent(url));
    const step = steps[Math.min(calls.length - 1, steps.length - 1)];
    return step(options);
  };
  return calls;
}

const run = () => generate({ env, system: "s", prompt: "p", schema: {} });

afterEach(() => {
  globalThis.fetch = realFetch;
});

test("retries when the service is overloaded and then succeeds", async () => {
  const calls = script([() => status(503), () => status(503), () => okReply({ ok: 1 })]);
  const result = await run();
  assert.deepEqual(result, { data: { ok: 1 } });
  assert.equal(calls.length, 3);
});

test("gives a clear message when every attempt is overloaded", async () => {
  const calls = script([() => status(503)]);
  const result = await run();
  assert.equal(result.status, 503);
  assert.match(result.error, /busy/);
  assert.equal(calls.length, 3);
});

test("retries once after a rate limit", async () => {
  const calls = script([() => status(429, { "retry-after": "0" }), () => okReply({ ok: 2 })]);
  const result = await run();
  assert.deepEqual(result, { data: { ok: 2 } });
  assert.equal(calls.length, 2);
});

test("reports a persistent rate limit as 429", async () => {
  script([() => status(429)]);
  const result = await run();
  assert.equal(result.status, 429);
});

test("retries when the reply is cut off or empty", async () => {
  const cut = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"a": ' }] } }] }), { status: 200 });
  const empty = () => new Response(JSON.stringify({ candidates: [] }), { status: 200 });
  const calls = script([cut, empty, () => okReply({ ok: 3 })]);
  const result = await run();
  assert.deepEqual(result, { data: { ok: 3 } });
  assert.equal(calls.length, 3);
});

test("does not retry blocked content", async () => {
  const calls = script([() => new Response(JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } }), { status: 200 })]);
  const result = await run();
  assert.equal(result.status, 422);
  assert.equal(calls.length, 1);
});

test("stops waiting for a request that hangs", async () => {
  const hang = (options) =>
    new Promise((resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("aborted")));
    });
  const calls = script([hang]);
  const started = Date.now();
  const result = await run();
  assert.equal(result.status, 504);
  assert.match(result.error, /too long/);
  assert.equal(calls.length, 3);
  assert.ok(Date.now() - started < 2000);
});

test("reports a rejected key as a configuration problem without retrying it", async () => {
  const calls = script([() => status(403)]);
  const result = await run();
  assert.equal(result.status, 500);
  assert.match(result.error, /not configured/);
  assert.equal(calls.length, 1);
});

test("falls back to a second model when the first keeps failing", async () => {
  const calls = script([() => status(503), () => status(503), () => status(503), () => okReply({ ok: 4 })]);
  const result = await generate({ env: { ...env, GEMINI_MODEL: "primary", GEMINI_FALLBACK_MODEL: "backup" }, system: "s", prompt: "p", schema: {} });
  assert.deepEqual(result, { data: { ok: 4 } });
  assert.ok(calls[0].includes("models/primary:"));
  assert.ok(calls[3].includes("models/backup:"));
});

test("falls back when the primary model name does not exist", async () => {
  const calls = script([() => status(404), () => okReply({ ok: 5 })]);
  const result = await generate({ env: { ...env, GEMINI_MODEL: "typo", GEMINI_FALLBACK_MODEL: "good" }, system: "s", prompt: "p", schema: {} });
  assert.deepEqual(result, { data: { ok: 5 } });
  assert.ok(calls[1].includes("models/good:"));
});

test("fails without a key", async () => {
  const result = await generate({ env: {}, system: "s", prompt: "p", schema: {} });
  assert.equal(result.status, 500);
});
