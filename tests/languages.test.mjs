import test from "node:test";
import assert from "node:assert/strict";
import { readProject } from "./helpers.mjs";
import { LANGUAGES, pickLanguage, languageLine } from "../lib/gemini.js";

const INDIAN = ["as", "bn", "gu", "hi", "kn", "ml", "mr", "or", "ta", "te"];

function pageOptions() {
  const select = readProject("index.html").match(/<select id="language">([\s\S]*?)<\/select>/)[1];
  return [...select.matchAll(/<option value="([a-z]{2})">([^<]+)<\/option>/g)].map((match) => ({ code: match[1], label: match[2] }));
}

function regionKeys(file) {
  const block = readProject(file).match(/var REGION = \{([\s\S]*?)\};/)[1];
  return [...block.matchAll(/^\s*([a-z]{2}):/gm)].map((match) => match[1]);
}

test("page, server, read-aloud and dictation list the same languages", () => {
  const server = Object.keys(LANGUAGES).sort();
  const page = pageOptions().map((option) => option.code).sort();
  assert.deepEqual(page, server);
  assert.deepEqual(regionKeys("speech.js").sort(), server);
  assert.deepEqual(regionKeys("dictate.js").sort(), server);
});

test("all ten Indian languages are present", () => {
  for (const code of INDIAN) assert.ok(code in LANGUAGES, code);
});

test("only English and the ten Indian languages are offered", () => {
  const codes = Object.keys(LANGUAGES).filter((code) => code !== "en").sort();
  assert.deepEqual(codes, INDIAN.slice().sort());
  assert.ok("mr" in LANGUAGES);
});

test("Indian languages are shown in their own script on the page", () => {
  const options = pageOptions();
  for (const code of INDIAN) {
    const option = options.find((item) => item.code === code);
    assert.match(option.label, /[^\x00-\x7f]/, code);
  }
});

test("server asks for the native script for every Indian language", () => {
  for (const code of INDIAN) {
    assert.match(LANGUAGES[code], /script/, code);
    assert.match(languageLine(pickLanguage(code)), /native script/, code);
  }
  assert.ok(!/native script/.test(languageLine(pickLanguage("en"))));
});

test("unknown languages fall back to English", () => {
  assert.equal(pickLanguage("xx").code, "en");
  assert.equal(pickLanguage(undefined).code, "en");
});

test("least reliable languages are marked beta", () => {
  const options = pageOptions();
  assert.match(options.find((item) => item.code === "or").label, /beta/);
  assert.match(options.find((item) => item.code === "as").label, /beta/);
  assert.ok(!/beta/.test(options.find((item) => item.code === "hi").label));
});
