const THOUSANDS = /(\d),(?=\d{3}(?!\d))/g;
const RANGE = /(-?\d+(?:\.\d+)?)\s*(?:-|\u2013|\u2014|to)\s*(-?\d+(?:\.\d+)?)/gi;

function toNumber(text) {
  if (typeof text !== "string") return null;
  const match = text.replace(THOUSANDS, "$1").match(/-?\d+(?:\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

function parseRange(text) {
  if (typeof text !== "string") return null;
  const compact = text.replace(THOUSANDS, "$1");

  const spans = compact.match(RANGE) || [];
  if (spans.length > 1) return null;
  if (spans.length === 1) {
    RANGE.lastIndex = 0;
    const m = RANGE.exec(compact);
    RANGE.lastIndex = 0;
    const low = parseFloat(m[1]);
    const high = parseFloat(m[2]);
    return low <= high ? { low, high } : null;
  }

  const upper = compact.match(/(?:<=|\u2264|<|up to|upto|below|less than)\s*(\d+(?:\.\d+)?)/i);
  if (upper) return { low: null, high: parseFloat(upper[1]) };

  const lower = compact.match(/(?:>=|\u2265|>|above|more than|greater than)\s*(\d+(?:\.\d+)?)/i);
  if (lower) return { low: parseFloat(lower[1]), high: null };

  return null;
}

export function checkFlag(value, range) {
  if (typeof range !== "string" || !range.trim()) return "no_range_given";

  const parsed = parseRange(range);
  const number = toNumber(value);
  const approximate = typeof value === "string" && /^\s*[<>~\u2264\u2265]/.test(value);

  if (!parsed || number === null || approximate) return "cannot_tell";

  const below = parsed.low !== null && number < parsed.low;
  const above = parsed.high !== null && number > parsed.high;
  return below || above ? "outside_range" : "within_range";
}
