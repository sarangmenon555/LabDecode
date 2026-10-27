import test from "node:test";
import assert from "node:assert/strict";
import { loadBrowserScript, readProject } from "./helpers.mjs";

const { redact } = loadBrowserScript("redact.js").LabRedact;
const sets = [
  ["tuned corpus", JSON.parse(readProject("tests/fixtures/redaction-corpus.json"))],
  ["second corpus", JSON.parse(readProject("tests/fixtures/redaction-corpus-2.json"))]
];

for (const [label, corpus] of sets) {
  for (const entry of corpus) {
    test(`${label}: ${entry.name}`, () => {
      const out = redact(entry.text).text;
      for (const secret of entry.secrets) assert.ok(!out.includes(secret), "leaked " + secret);
      for (const kept of entry.keep) assert.ok(out.includes(kept), "lost " + kept);
    });
  }
}

test("known gaps are documented: unlabelled names and odd labels still pass through", () => {
  const gaps = sets.flatMap(([, corpus]) => corpus.flatMap((entry) => entry.knownGaps.map((gap) => [entry, gap])));
  assert.ok(gaps.length >= 3);
  for (const [entry, gap] of gaps) {
    assert.ok(redact(entry.text).text.includes(gap), "now removed, move out of knownGaps: " + gap);
  }
});

test("clinical text with label-like words is untouched", () => {
  const text = "Name of procedure: Wide local excision.\nHospital course: uneventful.\npH: 6.5\nSample: Core needle biopsy.";
  const result = redact(text);
  assert.equal(result.text, text);
  assert.equal(result.total, 0);
});

test("repeated redaction changes nothing more", () => {
  const first = redact("Patient Name: Anita Joseph   UHID: P-1\nAddress: 12 Temple Road,\nKottayam 686001").text;
  const second = redact(first);
  assert.equal(second.text, first);
});
