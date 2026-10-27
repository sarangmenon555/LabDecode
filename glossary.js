(function (root) {
  "use strict";

  var counter = 0;
  var LETTER = /[\p{L}\p{N}]/u;

  function isBoundary(text, start, end) {
    var before = start > 0 ? text.charAt(start - 1) : "";
    var after = end < text.length ? text.charAt(end) : "";
    return !(before && LETTER.test(before)) && !(after && LETTER.test(after));
  }

  function findMatches(text, terms) {
    var lower = text.toLowerCase();
    if (lower.length !== text.length) return [];

    var found = [];
    terms.forEach(function (entry) {
      var needle = entry.term.toLowerCase();
      var from = 0;
      while (from <= lower.length - needle.length) {
        var index = lower.indexOf(needle, from);
        if (index === -1) break;
        if (isBoundary(text, index, index + needle.length)) {
          found.push({ start: index, end: index + needle.length, entry: entry });
          break;
        }
        from = index + 1;
      }
    });

    found.sort(function (a, b) {
      return a.start - b.start || b.end - b.start - (a.end - a.start);
    });

    var kept = [];
    var edge = -1;
    found.forEach(function (match) {
      if (match.start >= edge) {
        kept.push(match);
        edge = match.end;
      }
    });
    return kept;
  }

  function toggle(button, host, entry) {
    var id = button.getAttribute("aria-controls");
    var existing = id ? document.getElementById(id) : null;

    if (existing) {
      existing.parentNode.removeChild(existing);
      button.setAttribute("aria-expanded", "false");
      button.removeAttribute("aria-controls");
      return;
    }

    counter += 1;
    var panel = document.createElement("p");
    panel.className = "term-def";
    panel.id = "term-def-" + counter;
    var strong = document.createElement("strong");
    strong.textContent = entry.term + ": ";
    panel.appendChild(strong);
    panel.appendChild(document.createTextNode(entry.definition));

    host.parentNode.insertBefore(panel, host.nextSibling);
    button.setAttribute("aria-expanded", "true");
    button.setAttribute("aria-controls", panel.id);
  }

  function fill(host, text, terms) {
    host.textContent = "";
    var matches = terms && terms.length ? findMatches(text, terms) : [];
    if (!matches.length) {
      host.textContent = text;
      return;
    }

    var cursor = 0;
    matches.forEach(function (match) {
      if (match.start > cursor) host.appendChild(document.createTextNode(text.slice(cursor, match.start)));
      var button = document.createElement("button");
      button.type = "button";
      button.className = "term";
      button.setAttribute("aria-expanded", "false");
      button.textContent = text.slice(match.start, match.end);
      button.addEventListener("click", function () {
        toggle(button, host, match.entry);
      });
      host.appendChild(button);
      cursor = match.end;
    });
    if (cursor < text.length) host.appendChild(document.createTextNode(text.slice(cursor)));
  }

  root.LabGlossary = { fill: fill };
})(window);
