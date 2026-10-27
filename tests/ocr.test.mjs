import test from "node:test";
import assert from "node:assert/strict";
import { loadBrowserScript } from "./helpers.mjs";

const { LabOCR } = loadBrowserScript("ocr.js", { document: { baseURI: "https://site.test/" } });

test("lists unsure words with numbers first and the weakest first", () => {
  const result = LabOCR.summarize({
    text: "x",
    confidence: 71.6,
    words: [
      { text: "Hb", confidence: 95 },
      { text: "specimen:", confidence: 40 },
      { text: "1B", confidence: 62 },
      { text: "4S00", confidence: 30 },
      { text: "...", confidence: 5 },
      { text: "left", confidence: 69 }
    ]
  });
  assert.equal(result.confidence, 72);
  assert.deepEqual(Array.from(result.uncertain, (item) => item.text), ["4S00", "1B", "specimen:", "left"]);
});

test("limits the unsure list and copes with missing data", () => {
  const words = Array.from({ length: 40 }, (_, i) => ({ text: "w" + i, confidence: 10 }));
  assert.equal(LabOCR.summarize({ text: "", confidence: 10, words }).uncertain.length, 15);
  const empty = LabOCR.summarize(undefined);
  assert.equal(empty.text, "");
  assert.equal(empty.uncertain.length, 0);
});
