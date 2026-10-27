import test from "node:test";
import assert from "node:assert/strict";
import { guard, resetGuard } from "../lib/guard.js";

function request(headers = {}) {
  return new Request("https://site.test/api/decode", { method: "POST", headers, body: "{}" });
}

test("limits requests per connection", () => {
  resetGuard();
  const codes = [];
  for (let i = 0; i < 14; i += 1) {
    const blocked = guard(request({ "cf-connecting-ip": "1.2.3.4" }));
    codes.push(blocked ? blocked.status : 0);
  }
  assert.deepEqual(codes.slice(0, 12), new Array(12).fill(0));
  assert.deepEqual(codes.slice(12), [429, 429]);
  assert.equal(guard(request({ "cf-connecting-ip": "5.6.7.8" })), null);
});

test("rejects other origins and accepts the same origin", () => {
  resetGuard();
  assert.equal(guard(request({ origin: "https://evil.test" })).status, 403);
  assert.equal(guard(request({ origin: "https://site.test" })), null);
});

test("rejects oversized bodies", () => {
  resetGuard();
  assert.equal(guard(request({ "content-length": "500000" })).status, 413);
});
