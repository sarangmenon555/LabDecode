(function (root) {
  "use strict";

  function grayscale(rgba, width, height) {
    var gray = new Float32Array(width * height);
    for (var i = 0, p = 0; i < gray.length; i += 1, p += 4) {
      gray[i] = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2];
    }
    return gray;
  }

  function boxBlur(values, width, height, radius) {
    var temp = new Float32Array(values.length);
    var out = new Float32Array(values.length);
    var x;
    var y;

    for (y = 0; y < height; y += 1) {
      var offset = y * width;
      var sum = 0;
      var left = 0;
      var right = Math.min(width - 1, radius);
      for (x = 0; x <= right; x += 1) sum += values[offset + x];
      for (x = 0; x < width; x += 1) {
        temp[offset + x] = sum / (right - left + 1);
        var nextRight = x + radius + 1;
        if (nextRight < width) {
          sum += values[offset + nextRight];
          right = nextRight;
        }
        var nextLeft = x - radius;
        if (nextLeft >= 0) {
          sum -= values[offset + nextLeft];
          left = nextLeft + 1;
        }
      }
    }

    for (x = 0; x < width; x += 1) {
      var total = 0;
      var top = 0;
      var bottom = Math.min(height - 1, radius);
      for (y = 0; y <= bottom; y += 1) total += temp[y * width + x];
      for (y = 0; y < height; y += 1) {
        out[y * width + x] = total / (bottom - top + 1);
        var nextBottom = y + radius + 1;
        if (nextBottom < height) {
          total += temp[nextBottom * width + x];
          bottom = nextBottom;
        }
        var nextTop = y - radius;
        if (nextTop >= 0) {
          total -= temp[nextTop * width + x];
          top = nextTop + 1;
        }
      }
    }
    return out;
  }

  function flatten(gray, width, height) {
    var radius = Math.max(12, Math.round(Math.min(width, height) / 12));
    var background = boxBlur(gray, width, height, radius);
    var out = new Float32Array(gray.length);
    for (var i = 0; i < gray.length; i += 1) {
      var ratio = gray[i] / Math.max(background[i], 8);
      out[i] = Math.min(255, ratio * 235);
    }
    return out;
  }

  function percentile(values, fraction) {
    var histogram = new Uint32Array(256);
    for (var i = 0; i < values.length; i += 1) histogram[Math.max(0, Math.min(255, Math.round(values[i])))] += 1;
    var target = values.length * fraction;
    var seen = 0;
    for (var level = 0; level < 256; level += 1) {
      seen += histogram[level];
      if (seen >= target) return level;
    }
    return 255;
  }

  function stretch(gray) {
    var low = percentile(gray, 0.01);
    var high = percentile(gray, 0.9);
    if (high - low < 20) return gray;
    var out = new Float32Array(gray.length);
    var scale = 255 / (high - low);
    for (var i = 0; i < gray.length; i += 1) {
      out[i] = Math.max(0, Math.min(255, (gray[i] - low) * scale));
    }
    return out;
  }

  function adaptive(gray, width, height, sensitivity) {
    var radius = Math.max(10, Math.round(width / 40));
    var mean = boxBlur(gray, width, height, radius);
    var out = new Float32Array(gray.length);
    for (var i = 0; i < gray.length; i += 1) {
      out[i] = gray[i] < mean[i] * (1 - sensitivity) ? 0 : 255;
    }
    return out;
  }

  function pack(gray, width, height) {
    var out = new Uint8ClampedArray(width * height * 4);
    for (var i = 0, p = 0; i < gray.length; i += 1, p += 4) {
      var value = Math.max(0, Math.min(255, Math.round(gray[i])));
      out[p] = value;
      out[p + 1] = value;
      out[p + 2] = value;
      out[p + 3] = 255;
    }
    return out;
  }

  function enhance(rgba, width, height, mode) {
    var gray = grayscale(rgba, width, height);
    if (mode === "gray") return pack(gray, width, height);
    if (mode === "stretch") return pack(stretch(gray), width, height);
    var flat = flatten(gray, width, height);
    if (mode === "flatten") return pack(stretch(flat), width, height);
    if (mode === "flatten-denoise") return pack(stretch(boxBlur(flat, width, height, 1)), width, height);
    if (mode === "binarize") return pack(adaptive(flat, width, height, 0.12), width, height);
    return pack(stretch(flat), width, height);
  }

  root.LabImagePrep = { enhance: enhance, grayscale: grayscale, boxBlur: boxBlur, flatten: flatten, stretch: stretch, adaptive: adaptive, percentile: percentile };
})(typeof window !== "undefined" ? window : globalThis);
