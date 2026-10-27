import test from "node:test";
import assert from "node:assert/strict";
import { loadBrowserScript, readProject } from "./helpers.mjs";

const { LabI18n } = loadBrowserScript("i18n.js");

const squash = (text) => text.replace(/\s+/g, " ");
const SOURCES = ["index.html", "app.js", "export.js", "ocr.js"].map((file) => squash(readProject(file))).join("\n");

test("every translatable string exists in the page or scripts", () => {
  const missing = LabI18n.strings.filter((text) => !SOURCES.includes(squash(text)));
  assert.equal(missing.length, 0, missing.join(" | "));
});

test("strings are unique and within the server limits", () => {
  assert.equal(new Set(LabI18n.strings).size, LabI18n.strings.length);
  assert.ok(LabI18n.strings.length <= 240);
  for (const text of LabI18n.strings) assert.ok(text.length <= 400 && text === text.trim(), text);
  assert.ok(LabI18n.strings.reduce((sum, text) => sum + text.length, 0) <= 24000);
});
