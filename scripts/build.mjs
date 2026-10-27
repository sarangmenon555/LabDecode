import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = process.argv.find((item) => item.startsWith("--out="));
const out = path.resolve(root, arg ? arg.slice(6) : "dist");

const PAGES = ["index.html", "about.html"];
const ALWAYS = ["_headers", "sw.js", "manifest.webmanifest", "demo.json", "404.html"];
const FOLDERS = ["vendor", "icons"];

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function localReferences(html) {
  return [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((value) => !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value))
    .map((value) => value.split("#")[0].split("?")[0])
    .filter((value) => value && value !== "./");
}

function shellFiles() {
  const block = read("sw.js").match(/var SHELL = \[([\s\S]*?)\];/);
  if (!block) throw new Error("Could not find the SHELL list in sw.js");
  return [...block[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]).filter((value) => value !== "./");
}

function manifestIcons() {
  return JSON.parse(read("manifest.webmanifest")).icons.map((icon) => icon.src);
}

const files = new Set(ALWAYS);
for (const page of PAGES) {
  files.add(page);
  for (const reference of localReferences(read(page))) files.add(reference);
}
for (const file of shellFiles()) files.add(file);
for (const file of manifestIcons()) files.add(file);

function resolve(file) {
  if (fs.existsSync(path.join(root, file))) return file;
  if (fs.existsSync(path.join(root, file + ".html"))) return file + ".html";
  return null;
}

const resolved = new Set();
const missing = [];
for (const file of files) {
  const found = resolve(file);
  if (found) resolved.add(found);
  else missing.push(file);
}
if (missing.length) {
  console.error("Missing files: " + missing.join(", "));
  process.exit(1);
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

let count = 0;
let bytes = 0;

function copyFile(relative) {
  const target = path.join(out, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(root, relative), target);
  count += 1;
  bytes += fs.statSync(target).size;
}

function copyFolder(relative) {
  for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const child = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) copyFolder(child);
    else copyFile(child);
  }
}

for (const file of resolved) {
  if (fs.statSync(path.join(root, file)).isDirectory()) copyFolder(file);
  else copyFile(file);
}
for (const folder of FOLDERS) copyFolder(folder);

const unique = new Set();
(function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else unique.add(path.relative(out, full));
  }
})(out);

console.log(`Built ${unique.size} files (${(bytes / 1048576).toFixed(1)} MB) in ${path.relative(root, out) || "."}`);
