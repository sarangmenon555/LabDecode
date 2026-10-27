import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { root } from "./helpers.mjs";

function run(args, env = {}) {
  const out = path.join(os.tmpdir(), "labdecode-verify-" + process.pid + "-" + Math.random().toString(16).slice(2));
  const result = spawnSync(process.execPath, ["scripts/verify-languages.mjs", "--delay=0", "--out=" + out, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, GEMINI_API_KEY: "", ...env }
  });
  return { status: result.status, output: result.stdout + result.stderr };
}

test("the live verifier passes a well-behaved model", () => {
  const { status, output } = run(["--selftest", "--lang=hi,or,as"]);
  assert.equal(status, 0, output);
  assert.match(output, /0 failed/);
});

test("the live verifier fails a model that invents quotes and answers outlook questions", () => {
  const { status, output } = run(["--selftest", "--selftest-bad", "--lang=ta"]);
  assert.equal(status, 1, output);
  assert.match(output, /goes to the care team/);
  assert.match(output, /word for word/);
});

test("the live verifier refuses to run without a key", () => {
  const { status, output } = run(["--lang=hi"]);
  assert.equal(status, 2, output);
  assert.match(output, /GEMINI_API_KEY/);
});
