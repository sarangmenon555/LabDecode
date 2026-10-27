import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { root } from "./helpers.mjs";

const SKIPPED = new Set(["vendor", "node_modules", "dist", ".wrangler", "verify-output", ".git", "__pycache__"]);
const BINARY = /\.(png|gz|zip|pyc)$/;
const REGEX_AFTER = new Set("(,=:[!&|?{};+-*%<>~^");
const REGEX_WORDS = new Set(["return", "typeof", "case", "in", "of", "delete", "void", "throw", "new", "else", "do", "yield", "await"]);

export function jsComments(source) {
  const found = [];
  const braces = [];
  let i = 0;
  let last = "";
  let word = "";

  function readString(quote) {
    i += 1;
    while (i < source.length && source[i] !== quote) i += source[i] === "\\" ? 2 : 1;
    i += 1;
  }

  function readTemplate() {
    i += 1;
    while (i < source.length) {
      if (source[i] === "\\") i += 2;
      else if (source[i] === "`") {
        i += 1;
        return;
      } else if (source[i] === "$" && source[i + 1] === "{") {
        braces.push("template");
        i += 2;
        return;
      } else i += 1;
    }
  }

  function readRegex() {
    i += 1;
    let inClass = false;
    while (i < source.length) {
      const char = source[i];
      if (char === "\\") i += 2;
      else {
        if (char === "[") inClass = true;
        else if (char === "]") inClass = false;
        else if (char === "/" && !inClass) {
          i += 1;
          break;
        }
        i += 1;
      }
    }
    while (/[a-z]/i.test(source[i] || "")) i += 1;
  }

  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];
    if (/\s/.test(char)) {
      i += 1;
      continue;
    }
    if (char === "/" && next === "/") {
      found.push("line comment at " + i);
      while (i < source.length && source[i] !== "\n") i += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      found.push("block comment at " + i);
      i = source.indexOf("*/", i + 2);
      i = i < 0 ? source.length : i + 2;
      continue;
    }
    if (char === '"' || char === "'") {
      readString(char);
      last = "x";
      word = "";
      continue;
    }
    if (char === "`") {
      readTemplate();
      last = "x";
      word = "";
      continue;
    }
    if (char === "{") braces.push("block");
    if (char === "}") {
      const kind = braces.pop();
      if (kind === "template") {
        i += 1;
        readTemplateRest();
        last = "x";
        continue;
      }
    }
    if (char === "/") {
      if (last === "" || REGEX_AFTER.has(last) || REGEX_WORDS.has(word)) {
        readRegex();
        last = "x";
        word = "";
        continue;
      }
    }
    if (/[A-Za-z0-9_$]/.test(char)) {
      word = /[A-Za-z_$]/.test(char) && !/[A-Za-z0-9_$]/.test(source[i - 1] || "") ? char : word + char;
      last = "x";
    } else {
      word = "";
      last = char;
    }
    i += 1;
  }

  function readTemplateRest() {
    while (i < source.length) {
      if (source[i] === "\\") i += 2;
      else if (source[i] === "`") {
        i += 1;
        return;
      } else if (source[i] === "$" && source[i + 1] === "{") {
        braces.push("template");
        i += 2;
        return;
      } else i += 1;
    }
  }

  return found;
}

export function cssComments(source) {
  const found = [];
  let quote = null;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (char === "\\") i += 1;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "/" && source[i + 1] === "*") {
      found.push("comment at " + i);
      break;
    }
  }
  return found;
}

export function pythonComments(source) {
  const found = [];
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    const triple = source.slice(i, i + 3);
    if (triple === '"""' || triple === "'''") {
      const end = source.indexOf(triple, i + 3);
      i = end < 0 ? source.length : end + 3;
    } else if (char === '"' || char === "'") {
      i += 1;
      while (i < source.length && source[i] !== char && source[i] !== "\n") i += source[i] === "\\" ? 2 : 1;
      i += 1;
    } else if (char === "#") {
      found.push("comment at " + i);
      while (i < source.length && source[i] !== "\n") i += 1;
    } else i += 1;
  }
  return found;
}

export function lineComments(source) {
  return source
    .split("\n")
    .map((line, index) => (/^\s*#/.test(line) || /\s#\s/.test(line) ? "line " + (index + 1) : null))
    .filter(Boolean);
}

export function htmlComments(source) {
  return source.includes("<" + "!--") ? ["html comment"] : [];
}

function files() {
  const found = [];
  (function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIPPED.has(entry.name)) walk(path.join(directory, entry.name));
      } else if (!BINARY.test(entry.name)) found.push(path.join(directory, entry.name));
    }
  })(root);
  return found;
}

function scanner(file) {
  const ext = path.extname(file);
  const name = path.basename(file);
  if (ext === ".js" || ext === ".mjs") return jsComments;
  if (ext === ".css") return cssComments;
  if (ext === ".html") return htmlComments;
  if (ext === ".py") return pythonComments;
  if (ext === ".yml" || ext === ".yaml" || [".gitignore", "_headers", ".dev.vars.example"].includes(name)) return lineComments;
  return null;
}

test("the comment finder works on tricky code", () => {
  assert.equal(jsComments('const a = "// not a comment"; const b = /\\/\\/.*/g; const c = `x ${"/* no */"} y`;').length, 0);
  assert.equal(jsComments("const url = 'https://example.test'; const d = 4 / 2 / 1;").length, 0);
  assert.equal(jsComments("const a = 1; // note").length, 1);
  assert.equal(jsComments("const a = 1; /* note */").length, 1);
  assert.equal(jsComments("const t = `a ${b /* inside */} c`;").length, 1);
  assert.equal(cssComments('a::after { content: "/*"; }').length, 0);
  assert.equal(cssComments("a { color: red; } /* note */").length, 1);
  assert.equal(pythonComments('x = "# no"\ny = """\n# no\n"""').length, 0);
  assert.equal(pythonComments("x = 1  # note").length, 1);
  assert.equal(lineComments("a=1\n# note").length, 1);
  assert.equal(lineComments("a=1\nb=2").length, 0);
});

test("no code file contains a comment", () => {
  const problems = [];
  for (const file of files()) {
    const scan = scanner(file);
    if (!scan) continue;
    for (const finding of scan(fs.readFileSync(file, "utf8"))) problems.push(`${path.relative(root, file)}: ${finding}`);
  }
  assert.equal(problems.length, 0, problems.join("\n"));
});

test("no file contains emoji, icon symbols or character entities", () => {
  const symbol = /\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{So}|\p{Sc}|\p{Sk}|\p{Sm}|\uFE0F|\u200D/u;
  const problems = [];
  for (const file of files()) {
    const text = fs.readFileSync(file, "utf8");
    for (const char of text) {
      if (char.codePointAt(0) > 127 && symbol.test(char)) {
        problems.push(`${path.relative(root, file)}: U+${char.codePointAt(0).toString(16).toUpperCase()}`);
        break;
      }
    }
    if (path.extname(file) !== ".md") {
      const entities = (text.match(/&(?:#\d+|#x[0-9a-f]+|[a-z]+);/gi) || []).filter((entity) => !["&amp;", "&lt;", "&gt;", "&quot;"].includes(entity));
      if (entities.length) problems.push(`${path.relative(root, file)}: entity ${entities[0]}`);
    }
  }
  assert.equal(problems.length, 0, problems.join("\n"));
});

test("pages use no icon fonts, inline icons or decorative images", () => {
  for (const page of ["index.html", "about.html", "404.html"]) {
    const html = fs.readFileSync(path.join(root, page), "utf8");
    assert.ok(!/<svg|<i\s|fontawesome|material-icons|bootstrap-icons|<img/i.test(html), page);
  }
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  assert.ok(!/content:\s*["'][^"']/.test(css));
});
