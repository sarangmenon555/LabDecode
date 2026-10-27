import test from "node:test";
import assert from "node:assert/strict";
import { loadBrowserScript } from "./helpers.mjs";

const { LabLookup } = loadBrowserScript("lookup.js");

test("has an alphabetical term list", () => {
  const names = LabLookup.all.map((entry) => entry.term);
  const sorted = names.slice().sort((a, b) => a.localeCompare(b));
  assert.deepEqual(names, sorted);
  assert.ok(names.length >= 40);
});

test("finds terms by name and alias", () => {
  assert.equal(LabLookup.search("margin")[0].term, "Margin");
  assert.equal(LabLookup.search("armpit")[0].term, "Axillary lymph nodes");
  assert.equal(LabLookup.search("dcis")[0].term, "Carcinoma in situ");
});

test("short queries do not match inside words", () => {
  const terms = LabLookup.search("er").map((entry) => entry.term);
  assert.equal(terms[0], "Estrogen receptor");
  assert.ok(!terms.includes("Perineural invasion"));
});

test("returns nothing for unknown words and everything for an empty query", () => {
  assert.equal(LabLookup.search("zzzz").length, 0);
  assert.equal(LabLookup.search("").length, LabLookup.all.length);
});

test("every entry has a definition", () => {
  for (const entry of LabLookup.all) assert.ok(entry.definition.length > 20, entry.term);
});
