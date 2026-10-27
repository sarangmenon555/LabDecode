import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { root } from "./helpers.mjs";

const out = fs.mkdtempSync(path.join(os.tmpdir(), "labdecode-dist-"));
const run = spawnSync(process.execPath, ["scripts/build.mjs", "--out=" + out], { cwd: root, encoding: "utf8" });

function walk(directory, found = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else found.push(path.relative(out, full).split(path.sep).join("/"));
  }
  return found;
}

test("the build succeeds", () => {
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /Built \d+ files/);
});

test("every file a page refers to is in the build", () => {
  for (const page of ["index.html", "about.html"]) {
    const html = fs.readFileSync(path.join(out, page), "utf8");
    for (const match of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
      const value = match[1];
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value) || value === "./") continue;
      const file = value.split("#")[0].split("?")[0];
      assert.ok(fs.existsSync(path.join(out, file)) || fs.existsSync(path.join(out, file + ".html")), `${page} refers to ${file}`);
    }
  }
});

test("every file the service worker caches is in the build", () => {
  const sw = fs.readFileSync(path.join(out, "sw.js"), "utf8");
  const list = sw.match(/var SHELL = \[([\s\S]*?)\];/)[1];
  for (const match of list.matchAll(/"([^"]+)"/g)) {
    if (match[1] === "./") continue;
    assert.ok(fs.existsSync(path.join(out, match[1])) || fs.existsSync(path.join(out, match[1] + ".html")), match[1]);
  }
});

test("the build has the headers, offline reader data and manifest icons", () => {
  for (const file of ["_headers", "404.html", "about.html", "manifest.webmanifest", "demo.json", "vendor/tesseract/lang/eng.traineddata.gz", "vendor/pdfjs/pdf.worker.min.mjs", "icons/icon-192.png", "icons/icon-512.png"]) {
    assert.ok(fs.existsSync(path.join(out, file)), file);
  }
});

test("tests, tools, scripts, server code and documents are not published", () => {
  const files = walk(out);
  for (const file of files) {
    assert.ok(!/^(tests|tools|scripts|lib|functions|\.github|node_modules)\//.test(file), file);
    assert.ok(!/\.(md|mjs|py)$/.test(file) || file.startsWith("vendor/"), file);
  }
  assert.ok(!files.includes("package.json"));
});
