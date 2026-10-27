import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { PNG } = require("pngjs");
const { createWorker } = require("tesseract.js");

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const dir = process.argv[2] || "ocr-eval-images";
const modes = (process.argv[3] || "raw,flatten-denoise").split(",");

const context = vm.createContext({ window: {} });
context.globalThis = context.window;
vm.runInContext(fs.readFileSync(path.join(root, "imageprep.js"), "utf8"), context);
const Prep = context.window.LabImagePrep;

const truth = fs.readFileSync(path.join(dir, "truth.txt"), "utf8");
const squash = (text) => text.replace(/\s+/g, " ").trim();

function distance(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = row;
  }
  return previous[b.length];
}

const numbers = (text) => text.match(/\d+(?:\.\d+)?/g) || [];

function recall(text) {
  const pool = numbers(text);
  const wanted = numbers(truth);
  let hit = 0;
  for (const number of wanted) {
    const index = pool.indexOf(number);
    if (index >= 0) {
      hit += 1;
      pool.splice(index, 1);
    }
  }
  return hit / wanted.length;
}

const worker = await createWorker("eng", 1, { langPath: path.join(root, "vendor", "tesseract", "lang"), cachePath: os.tmpdir() });
const names = fs.readdirSync(dir).filter((file) => file.endsWith(".png")).map((file) => file.replace(".png", ""));
const totals = Object.fromEntries(modes.map((mode) => [mode, { error: 0, digits: 0 }]));

console.log("image".padEnd(14) + modes.map((mode) => mode.padEnd(36)).join(""));
for (const name of names) {
  const png = PNG.sync.read(fs.readFileSync(path.join(dir, name + ".png")));
  let line = name.padEnd(14);
  for (const mode of modes) {
    let buffer = fs.readFileSync(path.join(dir, name + ".png"));
    if (mode !== "raw") {
      const out = new PNG({ width: png.width, height: png.height });
      out.data = Buffer.from(Prep.enhance(png.data, png.width, png.height, mode));
      buffer = PNG.sync.write(out);
    }
    const { data } = await worker.recognize(buffer);
    const error = distance(squash(truth), squash(data.text)) / squash(truth).length;
    totals[mode].error += error;
    totals[mode].digits += recall(data.text);
    line += `${(error * 100).toFixed(1)}% errors, ${(recall(data.text) * 100).toFixed(0)}% digits`.padEnd(36);
  }
  console.log(line);
}
console.log("MEAN".padEnd(14) + modes.map((mode) => `${((totals[mode].error / names.length) * 100).toFixed(1)}% errors, ${((totals[mode].digits / names.length) * 100).toFixed(0)}% digits`.padEnd(36)).join(""));
await worker.terminate();
