import test from "node:test";
import assert from "node:assert/strict";
import { loadBrowserScript } from "./helpers.mjs";

const { LabExport } = loadBrowserScript("export.js");

test("builds a calendar file with escaping and folding", () => {
  const ics = LabExport.makeIcs({
    title: "Visit, Dr; test",
    date: "2026-11-05",
    time: "10:30",
    description: "Q1: What?\nQ2: Why, how; done " + "x".repeat(120),
    now: new Date(Date.UTC(2026, 9, 24, 8, 0, 0)),
    uid: "u1@labdecode"
  });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART:20261105T103000\r\n/);
  assert.match(ics, /DTEND:20261105T113000\r\n/);
  assert.match(ics, /SUMMARY:Visit\\, Dr\\; test\r\n/);
  assert.match(ics, /DTSTAMP:20261024T080000Z\r\n/);
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  for (const line of ics.split("\r\n")) assert.ok(Array.from(line).length <= 61, line);
});

test("builds an all-day event when no time is given", () => {
  const ics = LabExport.makeIcs({ date: "2026-11-05", now: new Date(Date.UTC(2026, 9, 24)), uid: "u" });
  assert.match(ics, /DTSTART;VALUE=DATE:20261105/);
  assert.match(ics, /DTEND;VALUE=DATE:20261106/);
  assert.match(ics, /SUMMARY:Appointment with care team/);
});

test("rejects a missing date", () => {
  assert.throws(() => LabExport.makeIcs({ date: "" }), /Choose a date/);
});

test("summary lists flagged findings, differences and all questions", () => {
  const summary = LabExport.buildSummary(
    {
      report_type: "Test report",
      overview: "Overview.",
      findings: [
        { term: "Ki-67", explanation: "Cells dividing.", status: "discuss" },
        { term: "Size", explanation: "Routine.", status: "plain" }
      ],
      questions: ["A?"],
      questions_en: ["A in English?"]
    },
    ["Mine?"],
    { changes: [{ topic: "Size", explanation: "Changed.", status: "discuss" }] }
  );
  assert.match(summary, /- Ki-67: Cells dividing\./);
  assert.ok(!summary.includes("Routine."));
  assert.match(summary, /Differences between the two reports/);
  assert.match(summary, /1\. A\?/);
  assert.match(summary, /English: A in English\?/);
  assert.match(summary, /2\. Mine\?/);
});

test("truncates at a word boundary", () => {
  const out = LabExport.truncate("alpha beta gamma delta epsilon", 14);
  assert.ok(out.endsWith("..."));
  assert.ok(out.length <= 17);
});
