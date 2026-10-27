import test from "node:test";
import assert from "node:assert/strict";
import { readProject } from "./helpers.mjs";

const css = readProject("styles.css");

function variables(selector) {
  const start = css.indexOf(selector + " {");
  assert.ok(start >= 0, selector);
  const end = css.indexOf("}", start);
  const found = {};
  for (const match of css.slice(start, end).matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) found[match[1]] = match[2];
  return found;
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);
  const linear = (value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function ratio(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

const TEXT = [
  ["ink", "bg"], ["ink", "surface"], ["ink", "soft"], ["ink", "tint"],
  ["muted", "bg"], ["muted", "surface"], ["muted", "soft"],
  ["accent-strong", "surface"], ["accent-strong", "soft"], ["accent-strong", "field"], ["accent-strong", "tint"], ["accent-strong", "tint-strong"],
  ["plain", "surface"], ["plain", "soft"],
  ["discuss", "surface"], ["discuss", "soft"], ["discuss", "tint-warn"],
  ["unclear", "surface"], ["unclear", "soft"],
  ["danger", "surface"],
  ["accent-ink", "accent"]
];

const BOUNDARIES = [["input-border", "field"], ["focus", "surface"], ["focus", "bg"], ["accent", "surface"]];

const themes = {
  light: variables(":root"),
  dark: { ...variables(":root"), ...variables('html[data-theme="dark"]') },
  "high contrast": { ...variables(":root"), ...variables('html[data-contrast="high"]') }
};

for (const [name, theme] of Object.entries(themes)) {
  test(`${name}: text colours reach 4.5:1`, () => {
    for (const [foreground, background] of TEXT) {
      if (!(foreground in theme) || !(background in theme)) continue;
      const value = ratio(theme[foreground], theme[background]);
      assert.ok(value >= 4.5, `${foreground} on ${background} is ${value.toFixed(2)}`);
    }
    for (const colour of ["#ffffff", "#d8ecee"]) {
      const value = ratio(colour, theme.masthead);
      assert.ok(value >= 4.5, `${colour} on masthead is ${value.toFixed(2)}`);
    }
  });

  test(`${name}: field borders and focus rings reach 3:1`, () => {
    for (const [foreground, background] of BOUNDARIES) {
      const value = ratio(theme[foreground], theme[background]);
      assert.ok(value >= 3, `${foreground} on ${background} is ${value.toFixed(2)}`);
    }
  });
}
