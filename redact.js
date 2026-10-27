(function (root) {
  "use strict";

  var NUMBER_SUFFIX = "(?:[ \\t]*(?:no|number|id|code)\\.?)";

  var PLAIN = [
    "patient(?:'s)?[ \\t]*name",
    "pt\\.?[ \\t]*name",
    "name[ \\t]*of[ \\t]*(?:the[ \\t]*)?patient",
    "relative(?:'s)?[ \\t]*name",
    "doctor[ \\t]*name",
    "name",
    "uhid[ \\t]*/[ \\t]*mr[ \\t]*no",
    "uhid",
    "mrn",
    "mob(?:ile)?",
    "phone",
    "tel",
    "contact",
    "emergency[ \\t]*contact",
    "email",
    "dob",
    "date[ \\t]*of[ \\t]*birth",
    "address",
    "addr\\.?",
    "city",
    "town",
    "village",
    "taluk",
    "district",
    "pin(?:[ \\t]*code)?",
    "pincode",
    "accession",
    "referred[ \\t]*by",
    "ref(?:erred|\\.)?[ \\t]*(?:by|doctor|dr)",
    "referring[ \\t]*(?:doctor|physician|clinician|dr)",
    "requested[ \\t]*by",
    "req\\.?[ \\t]*by",
    "collected[ \\t]*(?:at|by)",
    "sample[ \\t]*collected[ \\t]*(?:at|by)",
    "consultant",
    "doctor",
    "physician",
    "pathologist",
    "radiologist",
    "oncologist",
    "surgeon",
    "technologist",
    "reported[ \\t]*by",
    "signed[ \\t]*(?:out[ \\t]*)?by",
    "verified[ \\t]*by",
    "authori[sz]ed[ \\t]*by",
    "approved[ \\t]*by",
    "entered[ \\t]*by",
    "aadhaar",
    "aadhar",
    "passport",
    "insurance(?:[ \\t]*policy)?",
    "policy",
    "guardian",
    "father",
    "mother",
    "spouse",
    "husband",
    "wife",
    "next[ \\t]*of[ \\t]*kin",
    "hospital(?:[ \\t]*name)?",
    "clinic",
    "centre",
    "center",
    "barcode"
  ].join("|");

  var NUMBERED = [
    "patient",
    "sample",
    "specimen",
    "case",
    "visit",
    "order",
    "bill",
    "invoice",
    "receipt",
    "lab",
    "ip",
    "op",
    "mr",
    "reg(?:istration)?",
    "ref(?:erence)?",
    "hospital[ \\t]*reg(?:istration)?"
  ].join("|");

  var LABELED = new RegExp(
    "(^|[ ]{2,}|\\t)([ \\t]*)((?:" + PLAIN + ")" + NUMBER_SUFFIX + "?|(?:" + NUMBERED + ")" + "[ \\t]*(?:no|number|id|code)\\.?)" +
      "[ \\t]*[:\\-][ \\t]*(\\S[^\\t]*?)(?=[ ]{2,}|\\t|$)",
    "gim"
  );

  var PATIENT_LINE = /^([ \t]*(?:[Pp]atient|PATIENT|[Pp]t\.?|PT\.?)[ \t]*[:\-][ \t]*)(\S[^\t]*?)(?=[ ]{2,}|\t|$)/gm;
  var NAME_TOKEN = "(?:[A-Z][A-Za-z'.-]*|[SDWC]\\/o)";
  var NAME_ONLY = new RegExp("^" + NAME_TOKEN + "(?:[ \\t]+" + NAME_TOKEN + "){0,5}$");
  var SEX_WORDS = /^(?:Male|Female|Man|Woman|Boy|Girl|Child|Infant|Unknown|Transgender)$/;

  var INSTITUTION = /\b(?:hospital|clinic|laborator(?:y|ies)|diagnostics?|medical college|institute|research cent(?:re|er)|health ?care|nursing home|path ?labs?|labs?)\b/i;
  var DEPARTMENT = /^[ \t]*(?:department|dept|division|section|unit)\b/i;

  var MONTHS = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*";
  var TITLE = "(?:Dr|DR|Prof|PROF|Mr|MR|Mrs|MRS|Ms|MS|Miss|MISS|Smt|SMT|Shri|SHRI|Sri|SRI|Kumari|KUMARI|Master|MASTER)";
  var NAME_WORDS = "[A-Z][A-Za-z'.-]*(?:[ \\t]+[A-Z][A-Za-z'.-]*){0,3}";

  var PATTERNS = [
    { key: "contact", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, token: "[email removed]" },
    { key: "contact", re: /\b(?:https?:\/\/|www\.)[^\s,;)]+/gi, token: "[link removed]" },
    { key: "contact", re: /\+\d{1,3}[ -]?\(?\d{2,5}\)?[ -]?\d{3,5}[ -]?\d{3,5}/g, token: "[phone removed]" },
    { key: "contact", re: /\(?\b0\d{2,4}\)?[ -]\d{6,8}\b/g, token: "[phone removed]" },
    { key: "contact", re: /\b[6-9]\d{4}[ -]\d{5}\b/g, token: "[phone removed]" },
    { key: "id", re: /\b[A-Z]{5}\d{4}[A-Z]\b/g, token: "[id removed]" },
    { key: "id", re: /\b\d{9,}\b/g, token: "[id removed]" },
    { key: "date", re: /\b\d{1,2}[\/.-]\d{1,2}[\/.-](?:\d{4}|\d{2})\b/g, token: "[date removed]" },
    { key: "date", re: new RegExp("\\b\\d{1,2}(?:st|nd|rd|th)?[ -]" + MONTHS + "\\.?,?[ -]\\d{2,4}\\b", "gi"), token: "[date removed]" },
    { key: "date", re: new RegExp("\\b" + MONTHS + "\\.?[ ]\\d{1,2}(?:st|nd|rd|th)?,?[ ]\\d{4}\\b", "gi"), token: "[date removed]" },
    {
      key: "name",
      re: new RegExp("\\b(?:[SDWC]\\/[Oo]|(?:[Ss]on|[Dd]aughter|[Ww]ife|[Hh]usband|[Ff]ather|[Mm]other) of)\\.?:?[ \\t]+(?:" + TITLE + "\\.?[ \\t]+)?" + NAME_WORDS, "g"),
      token: "[name removed]"
    },
    {
      key: "name",
      re: new RegExp("\\b" + TITLE + "\\.?[ \\t]+" + NAME_WORDS, "g"),
      token: "[name removed]"
    }
  ];

  function maskAddresses(text, counts) {
    var lines = text.split("\n");
    var out = [];
    for (var i = 0; i < lines.length; i += 1) {
      var match = /^([ \t]*address[ \t]*[:\-][ \t]*)\S/i.exec(lines[i]);
      if (!match) {
        out.push(lines[i]);
        continue;
      }
      counts.labeled += 1;
      out.push(match[1] + "[removed]");
      var previous = lines[i];
      var taken = 0;
      while (taken < 3 && i + 1 < lines.length) {
        var next = lines[i + 1];
        var continues = /[,;][ \t]*$/.test(previous) || /\b[1-9]\d{5}\b/.test(next);
        if (!/\S/.test(next) || !continues || next.length > 90) break;
        previous = next;
        i += 1;
        taken += 1;
      }
    }
    return out.join("\n");
  }

  function maskHeader(text, counts) {
    var lines = text.split("\n");
    var seen = 0;
    for (var i = 0; i < lines.length && seen < 8; i += 1) {
      var line = lines[i];
      if (!/\S/.test(line)) continue;
      seen += 1;
      var words = line.trim().split(/\s+/).length;
      if (INSTITUTION.test(line) && !DEPARTMENT.test(line) && !/\d/.test(line) && !/:/.test(line) && words <= 10 && line.length <= 90) {
        counts.labeled += 1;
        lines[i] = "[institution removed]";
      }
    }
    return lines.join("\n");
  }

  function redact(input) {
    var counts = { labeled: 0, contact: 0, id: 0, date: 0, name: 0 };
    var text = typeof input === "string" ? input : "";

    text = maskAddresses(text, counts);

    text = text.replace(PATIENT_LINE, function (match, lead, value) {
      var trimmed = value.trim();
      if (trimmed === "[removed]" || /\d/.test(trimmed) || SEX_WORDS.test(trimmed) || !NAME_ONLY.test(trimmed)) return match;
      counts.labeled += 1;
      return lead + "[removed]";
    });

    text = text.replace(LABELED, function (match, lead, indent, label, value) {
      if (value.trim() === "[removed]") return match;
      counts.labeled += 1;
      return lead + indent + label + ": [removed]";
    });

    text = maskHeader(text, counts);

    PATTERNS.forEach(function (pattern) {
      text = text.replace(pattern.re, function () {
        counts[pattern.key] += 1;
        return pattern.token;
      });
    });

    var total = counts.labeled + counts.contact + counts.id + counts.date + counts.name;
    return { text: text, total: total, counts: counts };
  }

  var api = { redact: redact };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.LabRedact = api;
  }
})(typeof window !== "undefined" ? window : this);
