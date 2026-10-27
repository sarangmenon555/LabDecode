import test from "node:test";
import assert from "node:assert/strict";
import { scriptShare, stripLatinTokens, hasMarker, toAsciiDigits, numbersIn } from "../lib/scriptcheck.js";

test("measures the share of letters in the expected script", () => {
  assert.equal(scriptShare("ଓଡ଼ିଆ", "or"), 1);
  assert.equal(scriptShare("ଓଡ଼ିଆ", "hi"), 0);
  assert.ok(scriptShare("Ki-67 ଏହା ରିପୋର୍ଟ", "or") > 0.5);
  assert.equal(scriptShare("", "or"), 0);
  assert.equal(scriptShare("text", "xx"), 0);
});

test("Devanagari serves Hindi and Marathi, Bengali script serves Assamese", () => {
  assert.equal(scriptShare("मराठी", "mr"), 1);
  assert.equal(scriptShare("मराठी", "hi"), 1);
  assert.equal(scriptShare("অসমীয়া", "as"), 1);
});

test("removes brand names and Latin tokens before comparing", () => {
  const cleaned = stripLatinTokens("LabDecode ਨਾਲ HER2 Ki-67 ଅଛି");
  assert.ok(!/[A-Za-z]/.test(cleaned));
  assert.ok(cleaned.includes("ଅଛି"));
});

test("finds language marker words", () => {
  assert.ok(hasMarker("यह रिपोर्ट नहीं बताती", "hi"));
  assert.ok(hasMarker("हे आहे", "mr"));
  assert.ok(!hasMarker("hello", "ta"));
});

test("converts native digits to ASCII", () => {
  assert.equal(toAsciiDigits("१४ मिमी", "hi"), "14 मिमी");
  assert.equal(toAsciiDigits("১৮ শতাংশ", "bn"), "18 শতাংশ");
  assert.equal(toAsciiDigits("௧௨", "ta"), "12");
  assert.deepEqual(Array.from(numbersIn("Ki-67 ௧௮ and 14", "ta")), ["67", "18", "14"]);
});
