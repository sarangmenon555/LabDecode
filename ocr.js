(function (root) {
  "use strict";

  var MAX_BYTES = 15 * 1024 * 1024;
  var MAX_PAGES = 6;
  var MAX_CHARS = 12000;
  var MIN_TEXT_PER_PAGE = 80;
  var ACCEPT_CONFIDENCE = 85;
  var UNSURE_BELOW = 70;
  var MAX_UNSURE = 15;
  var base = new URL("vendor/", document.baseURI).href;
  var tesseractLoading = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = function () {
        reject(new Error("The text reader could not be loaded. Check your connection and try again."));
      };
      document.head.appendChild(script);
    });
  }

  function loadTesseract() {
    if (root.Tesseract) return Promise.resolve();
    if (!tesseractLoading) {
      tesseractLoading = loadScript(base + "tesseract/tesseract.min.js").catch(function (error) {
        tesseractLoading = null;
        throw error;
      });
    }
    return tesseractLoading;
  }

  function createWorker(report) {
    return loadTesseract().then(function () {
      return root.Tesseract.createWorker("eng", 1, {
        workerPath: base + "tesseract/worker.min.js",
        corePath: base + "tesseract/core",
        langPath: base + "tesseract/lang",
        workerBlobURL: false,
        logger: function (message) {
          if (message.status === "recognizing text") {
            report("Reading the text", message.progress);
          } else if (/loading|initializ/.test(message.status)) {
            report("Preparing the text reader", null);
          }
        }
      });
    });
  }

  function bitmapToCanvas(bitmap) {
    var longSide = Math.max(bitmap.width, bitmap.height);
    var scale = 1;
    if (longSide > 2600) scale = 2600 / longSide;
    else if (longSide < 1400) scale = Math.min(2, 1400 / longSide);

    var canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    var context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    if (bitmap.close) bitmap.close();
    return canvas;
  }

  function summarize(data) {
    var words = (data && data.words) || [];
    var unsure = [];
    words.forEach(function (word) {
      var text = String(word.text || "").trim();
      if (!text || !/[A-Za-z0-9]/.test(text)) return;
      if (word.confidence < UNSURE_BELOW) unsure.push({ text: text, confidence: Math.round(word.confidence) });
    });
    unsure.sort(function (a, b) {
      var an = /\d/.test(a.text) ? 0 : 1;
      var bn = /\d/.test(b.text) ? 0 : 1;
      return an - bn || a.confidence - b.confidence;
    });
    return {
      text: (data && data.text) || "",
      confidence: Math.round((data && data.confidence) || 0),
      uncertain: unsure.slice(0, MAX_UNSURE)
    };
  }

  function enhancedCopy(canvas) {
    if (!root.LabImagePrep || !root.ImageData) return null;
    try {
      var image = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
      var pixels = root.LabImagePrep.enhance(image.data, canvas.width, canvas.height, "flatten-denoise");
      var copy = document.createElement("canvas");
      copy.width = canvas.width;
      copy.height = canvas.height;
      copy.getContext("2d").putImageData(new root.ImageData(pixels, canvas.width, canvas.height), 0, 0);
      return copy;
    } catch (error) {
      return null;
    }
  }

  function release(canvas) {
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  function recognizeBest(worker, canvas) {
    var enhanced = enhancedCopy(canvas);
    return worker
      .recognize(enhanced || canvas)
      .then(function (first) {
        if (!enhanced || first.data.confidence >= ACCEPT_CONFIDENCE) return first;
        return worker.recognize(canvas).then(function (second) {
          return second.data.confidence > first.data.confidence ? second : first;
        });
      })
      .then(
        function (best) {
          release(enhanced);
          return summarize(best.data);
        },
        function (error) {
          release(enhanced);
          throw error;
        }
      );
  }

  function imageToCanvas(file) {
    if (!root.createImageBitmap) {
      return Promise.reject(new Error("This browser cannot read photos. Paste the report text instead."));
    }
    return root.createImageBitmap(file).then(bitmapToCanvas, function () {
      throw new Error("This image format is not supported. Use a JPG or PNG photo.");
    });
  }

  function tidy(text) {
    return text
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function isPdf(file) {
    return file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
  }

  function readImage(file, report) {
    var worker;
    return imageToCanvas(file)
      .then(function (canvas) {
        report("Preparing the text reader", null);
        return createWorker(report).then(function (created) {
          worker = created;
          return recognizeBest(worker, canvas);
        });
      })
      .then(function (result) {
        return worker.terminate().then(function () {
          return result;
        });
      })
      .catch(function (error) {
        if (worker) worker.terminate();
        throw error;
      });
  }

  function pageText(page) {
    return page.getTextContent().then(function (content) {
      var out = "";
      content.items.forEach(function (item) {
        out += item.str + (item.hasEOL ? "\n" : " ");
      });
      return out;
    });
  }

  function readPdf(file, report) {
    var worker = null;
    var notice = "";
    var confidences = [];
    var unsure = [];

    function ocrPage(page, index, total) {
      var viewport = page.getViewport({ scale: 2 });
      var canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      var context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      var ready = worker
        ? Promise.resolve(worker)
        : createWorker(function (label, fraction) {
            report(label + " (page " + (index + 1) + " of " + total + ")", fraction === null ? null : (index + fraction) / total);
          }).then(function (created) {
            worker = created;
            return worker;
          });

      return page
        .render({ canvasContext: context, viewport: viewport })
        .promise.then(function () {
          return ready;
        })
        .then(function (w) {
          return recognizeBest(w, canvas);
        })
        .then(function (result) {
          confidences.push(result.confidence);
          unsure = unsure.concat(result.uncertain);
          return result.text;
        });
    }

    return file
      .arrayBuffer()
      .then(function (buffer) {
        return import(base + "pdfjs/pdf.min.mjs").then(function (pdfjs) {
          pdfjs.GlobalWorkerOptions.workerSrc = base + "pdfjs/pdf.worker.min.mjs";
          return pdfjs.getDocument({ data: buffer }).promise;
        });
      })
      .then(function (pdf) {
        var total = Math.min(pdf.numPages, MAX_PAGES);
        if (pdf.numPages > MAX_PAGES) {
          notice = "Only the first " + MAX_PAGES + " pages were read.";
        }
        var collected = [];
        var chain = Promise.resolve();

        function step(index) {
          chain = chain.then(function () {
            report("Reading page " + (index + 1) + " of " + total, index / total);
            return pdf
              .getPage(index + 1)
              .then(function (page) {
                return pageText(page).then(function (text) {
                  if (text.trim().length >= MIN_TEXT_PER_PAGE) return text;
                  return ocrPage(page, index, total);
                });
              })
              .then(function (text) {
                collected.push(text);
              });
          });
        }

        for (var i = 0; i < total; i += 1) step(i);

        return chain.then(function () {
          return collected.join("\n\n");
        });
      })
      .then(function (text) {
        var finish = worker ? worker.terminate() : Promise.resolve();
        return finish.then(function () {
          return {
            text: text,
            notice: notice,
            confidence: confidences.length ? Math.min.apply(null, confidences) : null,
            uncertain: unsure.slice(0, MAX_UNSURE)
          };
        });
      })
      .catch(function (error) {
        if (worker) worker.terminate();
        if (error && error.name === "PasswordException") {
          throw new Error("This PDF is password protected. Remove the password or paste the text instead.");
        }
        throw error;
      });
  }

  function extract(file, onProgress) {
    var report = typeof onProgress === "function" ? onProgress : function () {};

    if (!file) return Promise.reject(new Error("No file was chosen."));
    if (file.size > MAX_BYTES) return Promise.reject(new Error("The file is larger than 15 MB. Use a smaller file."));

    var pdf = isPdf(file);
    if (!pdf && !/^image\//.test(file.type)) {
      return Promise.reject(new Error("Choose a photo (JPG or PNG) or a PDF."));
    }

    var job = pdf
      ? readPdf(file, report)
      : readImage(file, report).then(function (result) {
          return { text: result.text, notice: "", confidence: result.confidence, uncertain: result.uncertain };
        });

    return job.then(function (result) {
      var text = tidy(result.text);
      var notice = result.notice;
      if (text.length < 20) {
        throw new Error("No readable text was found. Try a sharper, well-lit photo of the full page, or paste the text.");
      }
      if (text.length > MAX_CHARS) {
        text = text.slice(0, MAX_CHARS);
        notice = (notice ? notice + " " : "") + "The text was cut to 12,000 characters.";
      }
      return { text: text, notice: notice, confidence: result.confidence, uncertain: result.uncertain || [] };
    });
  }

  root.LabOCR = { extract: extract, summarize: summarize };
})(window);
