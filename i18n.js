(function (root) {
  "use strict";

  var STRINGS = [
    "Skip to the report box",
    "Your report, in plain words. Then the right questions for your care team.",
    "Text size",
    "Normal",
    "Large",
    "Larger",
    "Theme",
    "Auto",
    "Light",
    "Dark",
    "High contrast",
    "Show interface in English",
    "Use translated interface",
    "Your report",
    "Have a photo or PDF instead?",
    "Upload photo or PDF",
    "Take a photo",
    "The file is read on your device. It is never uploaded. Choose several photos at once for a report with more than one page.",
    "Add another page",
    "Or paste the text of a pathology or imaging report",
    "Use a sample report",
    "Check the text for anything personal before you continue.",
    "Remove personal details before sending",
    "Remove them now so I can check",
    "Compare with an earlier report",
    "Paste the earlier report",
    "Load a sample pair of reports",
    "The report above is treated as the newer one. Personal details are removed from both if the box above is ticked.",
    "Explain in",
    "Translations are machine generated. Odia and Assamese are marked beta because they are the least reliable. Ask a bilingual person to check anything important.",
    "Reading level",
    "Very simple",
    "Standard",
    "Also show English next to the translation, for talking with a doctor",
    "Explain this report",
    "Nothing is saved by LabDecode. Your text is sent once to Google's Gemini service to produce the explanation. On Google's free tier, submitted text can be used to improve its products and may be read by reviewers, so remove personal details first.",
    "What you will get",
    "Each finding set beside the exact words from your report",
    "A plain explanation, with anything uncertain marked for your care team",
    "A list of questions to bring to your appointment, ready to print",
    "See a ready-made example",
    "Uses a synthetic report. Works without an internet connection.",
    "How LabDecode works, privacy and safety",
    "LabDecode explains the wording of a report. It does not diagnose, predict outcomes or recommend treatment, and it does not replace your doctor.",
    "Reading your report. This takes a few seconds.",
    "Reading both reports. This takes a little longer.",
    "Reading your report...",
    "Cancel",
    "Try again",
    "Cancelled. Your text is still in the box.",
    "Still working. The service can be slow when it is busy.",
    "This is taking too long. Try again.",
    "Reading and comparing...",
    "Preparing the text reader",
    "Reading the text",
    "Something went wrong. Try again.",
    "The connection failed. Check your internet and try again.",
    "Type a question first.",
    "Straightforward",
    "Worth discussing",
    "Unclear: confirm with your care team",
    "Inside the printed range",
    "Outside the printed range: ask your care team",
    "No range printed",
    "Check against the printed range",
    "New in the later report",
    "Changed",
    "Unchanged",
    "Not mentioned in the later report",
    "From your report",
    "A question for your care team",
    "Not in your report",
    "Outside this report",
    "Your report explained",
    "Read aloud",
    "Stop reading",
    "Pause",
    "Resume",
    "Speed",
    "Slow",
    "Fast",
    "Print",
    "In brief",
    "Finding by finding",
    "Show:",
    "All",
    "Unclear",
    "In your report",
    "Ask:",
    "Numbers in your report",
    "Status compares each result with the range printed in your report. It does not say what a result means for you.",
    "Test",
    "Result",
    "Printed range",
    "Status",
    "What it measures",
    "None",
    "What changed between the two reports",
    "LabDecode describes what is written differently. It does not say whether a change is good or bad. Your care team does that.",
    "Earlier:",
    "Later:",
    "Not mentioned",
    "What often happens next",
    "General information only. Your care team decides what applies to you.",
    "What this report does not tell you",
    "Questions to ask your care team",
    "Added by you",
    "Ask first",
    "Remove",
    "The questions marked Ask first are the ones to raise first if time is short.",
    "Add your own question",
    "Add question",
    "Dictate",
    "Stop dictating",
    "Dictation uses your browser's own speech service, which may process audio online. Typing keeps everything on your device.",
    "Check the question, then choose Add question.",
    "Ask about this report",
    "Ask a follow-up about what the report says. Answers use only your report and general definitions. Questions about outlook or treatment are passed to your care team list. The report text is sent again to answer.",
    "Your question",
    "Ask",
    "In your report:",
    "Suggested question for your care team:",
    "Add to my questions",
    "Added",
    "Question list is full",
    "Family, prevention and common myths",
    "General information about this type of report. It is not about you personally. Only the report type and key terms are sent to produce it, not your text.",
    "Show family and prevention information",
    "For your family",
    "Prevention and early detection, for everyone",
    "Common myths",
    "Myth:",
    "Fact:",
    "Take it with you",
    "Print visit sheet",
    "Copy summary",
    "Copy questions",
    "Copied",
    "Copy failed",
    "Share with family",
    "Send by WhatsApp",
    "Sharing sends the summary through the app you choose. LabDecode does not store it. Check it before you send it, because it describes a health report.",
    "Before the appointment",
    "This report and any earlier reports or scans",
    "A list of your medicines and supplements",
    "Your ID and any insurance or health scheme card",
    "A family member or friend, if you would like support",
    "A notebook or the visit sheet, to write down the answers",
    "Add an appointment reminder to your calendar",
    "Reminder title",
    "Date",
    "Time (optional)",
    "Put my questions in the reminder. They will be stored in your calendar.",
    "Download reminder",
    "LabDecode explains the wording of a report. It does not diagnose, predict outcomes or recommend treatment, and it does not replace your doctor. Always confirm anything in this explanation with your care team.",
    "Visit sheet",
    "Findings to ask about",
    "Differences between the two reports",
    "My questions",
    "Answer",
    "Bring with you",
    "Notes from the visit",
    "Tests, referrals and next appointment",
    "This is a plain-language explanation prepared with LabDecode. It is not medical advice and does not replace the care team."
  ];

  var STORAGE_PREFIX = "labdecode-i18n-";
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1 };

  var memory = {};
  var observer = null;
  var activeLanguage = "";
  var activeMap = null;
  var changedText = [];
  var changedLang = [];

  function hash(text) {
    var value = 5381;
    for (var i = 0; i < text.length; i += 1) {
      value = ((value << 5) + value + text.charCodeAt(i)) | 0;
    }
    return (value >>> 0).toString(36);
  }

  var VERSION = hash(STRINGS.join("\n"));

  function storageKey(language) {
    return STORAGE_PREFIX + language + "-" + VERSION;
  }

  function readCache(language) {
    try {
      var raw = root.localStorage.getItem(storageKey(language));
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function writeCache(language, map) {
    try {
      root.localStorage.setItem(storageKey(language), JSON.stringify(map));
    } catch (error) {
      return;
    }
  }

  function buildMap(translated) {
    var map = {};
    STRINGS.forEach(function (source, index) {
      var value = translated[index];
      if (typeof value === "string" && value.trim() && value.trim() !== source) map[source] = value.trim();
    });
    return map;
  }

  function loadRuntime(language) {
    if (!language || language === "en") return Promise.resolve(null);
    if (memory[language]) return Promise.resolve(memory[language]);

    var cached = readCache(language);
    if (cached) {
      memory[language] = cached;
      return Promise.resolve(cached);
    }

    var controller = root.AbortController ? new root.AbortController() : null;
    var timer = controller
      ? setTimeout(function () {
          controller.abort();
        }, 25000)
      : null;

    return root
      .fetch("/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: language, strings: STRINGS }),
        signal: controller ? controller.signal : undefined
      })
      .then(function (response) {
        if (timer) clearTimeout(timer);
        if (!response.ok) return null;
        return response.json();
      })
      .then(function (data) {
        if (!data || !Array.isArray(data.strings) || data.strings.length !== STRINGS.length) return null;
        var map = buildMap(data.strings);
        memory[language] = map;
        writeCache(language, map);
        return map;
      })
      .catch(function () {
        if (timer) clearTimeout(timer);
        return null;
      });
  }

  function fixedTable(language) {
    return (root.LabLocales && root.LabLocales[language]) || null;
  }

  function load(language) {
    if (!language || language === "en") return Promise.resolve(null);
    return loadRuntime(language).then(function (runtime) {
      var fixed = fixedTable(language);
      if (!runtime && !fixed) return null;
      var merged = {};
      var key;
      if (runtime) {
        for (key in runtime) merged[key] = runtime[key];
      }
      if (fixed) {
        for (key in fixed) merged[key] = fixed[key];
      }
      return merged;
    });
  }

  function markLanguage(node) {
    var element = node.parentElement;
    while (element && !element.hasAttribute("lang")) element = element.parentElement;
    if (element && element.getAttribute("lang") === "en") {
      element.setAttribute("lang", activeLanguage);
      changedLang.push(element);
    }
  }

  function translateText(node) {
    if (!activeMap) return;
    var raw = node.nodeValue;
    if (!raw) return;
    var key = raw.replace(/\s+/g, " ").trim();
    if (!key) return;
    var translated = activeMap[key];
    if (!translated) return;

    var lead = raw.match(/^\s*/)[0];
    var trail = raw.match(/\s*$/)[0];
    changedText.push({ node: node, original: raw });
    node.nodeValue = lead + translated + trail;
    markLanguage(node);
  }

  function skipped(node) {
    var element = node.parentElement;
    if (!element) return true;
    if (SKIP_TAGS[element.tagName]) return true;
    return !!element.closest("[data-no-i18n], #language");
  }

  function translateTree(rootNode) {
    if (!activeMap || !rootNode) return;
    if (rootNode.nodeType === 3) {
      if (!skipped(rootNode)) translateText(rootNode);
      return;
    }
    if (rootNode.nodeType !== 1) return;
    var walker = document.createTreeWalker(rootNode, 4);
    var current;
    var nodes = [];
    while ((current = walker.nextNode())) nodes.push(current);
    nodes.forEach(function (node) {
      if (!skipped(node)) translateText(node);
    });
  }

  function prune() {
    if (changedText.length < 4000) return;
    changedText = changedText.filter(function (item) {
      return document.contains(item.node);
    });
    changedLang = changedLang.filter(function (element) {
      return document.contains(element);
    });
  }

  function onMutations(records) {
    records.forEach(function (record) {
      if (record.type === "characterData") {
        if (!skipped(record.target)) translateText(record.target);
      } else {
        Array.prototype.forEach.call(record.addedNodes, translateTree);
      }
    });
    prune();
  }

  function disable() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    changedText.forEach(function (item) {
      if (document.contains(item.node)) item.node.nodeValue = item.original;
    });
    changedLang.forEach(function (element) {
      if (document.contains(element)) element.setAttribute("lang", "en");
    });
    changedText = [];
    changedLang = [];
    activeMap = null;
    activeLanguage = "";
    document.documentElement.setAttribute("lang", "en");
  }

  function enable(language, map) {
    disable();
    if (!map || !language || language === "en") return;
    activeLanguage = language;
    activeMap = map;
    document.documentElement.setAttribute("lang", language);
    translateTree(document.body);
    observer = new root.MutationObserver(onMutations);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function active() {
    return activeLanguage;
  }

  root.LabI18n = {
    strings: STRINGS,
    load: load,
    enable: enable,
    disable: disable,
    active: active,
    translateTree: translateTree
  };
})(window);
