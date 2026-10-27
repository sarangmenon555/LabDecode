(function () {
  "use strict";

  var MAX_CHARS = 12000;
  var MIN_CHARS = 40;
  var MAX_USER_QUESTIONS = 10;

  var STATUS_LABELS = {
    plain: "Straightforward",
    discuss: "Worth discussing",
    unclear: "Unclear: confirm with your care team"
  };

  var CHANGE_LABELS = {
    "new": "New in the later report",
    changed: "Changed",
    unchanged: "Unchanged",
    not_mentioned_now: "Not mentioned in the later report"
  };

  var FLAG_LABELS = {
    within_range: "Inside the printed range",
    outside_range: "Outside the printed range: ask your care team",
    no_range_given: "No range printed",
    cannot_tell: "Check against the printed range"
  };

  var DISCLAIMER_EN =
    "LabDecode explains the wording of a report. It does not diagnose, predict outcomes or recommend treatment, and it does not replace your doctor. Always confirm anything in this explanation with your care team.";

  var SAMPLE_REPORT = [
    "SURGICAL PATHOLOGY REPORT (SYNTHETIC SAMPLE - NOT A REAL PATIENT)",
    "Patient Name: Sample Patient",
    "Age: 54   Sex: F",
    "Specimen: Right breast, 10 o'clock, core needle biopsy.",
    "Final diagnosis: Invasive ductal carcinoma, Nottingham histologic grade 2 (tubule formation 3, nuclear pleomorphism 2, mitotic count 1; total score 6).",
    "Size of invasive focus in cores: 14 mm.",
    "Ductal carcinoma in situ: present, intermediate nuclear grade, cribriform pattern.",
    "Lymphovascular invasion: not identified.",
    "Immunohistochemistry: Estrogen receptor positive (95 percent of cells, strong). Progesterone receptor positive (60 percent, moderate). HER2 score 1+ (negative). Ki-67 proliferation index approximately 18 percent.",
    "Comment: Findings should be correlated with imaging. Axillary lymph node status cannot be assessed on this specimen."
  ].join("\n");

  var SAMPLE_OLDER = [
    "BREAST ULTRASOUND REPORT (SYNTHETIC SAMPLE - NOT A REAL PATIENT)",
    "Findings: Irregular hypoechoic mass in the right breast at 10 o'clock, 3 cm from the nipple, measuring 18 x 14 x 12 mm. No posterior acoustic shadowing.",
    "Right axilla: one lymph node with mildly thickened cortex, short axis 9 mm.",
    "Left breast: no suspicious mass.",
    "Impression: BI-RADS category 5, highly suggestive of malignancy."
  ].join("\n");

  var SAMPLE_NEWER = [
    "BREAST ULTRASOUND REPORT (SYNTHETIC SAMPLE - NOT A REAL PATIENT)",
    "Findings: Irregular hypoechoic mass in the right breast at 10 o'clock, 3 cm from the nipple, measuring 11 x 9 x 8 mm. A biopsy clip is seen within the mass.",
    "Right axilla: one lymph node with normal cortical thickness, short axis 6 mm.",
    "Left breast: no suspicious mass.",
    "Impression: BI-RADS category 6, known biopsy-proven malignancy."
  ].join("\n");

  var $ = function (id) {
    return document.getElementById(id);
  };

  var els = {
    report: $("report"),
    older: $("older"),
    compareDetails: $("compare-details"),
    count: $("report-count"),
    sample: $("sample"),
    samplePair: $("sample-pair"),
    language: $("language"),
    level: $("level"),
    decode: $("decode"),
    output: $("output"),
    empty: $("empty"),
    status: $("status"),
    results: $("results"),
    fileInput: $("file-input"),
    cameraInput: $("camera-input"),
    progressWrap: $("upload-progress"),
    progressBar: $("progress-bar"),
    progressLabel: $("progress-label"),
    uploadNote: $("upload-note"),
    redactToggle: $("redact-toggle"),
    redactNow: $("redact-now"),
    redactNote: $("redact-note"),
    visitSheet: $("visit-sheet"),
    demo: $("demo"),
    bilingualRow: $("bilingual-row"),
    bilingualToggle: $("bilingual-toggle"),
    addPage: $("add-page"),
    uiToggle: $("ui-toggle"),
    cancel: $("cancel")
  };

  var state = {
    data: null,
    compare: null,
    language: "en",
    userQuestions: [],
    reading: false,
    learn: null,
    demo: false,
    chat: [],
    sourceText: "",
    controller: null
  };

  var LANGUAGE_KEY = "labdecode-language";
  var ui = { lang: "", map: null };
  var MAX_ASKS = 8;
  var MAX_FILES = 8;
  var questionListEl = null;
  var appendNext = false;

  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === "string") node.textContent = text;
    return node;
  }

  function updateCount() {
    els.count.textContent = els.report.value.length.toLocaleString("en-US") + " / " + MAX_CHARS.toLocaleString("en-US");
  }

  function setStatus(message, isError) {
    if (!message) {
      els.status.hidden = true;
      els.status.textContent = "";
      els.status.className = "status";
      return;
    }
    els.status.hidden = false;
    els.status.textContent = message;
    els.status.className = isError ? "status error" : "status";
  }

  function setNote(node, message, isWarning) {
    if (!message) {
      node.hidden = true;
      node.textContent = "";
      node.className = "note";
      return;
    }
    node.hidden = false;
    node.textContent = message;
    node.className = isWarning ? "note warn" : "note";
  }

  function setBusy(busy, comparing) {
    els.cancel.hidden = !busy;
    els.decode.disabled = busy;
    els.decode.textContent = busy
      ? comparing
        ? "Reading and comparing..."
        : "Reading your report..."
      : "Explain this report";
    els.output.setAttribute("aria-busy", busy ? "true" : "false");
  }

  function mergeCounts(a, b) {
    var keys = ["labeled", "contact", "id", "date", "name"];
    var out = { counts: {}, total: 0 };
    keys.forEach(function (key) {
      out.counts[key] = (a.counts[key] || 0) + (b.counts[key] || 0);
      out.total += out.counts[key];
    });
    return out;
  }

  function describeRemoved(result) {
    var c = result.counts;
    var parts = [];
    if (c.labeled) parts.push(c.labeled + (c.labeled === 1 ? " labelled field" : " labelled fields"));
    if (c.contact) parts.push(c.contact + (c.contact === 1 ? " phone or email" : " phones or emails"));
    if (c.id) parts.push(c.id + (c.id === 1 ? " ID number" : " ID numbers"));
    if (c.date) parts.push(c.date + (c.date === 1 ? " date" : " dates"));
    if (c.name) parts.push(c.name + (c.name === 1 ? " name" : " names"));
    return parts.join(", ");
  }

  function applyRedaction(showNote) {
    var main = window.LabRedact.redact(els.report.value);
    var other = els.older.value.trim() ? window.LabRedact.redact(els.older.value) : { text: els.older.value, total: 0, counts: {} };

    if (main.total > 0) {
      els.report.value = main.text;
      updateCount();
    }
    if (other.total > 0) els.older.value = other.text;

    var merged = mergeCounts(main, other);
    if (showNote) {
      if (merged.total > 0) {
        setNote(
          els.redactNote,
          "Removed " + describeRemoved(merged) + ". Automatic removal can miss things, so read the text before you continue.",
          false
        );
      } else {
        setNote(els.redactNote, "No personal details were found automatically. Still read the text before you continue.", false);
      }
    }
    return merged;
  }

  function fillText(host, text) {
    window.LabGlossary.fill(host, text, state.data ? state.data.glossary : []);
  }

  function block(title) {
    var section = make("section", "block");
    var heading = make("h2", "", title);
    heading.setAttribute("lang", "en");
    section.appendChild(heading);
    return section;
  }

  function copyText(button, text) {
    var original = button.textContent;

    function done(ok) {
      button.textContent = ok ? "Copied" : "Copy failed";
      setTimeout(function () {
        button.textContent = original;
      }, 1800);
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () {
          done(true);
        },
        function () {
          done(false);
        }
      );
    } else {
      done(false);
    }
  }

  function allQuestions() {
    return state.data.questions.concat(state.userQuestions);
  }

  function summaryText() {
    return window.LabExport.buildSummary(state.data, state.userQuestions, state.compare);
  }

  function renderFinding(item) {
    var status = STATUS_LABELS[item.status] ? item.status : "unclear";
    var card = make("article", "finding " + status);
    card.setAttribute("data-status", status);

    var left = make("div", "as-written");
    left.appendChild(make("span", "col-label", "In your report"));
    var quote = make("p", "quote");
    fillText(quote, item.quote || item.term);
    left.appendChild(quote);

    var right = make("div", "in-words");
    right.appendChild(make("span", "badge", STATUS_LABELS[status]));
    right.appendChild(make("h3", "", item.term));
    var explanation = make("p", "explanation");
    fillText(explanation, item.explanation);
    right.appendChild(explanation);

    if (item.explanation_en) {
      var english = make("div", "english");
      english.setAttribute("lang", "en");
      var englishText = make("p");
      englishText.appendChild(make("strong", "", (item.term_en || item.term) + ": "));
      englishText.appendChild(document.createTextNode(item.explanation_en));
      english.appendChild(englishText);
      right.appendChild(english);
    }

    if (item.ask) {
      var ask = make("p", "ask");
      ask.appendChild(make("strong", "", "Ask: "));
      ask.appendChild(document.createTextNode(item.ask));
      right.appendChild(ask);
    }

    card.appendChild(left);
    card.appendChild(right);
    return card;
  }

  function renderFilters(findings, cards) {
    var counts = { plain: 0, discuss: 0, unclear: 0 };
    findings.forEach(function (item) {
      counts[STATUS_LABELS[item.status] ? item.status : "unclear"] += 1;
    });
    var kinds = ["plain", "discuss", "unclear"].filter(function (key) {
      return counts[key] > 0;
    });
    if (findings.length < 4 || kinds.length < 2) return null;

    var wrap = make("div", "filters");
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "Show findings");
    wrap.setAttribute("lang", "en");
    wrap.appendChild(make("span", "filter-label", "Show:"));

    var summary = make("p", "fineprint filter-summary");
    summary.setAttribute("role", "status");
    summary.hidden = true;

    var defs = [["all", "All", findings.length]];
    [["discuss", "Worth discussing"], ["unclear", "Unclear"], ["plain", "Straightforward"]].forEach(function (pair) {
      if (counts[pair[0]] > 0) defs.push([pair[0], pair[1], counts[pair[0]]]);
    });

    var buttons = defs.map(function (def) {
      var chip = make("button", "chip");
      chip.type = "button";
      chip.setAttribute("aria-pressed", def[0] === "all" ? "true" : "false");
      chip.appendChild(make("span", "", def[1]));
      chip.appendChild(make("span", "count", "(" + def[2] + ")"));
      chip.addEventListener("click", function () {
        var shown = 0;
        cards.forEach(function (card) {
          var visible = def[0] === "all" || card.getAttribute("data-status") === def[0];
          card.hidden = !visible;
          if (visible) shown += 1;
        });
        buttons.forEach(function (other) {
          other.setAttribute("aria-pressed", other === chip ? "true" : "false");
        });
        summary.hidden = def[0] === "all";
        summary.textContent = "Showing " + shown + " of " + cards.length + " findings.";
      });
      wrap.appendChild(chip);
      return chip;
    });

    var holder = make("div", "filter-holder");
    holder.appendChild(wrap);
    holder.appendChild(summary);
    return holder;
  }

  function renderValues(values) {
    var section = block("Numbers in your report");
    var wrap = make("div", "table-wrap");
    var table = make("table", "values");

    var caption = make("caption", "", "Status compares each result with the range printed in your report. It does not say what a result means for you.");
    caption.setAttribute("lang", "en");
    table.appendChild(caption);

    var head = make("thead");
    var headRow = make("tr");
    ["Test", "Result", "Printed range", "Status", "What it measures"].forEach(function (label) {
      var th = make("th", "", label);
      th.setAttribute("scope", "col");
      th.setAttribute("lang", "en");
      headRow.appendChild(th);
    });
    head.appendChild(headRow);
    table.appendChild(head);

    var body = make("tbody");
    values.forEach(function (item) {
      var row = make("tr");
      var name = make("th", "", item.name);
      name.setAttribute("scope", "row");
      row.appendChild(name);
      row.appendChild(make("td", "", item.value));
      row.appendChild(make("td", "", item.reference_range || "None"));
      var flagCell = make("td");
      var flag = make("span", "flag " + item.flag, FLAG_LABELS[item.flag] || FLAG_LABELS.cannot_tell);
      flag.setAttribute("lang", "en");
      flagCell.appendChild(flag);
      row.appendChild(flagCell);
      row.appendChild(make("td", "", item.meaning));
      body.appendChild(row);
    });
    table.appendChild(body);
    wrap.appendChild(table);
    section.appendChild(wrap);
    return section;
  }

  function renderCompare(compare) {
    var section = block("What changed between the two reports");
    if (compare.overview) section.appendChild(make("p", "", compare.overview));

    var note = make("p", "fineprint", "LabDecode describes what is written differently. It does not say whether a change is good or bad. Your care team does that.");
    note.setAttribute("lang", "en");
    section.appendChild(note);

    compare.changes.forEach(function (item) {
      var status = STATUS_LABELS[item.status] ? item.status : "unclear";
      var card = make("article", "change " + status);

      var head = make("div", "change-head");
      head.appendChild(make("h3", "", item.topic));
      var badge = make("span", "badge", CHANGE_LABELS[item.change_type] || CHANGE_LABELS.changed);
      badge.setAttribute("lang", "en");
      head.appendChild(badge);
      card.appendChild(head);

      var pair = make("div", "change-types");
      var earlier = make("p");
      earlier.appendChild(make("strong", "", "Earlier: "));
      earlier.appendChild(document.createTextNode(item.earlier || "Not mentioned"));
      var later = make("p");
      later.appendChild(make("strong", "", "Later: "));
      later.appendChild(document.createTextNode(item.later || "Not mentioned"));
      pair.appendChild(earlier);
      pair.appendChild(later);
      card.appendChild(pair);

      card.appendChild(make("p", "explanation", item.explanation));
      section.appendChild(card);
    });
    return section;
  }

  function renderNextSteps(steps) {
    var section = block("What often happens next");
    var note = make("p", "fineprint", "General information only. Your care team decides what applies to you.");
    note.setAttribute("lang", "en");
    section.appendChild(note);
    var list = make("ul", "plain-list");
    steps.forEach(function (text) {
      list.appendChild(make("li", "", text));
    });
    section.appendChild(list);
    return section;
  }

  function refreshQuestionList(list) {
    list.textContent = "";
    state.data.questions.forEach(function (text, index) {
      var base = make("li", "", text);
      if (index < 3) {
        var first = make("span", "first", "Ask first");
        first.setAttribute("lang", "en");
        base.appendChild(first);
      }
      if (state.data.questions_en && state.data.questions_en[index]) {
        var english = make("span", "q-english", "English: " + state.data.questions_en[index]);
        english.setAttribute("lang", "en");
        base.appendChild(english);
      }
      list.appendChild(base);
    });
    state.userQuestions.forEach(function (text, index) {
      var item = make("li");
      item.appendChild(document.createTextNode(text));
      var tag = make("span", "mine", "Added by you");
      tag.setAttribute("lang", "en");
      item.appendChild(tag);
      var remove = make("button", "text-button remove-q", "Remove");
      remove.type = "button";
      remove.setAttribute("lang", "en");
      remove.setAttribute("aria-label", "Remove your question: " + text);
      remove.addEventListener("click", function () {
        state.userQuestions.splice(index, 1);
        refreshQuestionList(list);
      });
      item.appendChild(remove);
      list.appendChild(item);
    });
  }

  function renderQuestions() {
    var section = block("Questions to ask your care team");
    var list = make("ol", "question-list");
    refreshQuestionList(list);
    questionListEl = list;
    section.appendChild(list);

    var hint = make("p", "fineprint", "The questions marked Ask first are the ones to raise first if time is short.");
    hint.setAttribute("lang", "en");
    section.appendChild(hint);

    var add = make("div", "add-question");
    add.setAttribute("lang", "en");
    var label = make("label", "", "Add your own question");
    label.setAttribute("for", "own-question");
    add.appendChild(label);

    var row = make("div", "add-row");
    var input = make("input");
    input.type = "text";
    input.id = "own-question";
    input.maxLength = 300;
    input.autocomplete = "off";
    row.appendChild(input);

    var addBtn = make("button", "secondary", "Add question");
    addBtn.type = "button";
    row.appendChild(addBtn);

    var dictateBtn = null;
    if (window.LabDictate.supported) {
      dictateBtn = make("button", "secondary", "Dictate");
      dictateBtn.type = "button";
      row.appendChild(dictateBtn);
    }
    add.appendChild(row);

    var local = make("p", "local-status");
    local.setAttribute("role", "status");
    local.hidden = true;
    add.appendChild(local);

    if (dictateBtn) {
      add.appendChild(
        make("p", "fineprint", "Dictation uses your browser's own speech service, which may process audio online. Typing keeps everything on your device.")
      );
    }

    function showLocal(message, isError) {
      local.hidden = !message;
      local.textContent = message || "";
      local.className = isError ? "local-status error" : "local-status";
    }

    function addQuestion() {
      var value = input.value.replace(/\s+/g, " ").trim();
      if (!value) {
        showLocal("Type a question first.", true);
        return;
      }
      if (state.userQuestions.length >= MAX_USER_QUESTIONS) {
        showLocal("You can add up to " + MAX_USER_QUESTIONS + " questions.", true);
        return;
      }
      state.userQuestions.push(value);
      input.value = "";
      showLocal("", false);
      refreshQuestionList(list);
      input.focus();
    }

    addBtn.addEventListener("click", addQuestion);
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        addQuestion();
      }
    });

    if (dictateBtn) {
      var listening = false;
      dictateBtn.addEventListener("click", function () {
        if (listening) {
          window.LabDictate.stop();
          return;
        }
        showLocal("", false);
        window.LabDictate.start(state.language, {
          start: function () {
            listening = true;
            dictateBtn.textContent = "Stop dictating";
            showLocal("Listening...", false);
          },
          end: function (transcript) {
            listening = false;
            dictateBtn.textContent = "Dictate";
            if (transcript) {
              input.value = transcript;
              showLocal("Check the question, then choose Add question.", false);
              input.focus();
            } else if (local.textContent === "Listening...") {
              showLocal("", false);
            }
          },
          error: function (message) {
            listening = false;
            dictateBtn.textContent = "Dictate";
            showLocal(message, true);
          }
        });
      });
    }

    section.appendChild(add);
    return section;
  }

  function renderLearnContent(container, learn) {
    container.textContent = "";

    if (learn.family_note) {
      container.appendChild(make("h3", "", "For your family"));
      container.appendChild(make("p", "", learn.family_note));
    }

    if (learn.prevention_points.length) {
      container.appendChild(make("h3", "", "Prevention and early detection, for everyone"));
      var list = make("ul", "plain-list");
      learn.prevention_points.forEach(function (text) {
        list.appendChild(make("li", "", text));
      });
      container.appendChild(list);
    }

    if (learn.myths.length) {
      container.appendChild(make("h3", "", "Common myths"));
      learn.myths.forEach(function (item) {
        var card = make("div", "myth");
        var myth = make("p");
        myth.appendChild(make("strong", "", "Myth: "));
        myth.appendChild(document.createTextNode(item.myth));
        var fact = make("p");
        fact.appendChild(make("strong", "", "Fact: "));
        fact.appendChild(document.createTextNode(item.fact));
        card.appendChild(myth);
        card.appendChild(fact);
        container.appendChild(card);
      });
    }

    if (learn.care_team_note) container.appendChild(make("p", "fineprint", learn.care_team_note));
  }

  function isValidLearn(data) {
    return data && Array.isArray(data.prevention_points) && Array.isArray(data.myths);
  }

  function renderLearn() {
    var section = block("Family, prevention and common myths");
    var body = make("div", "learn-body");

    if (state.learn) {
      renderLearnContent(body, state.learn);
      section.appendChild(body);
      return section;
    }

    var intro = make(
      "p",
      "fineprint",
      "General information about this type of report. It is not about you personally. Only the report type and key terms are sent to produce it, not your text."
    );
    intro.setAttribute("lang", "en");
    section.appendChild(intro);

    var button = make("button", "secondary", "Show family and prevention information");
    button.type = "button";
    button.id = "learn-button";
    button.setAttribute("lang", "en");
    section.appendChild(button);

    var local = make("p", "local-status");
    local.setAttribute("role", "status");
    local.hidden = true;
    section.appendChild(local);
    section.appendChild(body);

    button.addEventListener("click", function () {
      button.disabled = true;
      local.hidden = false;
      local.className = "local-status";
      local.textContent = "Preparing this information...";

      post("/api/learn", {
        report_type: state.data.report_type,
        terms: state.data.findings
          .map(function (item) {
            return item.term;
          })
          .slice(0, 12),
        language: state.language,
        level: els.level.value
      })
        .then(function (result) {
          if (!result.ok || !isValidLearn(result.data)) {
            local.className = "local-status error";
            local.textContent = (result.data && result.data.error) || "This information could not be produced. Try again.";
            button.disabled = false;
            return;
          }
          state.learn = result.data;
          local.hidden = true;
          button.hidden = true;
          renderLearnContent(body, state.learn);
        })
        .catch(function (error) {
          local.className = "local-status error";
          local.textContent = error && error.timeout ? "This is taking too long. Try again." : "The connection failed. Check your internet and try again.";
          button.disabled = false;
        });
    });

    return section;
  }

  var KIND_LABELS = {
    answered: "From your report",
    for_care_team: "A question for your care team",
    not_in_report: "Not in your report",
    off_topic: "Outside this report"
  };

  function isValidAnswer(data) {
    return data && typeof data.answer === "string" && typeof data.kind === "string";
  }

  function renderAnswer(question, data) {
    var kind = KIND_LABELS[data.kind] ? data.kind : "not_in_report";
    var card = make("article", "answer " + kind);

    var asked = make("p", "asked", question);
    card.appendChild(asked);

    var badge = make("span", "badge", KIND_LABELS[kind]);
    badge.setAttribute("lang", "en");
    card.appendChild(badge);
    card.appendChild(make("p", "", data.answer));

    if (data.quote) {
      var excerpt = make("p", "excerpt");
      var label = make("strong", "", "In your report: ");
      label.setAttribute("lang", "en");
      excerpt.appendChild(label);
      excerpt.appendChild(document.createTextNode(data.quote));
      card.appendChild(excerpt);
    }

    if (data.suggested_question) {
      var suggestion = make("p");
      var text = make("span", "", "Suggested question for your care team: " + data.suggested_question);
      suggestion.appendChild(text);
      card.appendChild(suggestion);

      var addBtn = make("button", "secondary", "Add to my questions");
      addBtn.type = "button";
      addBtn.setAttribute("lang", "en");
      addBtn.addEventListener("click", function () {
        if (state.userQuestions.length >= MAX_USER_QUESTIONS) {
          addBtn.textContent = "Question list is full";
          addBtn.disabled = true;
          return;
        }
        state.userQuestions.push(data.suggested_question);
        if (questionListEl) refreshQuestionList(questionListEl);
        addBtn.textContent = "Added";
        addBtn.disabled = true;
      });
      card.appendChild(addBtn);
    }

    return card;
  }

  function renderAsk() {
    var section = block("Ask about this report");

    var intro = make(
      "p",
      "fineprint",
      "Ask a follow-up about what the report says. Answers use only your report and general definitions. Questions about outlook or treatment are passed to your care team list. The report text is sent again to answer."
    );
    intro.setAttribute("lang", "en");
    section.appendChild(intro);

    var form = make("div", "chat-form");
    form.setAttribute("lang", "en");
    var label = make("label", "", "Your question");
    label.setAttribute("for", "ask-input");
    form.appendChild(label);

    var row = make("div", "add-row");
    var input = make("input");
    input.type = "text";
    input.id = "ask-input";
    input.maxLength = 300;
    input.autocomplete = "off";
    row.appendChild(input);
    var askBtn = make("button", "secondary", "Ask");
    askBtn.type = "button";
    row.appendChild(askBtn);
    form.appendChild(row);

    var local = make("p", "local-status");
    local.setAttribute("role", "status");
    local.hidden = true;
    form.appendChild(local);
    section.appendChild(form);

    var chat = make("div", "chat");
    chat.setAttribute("aria-live", "polite");
    section.appendChild(chat);

    function showLocal(message, isError) {
      local.hidden = !message;
      local.textContent = message || "";
      local.className = isError ? "local-status error" : "local-status";
    }

    function ask() {
      var question = input.value.replace(/\s+/g, " ").trim();
      if (question.length < 3) {
        showLocal("Type a question first.", true);
        return;
      }
      if (state.chat.length >= MAX_ASKS) {
        showLocal("You have reached the limit of " + MAX_ASKS + " questions for this report. Add the rest to your question list.", true);
        return;
      }
      if (!state.sourceText) {
        showLocal("There is no report text to answer from. Explain a report first.", true);
        return;
      }

      if (els.redactToggle.checked) question = window.LabRedact.redact(question).text;

      askBtn.disabled = true;
      showLocal("Reading your report to answer...", false);

      post("/api/ask", {
        text: state.sourceText,
        question: question,
        history: state.chat.slice(-3),
        language: state.language,
        level: els.level.value
      })
        .then(function (result) {
          if (!result.ok || !isValidAnswer(result.data)) {
            showLocal((result.data && result.data.error) || "No answer could be produced. Try again.", true);
            return;
          }
          state.chat.push({ q: question, a: result.data.answer });
          chat.appendChild(renderAnswer(question, result.data));
          input.value = "";
          showLocal("", false);
        })
        .catch(function (error) {
          showLocal(error && error.timeout ? "This is taking too long. Try again." : "The connection failed. Check your internet and try again.", true);
        })
        .then(function () {
          askBtn.disabled = false;
        });
    }

    askBtn.addEventListener("click", ask);
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        ask();
      }
    });

    return section;
  }

  function printExplanation() {
    document.body.classList.remove("print-visit");
    window.print();
  }

  function printVisitSheet() {
    els.visitSheet.textContent = "";
    els.visitSheet.appendChild(window.LabExport.buildVisitSheet(state.data, state.userQuestions, state.compare, state.language));
    document.body.classList.add("print-visit");
    window.print();
  }

  function renderTake() {
    var section = make("section", "take");
    section.setAttribute("lang", "en");
    section.appendChild(make("h2", "", "Take it with you"));

    var actions = make("div", "take-actions");

    var visitBtn = make("button", "secondary", "Print visit sheet");
    visitBtn.type = "button";
    visitBtn.addEventListener("click", printVisitSheet);
    actions.appendChild(visitBtn);

    var copySummaryBtn = make("button", "secondary", "Copy summary");
    copySummaryBtn.type = "button";
    copySummaryBtn.addEventListener("click", function () {
      copyText(copySummaryBtn, summaryText());
    });
    actions.appendChild(copySummaryBtn);

    var copyQBtn = make("button", "secondary", "Copy questions");
    copyQBtn.type = "button";
    copyQBtn.addEventListener("click", function () {
      var text = allQuestions()
        .map(function (q, i) {
          return i + 1 + ". " + q;
        })
        .join("\n");
      copyText(copyQBtn, text);
    });
    actions.appendChild(copyQBtn);

    if (navigator.share) {
      var shareBtn = make("button", "secondary", "Share with family");
      shareBtn.type = "button";
      shareBtn.addEventListener("click", function () {
        navigator.share({ title: "Report summary from LabDecode", text: summaryText() }).catch(function () {});
      });
      actions.appendChild(shareBtn);
    }

    var waBtn = make("button", "secondary", "Send by WhatsApp");
    waBtn.type = "button";
    waBtn.addEventListener("click", function () {
      var text = window.LabExport.truncate(summaryText(), 1500);
      window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener");
    });
    actions.appendChild(waBtn);

    section.appendChild(actions);
    section.appendChild(
      make("p", "fineprint", "Sharing sends the summary through the app you choose. LabDecode does not store it. Check it before you send it, because it describes a health report.")
    );

    section.appendChild(make("h3", "", "Before the appointment"));
    var checklist = make("ul", "checklist");
    window.LabExport.CHECKLIST.forEach(function (text, index) {
      var li = make("li");
      var box = make("input");
      box.type = "checkbox";
      box.id = "prep-" + index;
      var boxLabel = make("label", "", text);
      boxLabel.setAttribute("for", "prep-" + index);
      li.appendChild(box);
      li.appendChild(boxLabel);
      checklist.appendChild(li);
    });
    section.appendChild(checklist);

    section.appendChild(make("h3", "", "Add an appointment reminder to your calendar"));
    var form = make("div", "reminder");

    function field(labelText, id, type, value) {
      var wrap = make("div");
      var label = make("label", "", labelText);
      label.setAttribute("for", id);
      var input = make("input");
      input.type = type;
      input.id = id;
      if (value) input.value = value;
      wrap.appendChild(label);
      wrap.appendChild(input);
      return { wrap: wrap, input: input };
    }

    var title = field("Reminder title", "rem-title", "text", "Appointment with care team");
    var date = field("Date", "rem-date", "date", "");
    var time = field("Time (optional)", "rem-time", "time", "");
    var today = new Date();
    date.input.min = today.getFullYear() + "-" + ("0" + (today.getMonth() + 1)).slice(-2) + "-" + ("0" + today.getDate()).slice(-2);
    form.appendChild(title.wrap);
    form.appendChild(date.wrap);
    form.appendChild(time.wrap);

    var check = make("div", "check");
    var box = make("input");
    box.type = "checkbox";
    box.id = "rem-questions";
    var boxLabel = make("label", "", "Put my questions in the reminder. They will be stored in your calendar.");
    boxLabel.setAttribute("for", "rem-questions");
    check.appendChild(box);
    check.appendChild(boxLabel);
    form.appendChild(check);

    var makeBtn = make("button", "secondary", "Download reminder");
    makeBtn.type = "button";
    form.appendChild(makeBtn);
    section.appendChild(form);

    var local = make("p", "local-status");
    local.setAttribute("role", "status");
    local.hidden = true;
    section.appendChild(local);

    makeBtn.addEventListener("click", function () {
      var description = "Bring your questions and the LabDecode visit sheet.";
      if (box.checked) {
        description +=
          "\n\nQuestions:\n" +
          allQuestions()
            .map(function (q, i) {
              return i + 1 + ". " + q;
            })
            .join("\n");
      }
      try {
        var ics = window.LabExport.makeIcs({
          title: title.input.value.trim() || "Appointment with care team",
          date: date.input.value,
          time: time.input.value,
          description: description
        });
        window.LabExport.download("appointment-reminder.ics", ics, "text/calendar");
        local.hidden = false;
        local.className = "local-status";
        local.textContent = "Reminder downloaded. Open the file to add it to your calendar.";
      } catch (error) {
        local.hidden = false;
        local.className = "local-status error";
        local.textContent = error.message;
      }
    });

    return section;
  }

  function speechTexts() {
    var data = state.data;
    var texts = [];
    if (data.report_type) texts.push(data.report_type + ".");
    if (data.overview) texts.push(data.overview);
    data.findings.forEach(function (item) {
      texts.push(item.term + ". " + item.explanation);
    });
    if (state.compare) {
      if (state.compare.overview) texts.push(state.compare.overview);
      state.compare.changes.forEach(function (item) {
        texts.push(item.topic + ". " + item.explanation);
      });
    }
    data.next_steps.forEach(function (item) {
      texts.push(item);
    });
    data.limits.forEach(function (item) {
      texts.push(item);
    });
    allQuestions().forEach(function (item, index) {
      texts.push(index + 1 + ". " + item);
    });
    if (state.learn) {
      if (state.learn.family_note) texts.push(state.learn.family_note);
      state.learn.prevention_points.forEach(function (item) {
        texts.push(item);
      });
    }
    if (data.care_team_note) texts.push(data.care_team_note);
    return texts;
  }

  function toggleReading(button, pauseBtn) {
    function reset() {
      state.reading = false;
      button.textContent = "Read aloud";
      pauseBtn.hidden = true;
      pauseBtn.textContent = "Pause";
    }

    if (state.reading) {
      window.LabSpeech.stop();
      reset();
      return;
    }

    window.LabSpeech.speak(speechTexts(), state.language, {
      start: function () {
        state.reading = true;
        button.textContent = "Stop reading";
        pauseBtn.hidden = false;
        pauseBtn.textContent = "Pause";
      },
      end: reset,
      error: function (message) {
        reset();
        setStatus(message, true);
      }
    });
  }

  function render(options) {
    var removedSummary = options.removed || "";
    var compareProblem = options.compareProblem || "";
    var data = state.data;
    window.LabSpeech.stop();
    state.reading = false;
    els.results.textContent = "";
    els.results.setAttribute("lang", state.language);

    var head = make("div", "result-head");
    head.appendChild(make("h2", "", data.report_type || "Your report explained"));

    var actions = make("div", "result-actions");
    if (window.LabSpeech.supported) {
      var readBtn = make("button", "secondary", "Read aloud");
      readBtn.type = "button";
      readBtn.setAttribute("lang", "en");

      var pauseBtn = make("button", "secondary", "Pause");
      pauseBtn.type = "button";
      pauseBtn.hidden = true;
      pauseBtn.setAttribute("lang", "en");
      pauseBtn.addEventListener("click", function () {
        if (window.LabSpeech.isPaused()) {
          window.LabSpeech.resume();
          pauseBtn.textContent = "Pause";
        } else if (window.LabSpeech.pause()) {
          pauseBtn.textContent = "Resume";
        }
      });

      readBtn.addEventListener("click", function () {
        toggleReading(readBtn, pauseBtn);
      });

      var speed = make("span", "speed");
      speed.setAttribute("lang", "en");
      var speedLabel = make("label", "", "Speed");
      speedLabel.setAttribute("for", "speed-select");
      var speedSelect = make("select");
      speedSelect.id = "speed-select";
      [["0.75", "Slow"], ["0.92", "Normal"], ["1.1", "Fast"]].forEach(function (pair) {
        var option = make("option", "", pair[1]);
        option.value = pair[0];
        if (pair[0] === "0.92") option.selected = true;
        speedSelect.appendChild(option);
      });
      speedSelect.addEventListener("change", function () {
        window.LabSpeech.setRate(speedSelect.value);
      });
      speed.appendChild(speedLabel);
      speed.appendChild(speedSelect);

      actions.appendChild(readBtn);
      actions.appendChild(pauseBtn);
      actions.appendChild(speed);
    }
    var printBtn = make("button", "secondary", "Print");
    printBtn.type = "button";
    printBtn.setAttribute("lang", "en");
    printBtn.addEventListener("click", printExplanation);
    actions.appendChild(printBtn);
    head.appendChild(actions);
    els.results.appendChild(head);

    if (options.banner) {
      els.results.appendChild(make("p", "note sent-note", options.banner));
    }
    if (removedSummary) {
      els.results.appendChild(make("p", "note sent-note", "Before sending, LabDecode removed " + removedSummary + "."));
    }
    if (compareProblem) {
      var warn = make("p", "note warn sent-note", "The comparison could not be produced: " + compareProblem);
      els.results.appendChild(warn);
    }

    els.results.appendChild(
      make("p", "print-only", "Prepared with LabDecode on " + new Date().toLocaleDateString("en-GB") + ". " + DISCLAIMER_EN)
    );

    if (data.overview) {
      var overview = block("In brief");
      var overviewText = make("p");
      fillText(overviewText, data.overview);
      overview.appendChild(overviewText);
      if (data.overview_en) {
        var overviewEnglish = make("div", "english");
        overviewEnglish.setAttribute("lang", "en");
        overviewEnglish.appendChild(make("p", "", data.overview_en));
        overview.appendChild(overviewEnglish);
      }
      els.results.appendChild(overview);
    }

    var findings = make("section", "findings");
    var findingsHead = make("h2", "", "Finding by finding");
    findingsHead.style.margin = "0 0 0.8rem";
    findings.appendChild(findingsHead);
    var cards = data.findings.map(function (item) {
      return renderFinding(item);
    });
    var filters = renderFilters(data.findings, cards);
    if (filters) findings.appendChild(filters);
    cards.forEach(function (card) {
      findings.appendChild(card);
    });
    els.results.appendChild(findings);

    if (data.lab_values.length) els.results.appendChild(renderValues(data.lab_values));
    if (state.compare) els.results.appendChild(renderCompare(state.compare));
    if (data.next_steps.length) els.results.appendChild(renderNextSteps(data.next_steps));

    if (data.limits.length) {
      var limits = block("What this report does not tell you");
      var limitList = make("ul", "plain-list");
      data.limits.forEach(function (text) {
        limitList.appendChild(make("li", "", text));
      });
      limits.appendChild(limitList);
      els.results.appendChild(limits);
    }

    els.results.appendChild(renderQuestions());
    els.results.appendChild(renderAsk());
    els.results.appendChild(renderLearn());
    els.results.appendChild(renderTake());

    var disclaimer = make("div", "disclaimer");
    disclaimer.setAttribute("lang", "en");
    disclaimer.appendChild(make("p", "", DISCLAIMER_EN));
    if (data.care_team_note) {
      var note = make("p", "", data.care_team_note);
      note.setAttribute("lang", state.language);
      disclaimer.appendChild(note);
    }
    els.results.appendChild(disclaimer);

    els.empty.hidden = true;
    els.results.hidden = false;
  }

  function isValidDecode(data) {
    return (
      data &&
      Array.isArray(data.findings) &&
      Array.isArray(data.questions) &&
      Array.isArray(data.limits) &&
      Array.isArray(data.lab_values) &&
      Array.isArray(data.next_steps) &&
      Array.isArray(data.glossary)
    );
  }

  function isValidCompare(data) {
    return data && Array.isArray(data.changes) && Array.isArray(data.questions);
  }

  var REQUEST_TIMEOUT_MS = 75000;
  var RETRYABLE = [0, 429, 502, 503, 504];

  function post(url, body, parent) {
    var controller = new AbortController();
    var timedOut = false;
    var timer = setTimeout(function () {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    function onParentAbort() {
      controller.abort();
    }
    if (parent) {
      if (parent.aborted) controller.abort();
      else parent.addEventListener("abort", onParentAbort);
    }
    function finish() {
      clearTimeout(timer);
      if (parent) parent.removeEventListener("abort", onParentAbort);
    }

    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    }).then(
      function (response) {
        return response
          .json()
          .catch(function () {
            return {};
          })
          .then(function (data) {
            finish();
            return { ok: response.ok, status: response.status, data: data };
          });
      },
      function () {
        finish();
        var failure = new Error(timedOut ? "timeout" : "network");
        failure.timeout = timedOut;
        failure.cancelled = !timedOut && controller.signal.aborted;
        throw failure;
      }
    );
  }

  function showFailure(message, retryable) {
    setStatus(message, true);
    if (retryable) {
      var button = make("button", "secondary retry", "Try again");
      button.type = "button";
      button.id = "retry";
      button.addEventListener("click", decode);
      els.status.appendChild(button);
    }
  }

  function decode() {
    var text = els.report.value.trim();
    var older = els.older.value.trim();

    if (text.length < MIN_CHARS) {
      setStatus("Paste more of the report. The text is too short to explain.", true);
      return;
    }
    if (older && older.length < MIN_CHARS) {
      setStatus("The earlier report is too short to compare. Paste more of it or clear the box.", true);
      return;
    }

    var removedSummary = "";
    if (els.redactToggle.checked) {
      var merged = applyRedaction(false);
      if (merged.total > 0) removedSummary = describeRemoved(merged);
      text = els.report.value.trim();
      older = els.older.value.trim();
    }

    var language = els.language.value;
    var level = els.level.value;
    var comparing = older.length >= MIN_CHARS;

    window.LabSpeech.stop();
    window.LabDictate.stop();
    state.reading = false;
    setBusy(true, comparing);
    els.empty.hidden = true;
    if (!els.results.hidden) els.results.classList.add("stale");
    setStatus(comparing ? "Reading both reports. This takes a little longer." : "Reading your report. This takes a few seconds.", false);

    var controller = new AbortController();
    state.controller = controller;
    var slowTimer = setTimeout(function () {
      if (state.controller === controller) setStatus("Still working. The service can be slow when it is busy.", false);
    }, 15000);

    var bilingual = els.bilingualToggle.checked && language !== "en";
    var decodeRequest = post("/api/decode", { text: text, language: language, level: level, bilingual: bilingual }, controller.signal);
    var compareRequest = comparing
      ? post("/api/compare", { text: text, earlier: older, language: language, level: level }, controller.signal).catch(function (error) {
          if (error && error.cancelled) throw error;
          return { ok: false, status: 0, data: { error: "The connection failed." } };
        })
      : Promise.resolve(null);

    Promise.all([decodeRequest, compareRequest])
      .then(function (results) {
        var main = results[0];
        var other = results[1];

        if (!main.ok) {
          showFailure(main.data.error || "Something went wrong. Try again.", RETRYABLE.indexOf(main.status) !== -1);
          return;
        }
        if (!isValidDecode(main.data)) {
          showFailure("The explanation came back incomplete. Try again.", true);
          return;
        }

        var compare = null;
        var compareProblem = "";
        if (other) {
          if (other.ok && isValidCompare(other.data)) {
            compare = other.data;
          } else {
            compareProblem = (other.data && other.data.error) || "Try again.";
          }
        }

        var questions = main.data.questions.slice();
        if (compare) {
          compare.questions.forEach(function (question) {
            if (questions.indexOf(question) === -1) questions.push(question);
          });
        }

        state.data = main.data;
        state.data.questions = questions;
        state.compare = compare;
        state.language = language;
        state.userQuestions = [];
        state.learn = null;
        state.demo = false;
        state.chat = [];
        state.sourceText = text;

        setStatus("");
        render({ removed: removedSummary, compareProblem: compareProblem });
        els.results.scrollIntoView({ behavior: "smooth", block: "start" });
      })
      .catch(function (error) {
        if (error && error.cancelled) {
          setStatus("Cancelled. Your text is still in the box.", false);
        } else if (error && error.timeout) {
          showFailure("This is taking too long. Try again.", true);
        } else {
          showFailure("The connection failed. Check your internet and try again.", true);
        }
      })
      .then(function () {
        clearTimeout(slowTimer);
        if (state.controller === controller) state.controller = null;
        els.results.classList.remove("stale");
        setBusy(false, false);
      });
  }

  function loadDemo() {
    window.LabSpeech.stop();
    window.LabDictate.stop();
    setStatus("");

    fetch("demo.json")
      .then(function (response) {
        if (!response.ok) throw new Error("missing");
        return response.json();
      })
      .then(function (demo) {
        if (!demo || !isValidDecode(demo.decode) || !isValidLearn(demo.learn)) throw new Error("invalid");

        els.report.value = SAMPLE_REPORT;
        els.older.value = "";
        updateCount();
        setNote(els.uploadNote, "", false);
        setNote(els.redactNote, "", false);
        els.language.value = "en";
        els.bilingualRow.hidden = true;
        applyInterfaceLanguage("en");

        state.data = demo.decode;
        state.compare = null;
        state.language = "en";
        state.userQuestions = [];
        state.learn = demo.learn;
        state.demo = true;
        state.chat = [];
        state.sourceText = SAMPLE_REPORT;

        render({ banner: "Ready-made example in English, built from a synthetic report. Nothing was sent anywhere." });
        els.empty.hidden = true;
        els.results.hidden = false;
        els.results.scrollIntoView({ behavior: "smooth", block: "start" });
      })
      .catch(function () {
        setStatus("The example could not be loaded. Check your connection and try again.", true);
      });
  }

  function applyInterfaceLanguage(language) {
    if (language === "en") {
      window.LabI18n.disable();
      ui.lang = "";
      ui.map = null;
      els.uiToggle.hidden = true;
      return;
    }

    els.language.disabled = true;
    window.LabI18n.load(language).then(function (map) {
      els.language.disabled = false;
      if (els.language.value !== language) return;
      if (!map) {
        window.LabI18n.disable();
        els.uiToggle.hidden = true;
        return;
      }
      ui.lang = language;
      ui.map = map;
      window.LabI18n.enable(language, map);
      els.uiToggle.hidden = false;
      els.uiToggle.textContent = "Show interface in English";
    });
  }

  function rememberLanguage(language) {
    try {
      window.localStorage.setItem(LANGUAGE_KEY, language);
    } catch (error) {
      return;
    }
  }

  function setProgress(label, fraction) {
    els.progressWrap.hidden = false;
    els.progressLabel.textContent = label;
    if (fraction === null || typeof fraction !== "number") {
      els.progressBar.removeAttribute("value");
    } else {
      els.progressBar.value = Math.max(0, Math.min(100, Math.round(fraction * 100)));
    }
  }

  function handleFiles(input) {
    var files = Array.prototype.slice.call(input.files || [], 0, MAX_FILES);
    var append = appendNext;
    appendNext = false;
    input.value = "";
    if (!files.length) return;

    setNote(els.uploadNote, "", false);
    setNote(els.redactNote, "", false);
    els.decode.disabled = true;
    els.addPage.hidden = true;
    setProgress("Preparing the text reader", null);

    var texts = [];
    var notices = [];
    var failure = "";
    var lowest = null;
    var unsure = [];

    function progressFor(index) {
      return function (label, fraction) {
        var prefix = files.length > 1 ? "File " + (index + 1) + " of " + files.length + ". " : "";
        var overall = typeof fraction === "number" ? (index + fraction) / files.length : null;
        setProgress(prefix + label, overall);
      };
    }

    var chain = Promise.resolve();
    files.forEach(function (file, index) {
      chain = chain.then(function () {
        if (failure) return null;
        return window.LabOCR.extract(file, progressFor(index)).then(
          function (result) {
            texts.push(result.text);
            if (result.notice) notices.push(result.notice);
            if (typeof result.confidence === "number") lowest = lowest === null ? result.confidence : Math.min(lowest, result.confidence);
            (result.uncertain || []).forEach(function (item) {
              if (unsure.length < 15) unsure.push(item.text);
            });
          },
          function (error) {
            failure = (error && error.message) || "The file could not be read. Paste the text instead.";
            if (files.length > 1) failure = "File " + (index + 1) + " of " + files.length + " could not be read. " + failure;
          }
        );
      });
    });

    chain
      .then(function () {
        if (!texts.length) {
          setNote(els.uploadNote, failure || "The file could not be read. Paste the text instead.", true);
          return;
        }

        var joined = texts.join("\n\n");
        if (append && els.report.value.trim()) joined = els.report.value.trim() + "\n\n" + joined;
        if (joined.length > MAX_CHARS) {
          joined = joined.slice(0, MAX_CHARS);
          notices.push("The text was cut to 12,000 characters.");
        }
        els.report.value = joined;
        updateCount();

        var message = "Text read from your " + (texts.length > 1 ? "files" : "file") + ". Check it against the original, because photos can be misread.";
        if (notices.length) message += " " + notices.join(" ");
        if (failure) message += " " + failure;
        var shaky = lowest !== null && lowest < 75;
        if (shaky) {
          message += " The photo was hard to read. Retake it flat, straight and in good light, and check every number.";
        }
        if (unsure.length) {
          message += " Words and numbers the reader was unsure about: " + unsure.join(", ") + ".";
        }
        setNote(els.uploadNote, message, !!failure || shaky || unsure.length > 0);

        if (els.redactToggle.checked) applyRedaction(true);
        els.addPage.hidden = false;
        els.report.focus();
      })
      .then(function () {
        els.progressWrap.hidden = true;
        els.decode.disabled = false;
      });
  }

  els.report.addEventListener("input", function () {
    appendNext = false;
    updateCount();
  });
  els.sample.addEventListener("click", function () {
    els.report.value = SAMPLE_REPORT;
    updateCount();
    setNote(els.uploadNote, "", false);
    setNote(els.redactNote, "", false);
    els.report.focus();
  });
  els.samplePair.addEventListener("click", function () {
    els.older.value = SAMPLE_OLDER;
    els.report.value = SAMPLE_NEWER;
    updateCount();
    setNote(els.uploadNote, "", false);
    setNote(els.redactNote, "", false);
    els.report.focus();
  });
  els.redactNow.addEventListener("click", function () {
    applyRedaction(true);
  });
  els.fileInput.addEventListener("change", function () {
    handleFiles(els.fileInput);
  });
  els.cameraInput.addEventListener("change", function () {
    handleFiles(els.cameraInput);
  });
  els.addPage.addEventListener("click", function () {
    appendNext = true;
    els.fileInput.click();
  });
  els.language.addEventListener("change", function () {
    els.bilingualRow.hidden = els.language.value === "en";
    rememberLanguage(els.language.value);
    applyInterfaceLanguage(els.language.value);
  });
  els.uiToggle.addEventListener("click", function () {
    if (window.LabI18n.active()) {
      window.LabI18n.disable();
      els.uiToggle.textContent = "Use translated interface";
    } else if (ui.map) {
      window.LabI18n.enable(ui.lang, ui.map);
      els.uiToggle.textContent = "Show interface in English";
    }
  });
  els.decode.addEventListener("click", decode);
  els.cancel.addEventListener("click", function () {
    if (state.controller) state.controller.abort();
  });
  els.demo.addEventListener("click", loadDemo);

  updateCount();

  (function restoreLanguage() {
    var saved = null;
    try {
      saved = window.localStorage.getItem(LANGUAGE_KEY);
    } catch (error) {
      saved = null;
    }
    if (!saved || saved === "en") return;
    var known = Array.prototype.some.call(els.language.options, function (option) {
      return option.value === saved;
    });
    if (!known) return;
    els.language.value = saved;
    els.bilingualRow.hidden = false;
    applyInterfaceLanguage(saved);
  })();

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
})();
