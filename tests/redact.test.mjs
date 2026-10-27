import test from "node:test";
import assert from "node:assert/strict";
import { loadBrowserScript } from "./helpers.mjs";

const { redact } = loadBrowserScript("redact.js").LabRedact;

const SAMPLE = `Hospital: Sunrise Medical Centre
Patient Name: Anita Joseph
UHID: 2024-0098321
DOB: 12/03/1971   Age: 54   Sex: F
Phone: +91 98765 43210
Contact me at anita.j@example.com or 9876543210.
Accession No: S24-12345
Collected on 14 Jan 2025 and reported on 16/01/2025.
Referred by Dr. Suresh Kumar
Specimen: Right breast, 10 o'clock, core needle biopsy.
Final diagnosis: Invasive ductal carcinoma, grade 2.
Size of invasive focus: 14 mm. Ki-67 approximately 18 percent. HER2 score 1+ (negative).
Hb 12.5 13.2 14.1 11.0 ; WBC 4500 6000 7200
Signed out by Dr. R. Menon MD
Landline 0468-2345678`;

test("removes identifying fields", () => {
  const out = redact(SAMPLE).text;
  for (const secret of ["Anita", "2024-0098321", "98765", "anita.j@example.com", "9876543210", "S24-12345", "Suresh", "Menon", "2345678", "14 Jan 2025", "16/01/2025"]) {
    assert.ok(!out.includes(secret), secret);
  }
});

test("keeps age, sex and clinical content", () => {
  const out = redact(SAMPLE).text;
  for (const kept of ["Age: 54", "Sex: F", "10 o'clock", "Invasive ductal carcinoma, grade 2", "14 mm", "Ki-67 approximately 18 percent", "HER2 score 1+", "Hb 12.5 13.2 14.1 11.0", "WBC 4500 6000 7200"]) {
    assert.ok(out.includes(kept), kept);
  }
});

test("counts what was removed", () => {
  const result = redact(SAMPLE);
  assert.equal(result.total, result.counts.labeled + result.counts.contact + result.counts.id + result.counts.date + result.counts.name);
  assert.ok(result.total >= 10);
});

test("leaves clean text unchanged", () => {
  const text = "Final diagnosis: Invasive ductal carcinoma, grade 2. Ki-67 approximately 18 percent.";
  const result = redact(text);
  assert.equal(result.text, text);
  assert.equal(result.total, 0);
});

test("handles non-string input", () => {
  assert.equal(redact(undefined).text, "");
});
