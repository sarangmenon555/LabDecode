import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { jsonRequest, geminiReply } from "./helpers.mjs";
import { resetGuard } from "../lib/guard.js";
import { onRequestPost as decode } from "../functions/api/decode.js";
import { onRequestPost as compare } from "../functions/api/compare.js";
import { onRequestPost as learn } from "../functions/api/learn.js";
import { onRequestPost as ask } from "../functions/api/ask.js";
import { onRequestPost as labels } from "../functions/api/labels.js";

const env = { GEMINI_API_KEY: "test-key" };
const TEXT = "Final diagnosis: example finding text long enough to pass validation.";
const realFetch = globalThis.fetch;
let lastBody = null;
let reply = null;

beforeEach(() => {
  resetGuard();
  lastBody = null;
  globalThis.fetch = async (url, options) => {
    lastBody = JSON.parse(options.body);
    return reply(lastBody.contents[0].parts[0].text);
  };
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

const DECODE_PAYLOAD = {
  report_type: "Test report",
  overview: "Overview.",
  overview_en: "Overview in English.",
  findings: [
    { quote: "q", term: "Ki-67", explanation: "Marks dividing cells.", status: "bogus", ask: "", term_en: "Ki-67", explanation_en: "English." },
    { quote: "", term: "", explanation: "", status: "plain", ask: "", term_en: "", explanation_en: "" }
  ],
  lab_values: [
    { name: "Hb", value: "12.5", reference_range: "13-17", flag: "within_range", meaning: "m" },
    { name: "ER", value: "95 %", reference_range: "", flag: "outside_range", meaning: "m" }
  ],
  next_steps: ["Step."],
  glossary: [
    { term: "Ki-67", definition: "d" },
    { term: "ki-67", definition: "duplicate" },
    { term: "ER", definition: "too short" }
  ],
  limits: ["Limit."],
  questions: ["Q1", "Q2"],
  questions_en: ["E1", "E2"],
  care_team_note: "Note."
};

test("decode sanitises output and recomputes lab flags", async () => {
  reply = () => geminiReply(DECODE_PAYLOAD);
  const response = await decode({ request: jsonRequest("/api/decode", { text: TEXT, language: "hi" }), env });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.findings.length, 1);
  assert.equal(data.findings[0].status, "unclear");
  assert.deepEqual(data.lab_values.map((item) => item.flag), ["outside_range", "no_range_given"]);
  assert.deepEqual(data.glossary.map((item) => item.term), ["Ki-67"]);
  assert.ok(!("overview_en" in data));
});

test("decode adds English fields only for bilingual non-English requests", async () => {
  reply = () => geminiReply(DECODE_PAYLOAD);
  let response = await decode({ request: jsonRequest("/api/decode", { text: TEXT, language: "hi", bilingual: true }), env });
  let data = await response.json();
  assert.equal(data.overview_en, "Overview in English.");
  assert.deepEqual(data.questions_en, ["E1", "E2"]);
  assert.ok(lastBody.generationConfig.responseSchema.properties.overview_en);

  response = await decode({ request: jsonRequest("/api/decode", { text: TEXT, language: "en", bilingual: true }), env });
  data = await response.json();
  assert.ok(!("overview_en" in data));
  assert.ok(!lastBody.generationConfig.responseSchema.properties.overview_en);
});

test("decode rejects short text, non-reports and missing configuration", async () => {
  reply = () => geminiReply(DECODE_PAYLOAD);
  let response = await decode({ request: jsonRequest("/api/decode", { text: "short" }), env });
  assert.equal(response.status, 400);

  reply = () => geminiReply({ ...DECODE_PAYLOAD, report_type: "not_a_report" });
  response = await decode({ request: jsonRequest("/api/decode", { text: TEXT }), env });
  assert.equal(response.status, 422);

  response = await decode({ request: jsonRequest("/api/decode", { text: TEXT }), env: {} });
  assert.equal(response.status, 500);
});

test("decode is blocked for other origins", async () => {
  reply = () => geminiReply(DECODE_PAYLOAD);
  const response = await decode({ request: jsonRequest("/api/decode", { text: TEXT }, { origin: "https://evil.test" }), env });
  assert.equal(response.status, 403);
});

test("compare returns neutral changes and requires both texts", async () => {
  reply = () =>
    geminiReply({
      overview: "Two reports.",
      changes: [
        { topic: "Size", earlier: "18 mm", later: "11 mm", change_type: "changed", explanation: "Different numbers.", status: "discuss" },
        { topic: "", earlier: "", later: "", change_type: "x", explanation: "", status: "x" }
      ],
      questions: ["Why?"],
      care_team_note: "Note."
    });
  let response = await compare({ request: jsonRequest("/api/compare", { text: TEXT, earlier: TEXT }), env });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.changes.length, 1);

  response = await compare({ request: jsonRequest("/api/compare", { text: TEXT }), env });
  assert.equal(response.status, 400);
});

test("learn works from a label and terms, and rejects empty input", async () => {
  reply = () =>
    geminiReply({
      family_note: "Relatives may ask their own doctors.",
      prevention_points: ["Avoid tobacco."],
      myths: [{ myth: "Contagious.", fact: "Not contagious." }, { myth: "", fact: "x" }],
      care_team_note: "Note."
    });
  let response = await learn({ request: jsonRequest("/api/learn", { report_type: "Breast biopsy", terms: ["Ki-67"] }), env });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.myths.length, 1);
  assert.ok(!lastBody.contents[0].parts[0].text.includes(TEXT));

  response = await learn({ request: jsonRequest("/api/learn", {}), env });
  assert.equal(response.status, 400);
});

test("ask answers, redirects care-team questions and validates input", async () => {
  reply = (prompt) =>
    prompt.includes("will I be okay")
      ? geminiReply({ kind: "for_care_team", answer: "Ask your care team.", quote: "ignored", suggested_question: "What is my outlook?" })
      : geminiReply({ kind: "answered", answer: "It marks dividing cells.", quote: "Ki-67 approximately 18 percent", suggested_question: "dropped" });

  let response = await ask({
    request: jsonRequest("/api/ask", { text: TEXT, question: "What is Ki-67?", history: [{ q: "a", a: "b" }, { q: "", a: "x" }] }),
    env
  });
  let data = await response.json();
  assert.equal(data.kind, "answered");
  assert.equal(data.suggested_question, "");
  assert.ok(lastBody.contents[0].parts[0].text.includes("Question 1: a"));

  response = await ask({ request: jsonRequest("/api/ask", { text: TEXT, question: "will I be okay?" }), env });
  data = await response.json();
  assert.equal(data.kind, "for_care_team");
  assert.equal(data.quote, "");
  assert.equal(data.suggested_question, "What is my outlook?");

  response = await ask({ request: jsonRequest("/api/ask", { text: TEXT, question: "ab" }), env });
  assert.equal(response.status, 400);
  response = await ask({ request: jsonRequest("/api/ask", { text: "short", question: "What is it?" }), env });
  assert.equal(response.status, 400);
});

test("labels returns one translation per string and refuses English", async () => {
  const strings = ["Print", "Read aloud", "Ask:"];
  reply = () => geminiReply({ strings: strings.map((text) => text + "!") });
  let response = await labels({ request: jsonRequest("/api/labels", { language: "hi", strings }), env });
  let data = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(data.strings, ["Print!", "Read aloud!", "Ask:!"]);

  reply = () => geminiReply({ strings: ["only one"] });
  response = await labels({ request: jsonRequest("/api/labels", { language: "hi", strings }), env });
  assert.equal(response.status, 502);

  response = await labels({ request: jsonRequest("/api/labels", { language: "en", strings }), env });
  assert.equal(response.status, 400);
  response = await labels({ request: jsonRequest("/api/labels", { language: "hi", strings: [] }), env });
  assert.equal(response.status, 400);
});
