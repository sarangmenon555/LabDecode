import test from "node:test";
import assert from "node:assert/strict";
import { loadBrowserScript } from "./helpers.mjs";

const { LabImagePrep } = loadBrowserScript("imageprep.js");

function naiveBlur(values, width, height, radius) {
  const out = new Array(values.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      for (let j = Math.max(0, y - radius); j <= Math.min(height - 1, y + radius); j += 1) {
        for (let i = Math.max(0, x - radius); i <= Math.min(width - 1, x + radius); i += 1) {
          sum += values[j * width + i];
          count += 1;
        }
      }
      out[y * width + x] = sum / count;
    }
  }
  return out;
}

function seeded() {
  let state = 12345;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

test("box blur matches a straightforward average, including at the edges", () => {
  const random = seeded();
  for (const [width, height, radius] of [[9, 7, 2], [16, 5, 3], [4, 4, 1], [6, 6, 10]]) {
    const values = Float32Array.from({ length: width * height }, () => Math.floor(random() * 255));
    const fast = LabImagePrep.boxBlur(values, width, height, radius);
    const slow = naiveBlur(values, width, height, radius);
    for (let i = 0; i < slow.length; i += 1) assert.ok(Math.abs(fast[i] - slow[i]) < 0.01, `${width}x${height} r${radius} at ${i}`);
  }
});

function shadedPage(width, height) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const shade = 1 - 0.6 * (x / width);
      const ink = y % 20 < 4 && x % 40 < 25 ? 0.12 : 1;
      const value = Math.round(240 * shade * ink);
      const p = (y * width + x) * 4;
      rgba[p] = rgba[p + 1] = rgba[p + 2] = value;
      rgba[p + 3] = 255;
    }
  }
  return rgba;
}

function backgroundSpread(rgba, width, height) {
  const columns = [];
  for (const x of [5, Math.floor(width / 2), width - 6]) {
    const p = (10 * width + x) * 4;
    columns.push(rgba[p]);
  }
  return Math.max(...columns) - Math.min(...columns);
}

test("flattening removes a lighting gradient but keeps the ink dark", () => {
  const width = 240;
  const height = 120;
  const page = shadedPage(width, height);
  const out = LabImagePrep.enhance(page, width, height, "flatten-denoise");
  assert.ok(backgroundSpread(page, width, height) > 80);
  assert.ok(backgroundSpread(out, width, height) < 25);
  const inkPixel = (2 * width + 10) * 4;
  assert.ok(out[inkPixel] < 110);
});

test("enhanced images keep their size and are opaque grayscale", () => {
  const width = 30;
  const height = 20;
  const out = LabImagePrep.enhance(shadedPage(width, height), width, height, "flatten-denoise");
  assert.equal(out.length, width * height * 4);
  for (let p = 0; p < out.length; p += 4) {
    assert.equal(out[p], out[p + 1]);
    assert.equal(out[p + 1], out[p + 2]);
    assert.equal(out[p + 3], 255);
  }
});

test("percentile reads the histogram", () => {
  const values = Float32Array.from({ length: 100 }, (_, i) => i * 2);
  assert.equal(LabImagePrep.percentile(values, 0.5), 98);
  assert.equal(LabImagePrep.percentile(values, 1), 198);
});

test("a nearly flat image is left alone by stretching", () => {
  const flat = Float32Array.from({ length: 50 }, () => 200);
  assert.equal(LabImagePrep.stretch(flat)[0], 200);
});
