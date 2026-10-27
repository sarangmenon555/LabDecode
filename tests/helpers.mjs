import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function readProject(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

export function loadBrowserScript(relative, extra = {}) {
  const window = {};
  const document = { addEventListener() {}, ...(extra.document || {}) };
  const context = vm.createContext({ window, document, URL });
  vm.runInContext(readProject(relative), context, { filename: relative });
  return window;
}

export function jsonRequest(url, body, headers = {}) {
  return new Request("https://site.test" + url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
}

export function geminiReply(payload) {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }),
    { status: 200 }
  );
}
