(function (root) {
  "use strict";

  var CHECKLIST = [
    "This report and any earlier reports or scans",
    "A list of your medicines and supplements",
    "Your ID and any insurance or health scheme card",
    "A family member or friend, if you would like support",
    "A notebook or the visit sheet, to write down the answers"
  ];

  var DISCLAIMER =
    "This is a plain-language explanation prepared with LabDecode. It is not medical advice and does not replace the care team.";

  function truncate(text, max) {
    var value = String(text || "").replace(/\s+/g, " ").trim();
    if (value.length <= max) return value;
    var cut = value.lastIndexOf(" ", max);
    if (cut < max * 0.5) cut = max;
    return value.slice(0, cut).trim() + "...";
  }

  function buildSummary(data, userQuestions, compare) {
    var lines = [];
    lines.push("Report summary from LabDecode");
    if (data.report_type) lines.push(data.report_type);
    lines.push("");
    if (data.overview) {
      lines.push(data.overview);
      lines.push("");
    }

    var flagged = data.findings.filter(function (item) {
      return item.status !== "plain";
    });
    if (flagged.length) {
      lines.push("Points to discuss with the care team:");
      flagged.slice(0, 6).forEach(function (item) {
        lines.push("- " + item.term + ": " + truncate(item.explanation, 220));
      });
      lines.push("");
    }

    if (compare && compare.changes && compare.changes.length) {
      var changed = compare.changes.filter(function (item) {
        return item.status !== "plain";
      });
      if (changed.length) {
        lines.push("Differences between the two reports:");
        changed.slice(0, 5).forEach(function (item) {
          lines.push("- " + item.topic + ": " + truncate(item.explanation, 200));
        });
        lines.push("");
      }
    }

    var questions = data.questions.concat(userQuestions || []);
    if (questions.length) {
      lines.push("Questions for the care team:");
      questions.forEach(function (question, index) {
        lines.push(index + 1 + ". " + question);
        if (data.questions_en && data.questions_en[index]) lines.push("   English: " + data.questions_en[index]);
      });
      lines.push("");
    }

    lines.push(DISCLAIMER);
    return lines.join("\n");
  }

  function pad(value) {
    return (value < 10 ? "0" : "") + value;
  }

  function localStamp(date) {
    return (
      date.getFullYear() +
      pad(date.getMonth() + 1) +
      pad(date.getDate()) +
      "T" +
      pad(date.getHours()) +
      pad(date.getMinutes()) +
      "00"
    );
  }

  function utcStamp(date) {
    return (
      date.getUTCFullYear() +
      pad(date.getUTCMonth() + 1) +
      pad(date.getUTCDate()) +
      "T" +
      pad(date.getUTCHours()) +
      pad(date.getUTCMinutes()) +
      pad(date.getUTCSeconds()) +
      "Z"
    );
  }

  function dayStamp(date) {
    return date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate());
  }

  function escapeText(value) {
    return String(value)
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
  }

  function fold(line) {
    var chars = Array.from(line);
    if (chars.length <= 60) return line;
    var parts = [];
    for (var i = 0; i < chars.length; i += 60) {
      parts.push(chars.slice(i, i + 60).join(""));
    }
    return parts.join("\r\n ");
  }

  function makeIcs(options) {
    var dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(options.date || "");
    if (!dateMatch) throw new Error("Choose a date for the reminder.");

    var year = parseInt(dateMatch[1], 10);
    var month = parseInt(dateMatch[2], 10) - 1;
    var day = parseInt(dateMatch[3], 10);
    var timeMatch = /^(\d{2}):(\d{2})$/.exec(options.time || "");
    var now = options.now || new Date();
    var uid = options.uid || String(now.getTime()) + "-" + Math.random().toString(16).slice(2) + "@labdecode";

    var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LabDecode//Reminder//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT"];
    lines.push("UID:" + uid);
    lines.push("DTSTAMP:" + utcStamp(now));

    if (timeMatch) {
      var start = new Date(year, month, day, parseInt(timeMatch[1], 10), parseInt(timeMatch[2], 10));
      var end = new Date(start.getTime() + 60 * 60 * 1000);
      lines.push("DTSTART:" + localStamp(start));
      lines.push("DTEND:" + localStamp(end));
    } else {
      lines.push("DTSTART;VALUE=DATE:" + dayStamp(new Date(year, month, day)));
      lines.push("DTEND;VALUE=DATE:" + dayStamp(new Date(year, month, day + 1)));
    }

    lines.push("SUMMARY:" + escapeText(options.title || "Appointment with care team"));
    if (options.description) lines.push("DESCRIPTION:" + escapeText(options.description));
    lines.push("BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", "DESCRIPTION:Appointment tomorrow", "END:VALARM");
    lines.push("END:VEVENT", "END:VCALENDAR");

    return lines.map(fold).join("\r\n") + "\r\n";
  }

  function download(filename, content, type) {
    var blob = new Blob([content], { type: type });
    var url = root.URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () {
      root.URL.revokeObjectURL(url);
    }, 4000);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === "string") node.textContent = text;
    return node;
  }

  function answerBox(lines) {
    var box = el("div", "visit-lines");
    for (var i = 0; i < lines; i += 1) box.appendChild(el("div", "visit-line"));
    return box;
  }

  function buildVisitSheet(data, userQuestions, compare, languageCode) {
    var sheet = el("div", "visit-inner");
    sheet.setAttribute("lang", languageCode || "en");

    sheet.appendChild(el("h2", "visit-title", "Visit sheet"));
    sheet.appendChild(
      el(
        "p",
        "visit-meta",
        (data.report_type ? data.report_type + ". " : "") + "Prepared with LabDecode on " + new Date().toLocaleDateString("en-GB") + "."
      )
    );

    var flagged = data.findings.filter(function (item) {
      return item.status !== "plain";
    });
    if (flagged.length) {
      sheet.appendChild(el("h3", "visit-h", "Findings to ask about"));
      var findingList = el("ul", "visit-list");
      flagged.slice(0, 8).forEach(function (item) {
        var li = el("li");
        li.appendChild(el("strong", "", item.term + ". "));
        li.appendChild(document.createTextNode(truncate(item.explanation, 200)));
        findingList.appendChild(li);
      });
      sheet.appendChild(findingList);
    }

    if (compare && compare.changes) {
      var changed = compare.changes.filter(function (item) {
        return item.status !== "plain";
      });
      if (changed.length) {
        sheet.appendChild(el("h3", "visit-h", "Differences between the two reports"));
        var changeList = el("ul", "visit-list");
        changed.slice(0, 6).forEach(function (item) {
          var li = el("li");
          li.appendChild(el("strong", "", item.topic + ". "));
          li.appendChild(document.createTextNode(truncate(item.explanation, 180)));
          changeList.appendChild(li);
        });
        sheet.appendChild(changeList);
      }
    }

    var questions = data.questions.concat(userQuestions || []);
    sheet.appendChild(el("h3", "visit-h", "My questions"));
    questions.forEach(function (question, index) {
      var item = el("div", "visit-question");
      var first = index < 3 && index < data.questions.length ? " (ask first)" : "";
      item.appendChild(el("p", "visit-q", index + 1 + ". " + question + first));
      if (data.questions_en && data.questions_en[index]) {
        var english = el("p", "visit-en", "English: " + data.questions_en[index]);
        english.setAttribute("lang", "en");
        item.appendChild(english);
      }
      item.appendChild(el("p", "visit-a-label", "Answer"));
      item.appendChild(answerBox(2));
      sheet.appendChild(item);
    });

    sheet.appendChild(el("h3", "visit-h", "Bring with you"));
    var checkList = el("ul", "visit-check");
    CHECKLIST.forEach(function (text) {
      var li = el("li");
      li.appendChild(el("span", "visit-box"));
      li.appendChild(document.createTextNode(text));
      checkList.appendChild(li);
    });
    sheet.appendChild(checkList);

    sheet.appendChild(el("h3", "visit-h", "Notes from the visit"));
    sheet.appendChild(answerBox(8));

    sheet.appendChild(el("h3", "visit-h", "Tests, referrals and next appointment"));
    sheet.appendChild(answerBox(4));

    sheet.appendChild(el("p", "visit-foot", DISCLAIMER));
    return sheet;
  }

  root.LabExport = {
    buildSummary: buildSummary,
    makeIcs: makeIcs,
    download: download,
    buildVisitSheet: buildVisitSheet,
    truncate: truncate,
    CHECKLIST: CHECKLIST
  };
})(typeof window !== "undefined" ? window : globalThis);
