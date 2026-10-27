import test from "node:test";
import assert from "node:assert/strict";
import { loadBrowserScript } from "./helpers.mjs";
import { LANGUAGES } from "../lib/gemini.js";
import { scriptShare, stripLatinTokens, hasMarker, NEGATIONS, BRANDS } from "../lib/scriptcheck.js";

const locales = loadBrowserScript("locales.js").LabLocales;
const strings = Array.from(loadBrowserScript("i18n.js").LabI18n.strings);
const CODES = Object.keys(LANGUAGES).filter((code) => code !== "en");
const KEYS = Object.keys(locales.hi);
const NEGATING = KEYS.filter((key) => /does not|not medical|Nothing is saved/.test(key));

test("every Indian language has a fixed table and nothing else does", () => {
  assert.equal(Object.keys(locales).sort().join(","), CODES.slice().sort().join(","));
});

test("all tables cover the same keys, and each key is a real interface string", () => {
  assert.equal(KEYS.length, 19);
  for (const code of CODES) {
    assert.equal(Object.keys(locales[code]).join("|"), KEYS.join("|"), code);
  }
  const missing = KEYS.filter((key) => !strings.includes(key));
  assert.equal(missing.length, 0, missing.join(" | "));
});

test("translations are written in the expected script", () => {
  for (const code of CODES) {
    for (const key of KEYS) {
      const value = locales[code][key];
      assert.ok(value && value.trim() === value, `${code}: ${key}`);
      const share = scriptShare(stripLatinTokens(value), code);
      assert.ok(share >= 0.99, `${code}: ${share.toFixed(2)} for ${key.slice(0, 40)}`);
    }
  }
});

test("brand and service names are kept", () => {
  for (const code of CODES) {
    for (const key of KEYS) {
      for (const brand of BRANDS) {
        if (key.includes(brand)) assert.ok(locales[code][key].includes(brand), `${code}: ${brand} in ${key.slice(0, 40)}`);
      }
    }
  }
});

test("statements that deny a capability keep their negation", () => {
  assert.ok(NEGATING.length >= 5);
  for (const code of CODES) {
    for (const key of NEGATING) {
      assert.match(locales[code][key], NEGATIONS[code], `${code}: ${key.slice(0, 50)}`);
    }
  }
});

test("long texts contain common words of the language", () => {
  const long = KEYS.filter((key) => key.length > 100);
  for (const code of CODES) {
    for (const key of long) assert.ok(hasMarker(locales[code][key], code), `${code}: ${key.slice(0, 40)}`);
  }
});

test("Assamese uses its own letters, not the Bengali ra", () => {
  for (const key of KEYS) {
    assert.ok(!locales.as[key].includes("র"), key.slice(0, 40));
  }
  assert.ok(Object.values(locales.as).join("").includes("ৰ"));
});

test("translated length is plausible", () => {
  for (const code of CODES) {
    for (const key of KEYS) {
      const ratio = locales[code][key].length / key.length;
      assert.ok(ratio > 0.3 && ratio < 2.2, `${code}: ${ratio.toFixed(2)} for ${key.slice(0, 40)}`);
    }
  }
});
