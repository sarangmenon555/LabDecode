# LabDecode

Plain-language explanations of cancer pathology and imaging reports, with questions to ask the care team.

## Structure

Page
- index.html, styles.css, app.js: the page and its logic
- display.js: text size, theme (auto, light, dark) and high contrast settings (stored on the device)
- imageprep.js: clean-up of photos before reading (flattens shadows, removes noise)
- lookup.js: offline search of 49 common medical terms
- locales.js: fixed translations of the safety-critical interface texts in ten languages
- i18n.js: translates the page and result labels into the chosen language (cached in the browser)
- about.html: how it works, what is sent where, privacy and safety
- manifest.webmanifest and icons/: installable app on phones
- sw.js: service worker; the page and the ready-made example load without a connection after the first visit
- demo.json: prebuilt result for the synthetic sample report

On-device modules
- redact.js: removes personal details before text is sent
- ocr.js: reads photos and PDFs (Tesseract.js and PDF.js, self-hosted in vendor/)
- speech.js: read-aloud through the browser's built-in voices
- dictate.js: dictation of the user's own questions (browser speech service)
- glossary.js: tap-to-define terms
- export.js: summary text, printable visit sheet, calendar reminder

Server (Cloudflare Pages Functions)
- functions/api/decode.js: explains one report through Gemini
- functions/api/compare.js: describes differences between an earlier and a later report
- functions/api/ask.js: answers one follow-up question from the report text and general definitions; outlook and treatment questions are redirected to the care team
- functions/api/labels.js: translates the fixed interface texts into the chosen language (no report content is sent)
- functions/api/learn.js: general family, prevention and myth information from the report type and key terms only
- lib/gemini.js: Gemini call and input checks
- lib/labs.js: lab value status computed from the range printed in the report
- lib/scriptcheck.js: script, marker word and number checks used by tests and the verifier
- scripts/verify-languages.mjs: live check of Gemini output in every language
- lib/guard.js: request size, origin and per-connection rate checks
- scripts/build.mjs: copies only the website files into dist/ for publishing
- 404.html: page shown for missing addresses
- _headers: security headers and caching

## Tests

npm test runs 122 checks with no dependencies (Node 20 or newer): redaction, lab range logic, request guard, calendar and summary export, term lookup, translation string coverage and all server endpoints against a mocked Gemini. The same command runs in GitHub Actions.

## Documents

- COMMANDS.md: install, run, test, build, deploy and maintenance commands
- DEPLOY.md: deployment and pre-submission checklist
- DEMO.md: demo script and answers to likely questions

## Commands

COMMANDS.md lists every command: installing Node, running locally (npm run dev), testing (npm test), building (npm run build), deploying (npm run deploy or Git), reading logs (npm run logs), and the language and photo checks. Copy .dev.vars.example to .dev.vars and add your key for local runs.

## Languages

Explanations and the translated interface are available in ten Indian languages: Assamese, Bengali, Gujarati, Hindi, Kannada, Malayalam, Marathi, Odia, Tamil and Telugu, plus English. Each Indian language is shown in its own script in the picker. Odia and Assamese are marked beta because they are the least reliable. Read-aloud and dictation depend on the voices and speech support of the device, and Odia and Assamese voices are often missing. Photo and PDF reading supports English text only. The server list in lib/gemini.js, the picker in index.html and the speech maps in speech.js and dictate.js must stay in sync; a test checks this.

## Reliability

The server waits up to 28 seconds per attempt and retries overloaded, rate-limited, cut-off and empty replies (up to three tries, within a 58 second limit). If GEMINI_FALLBACK_MODEL is set, it then tries that model, which also covers a mistyped GEMINI_MODEL. Errors say what happened (busy, too slow, rate limited, not configured) and the details go to the server log. In the page, a Cancel button appears while a report is being read, a slow request shows a notice after 15 seconds and stops after 75, a Try again button appears for errors that can pass, and the previous explanation stays on screen, dimmed, until the new one arrives.

## Photo reading

Photos are cleaned up before reading: shadows and uneven light are flattened and noise is reduced. If the reader is under 85% confident, the original photo is read as well and the better result is kept. Words and numbers the reader was unsure about are listed so the user can check them, and a hard-to-read photo gets a warning. Measured on made-up test photos, character errors fell from 3.9% to 0.1% on one set and from 31.2% to 6.7% on another (see tools/ocr-eval/README.md). Real phone photos will differ.

## Personal details

Removal of personal details is pattern based. It covers labelled fields in many layouts (two columns per line, all capitals, "S/o" and "W/o" forms, "Ref. by", "Pt Name"), titles such as Dr, Mrs, Smt and Shri, phone numbers, web addresses, dates, ID numbers, multi-line addresses and institution names in the first lines. Measured on made-up Indian-style report headers: on the 14 cases the rules were written against, 0 of 64 identifiers leaked (53% with the previous rules). On 9 cases written afterwards, 5 of 29 leaked on the first run (17%, against 41% with the previous rules), and 3 of 29 (10%) after two labels were added. None of the 42 clinical phrases in either set was removed, including label-like traps such as "Name of procedure:". The remaining misses are names that have no label or title, such as "Report for ANITHA JOSEPH", and unusual labels. The page always tells the user to read the text before sending it. The cases are in tests/fixtures/ and run with npm test.

## Code hygiene

Code files contain no comments, emoji or icon characters, and tests/hygiene.test.mjs fails if one is added. Third-party code in vendor/ keeps its own licence notices and is excluded. icons/ holds the image files used when the site is added to a phone's home screen.

## Accessibility

Contrast is tested in all three themes (text 4.5:1, field borders and focus rings 3:1). The axe checker found no structural problems on the main page with results showing, or on the About page, in a simulated browser. That does not replace testing with a screen reader and keyboard on real devices.

## Language verification

Nineteen texts that carry safety wording (disclaimers, status labels, range notes, the privacy note) are fixed translations stored in locales.js, so they do not depend on live machine translation and work offline. Tests check that each one is in the right script, keeps its negations ("does not diagnose") and brand names, and covers the same set in all ten languages.

For the live Gemini output, run the verifier with your key:

GEMINI_API_KEY=your_key npm run verify:languages

It makes about 60 calls (add --quick for about 40, --lang=or,as for some languages, --delay=7000 to change the pause between calls). For each language it checks that explanations, questions, interface translations and care-team answers are in the native script; that quotes are word for word from the report; that outlook and treatment questions are redirected to the care team and the answers contain no numbers; that brand names and colons survive translation; and that no English prognosis words appear. It saves every output in verify-output/ so the wording itself can be read, and exits with an error if any check fails. The checker is tested with a mock model, including a deliberately misbehaving one.

## Privacy

LabDecode stores nothing, but report text is processed by Google's Gemini API. Google's terms say that on unpaid quota, including the free tier, submitted content may be used to improve its products and reviewed by people. On paid quota it is not used for that. Use synthetic text with a free key. A real deployment needs a paid account, a data protection review and legal advice. See about.html.

## Limits

- Apart from the fixed safety texts, the translated interface and the explanations are machine generated and have not been reviewed by native speakers. The fixed texts were prepared with AI assistance and checked by automated tests, not by native speakers. Copied and shared summaries stay in English.
- OCR reads English text only.
- Buttons and section labels stay in English; explanations follow the chosen language.
- Redaction is pattern-based and can miss personal details. The page tells users to check the text.
- The in-code rate limit is per server instance, so it is best-effort. Add a Cloudflare rate limiting rule as described in DEPLOY.md.
- Findings can be filtered by type when a report has four or more findings; printing always shows all of them.
- Comparing two reports makes two Gemini calls. Family information and each follow-up question are extra calls on request, and follow-ups are capped at 8 per report. All count toward the free-tier quota.
- The English side-by-side option makes the response longer and slower.
- The term lookup is English only and gives general definitions, not interpretations.
- Dark theme is not used together with high contrast.
- Use synthetic reports for demos. vendor/ holds third-party code under its own licenses.
