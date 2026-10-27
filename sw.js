var VERSION = "labdecode-v10";
var PREFIX = "labdecode-";
var SHELL = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "redact.js",
  "imageprep.js",
  "ocr.js",
  "speech.js",
  "dictate.js",
  "glossary.js",
  "export.js",
  "display.js",
  "lookup.js",
  "i18n.js",
  "locales.js",
  "about",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "demo.json"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches
      .open(VERSION)
      .then(function (cache) {
        return cache.addAll(SHELL);
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (key) {
              return key.indexOf(PREFIX) === 0 && key !== VERSION;
            })
            .map(function (key) {
              return caches.delete(key);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

function store(request, response) {
  if (response && response.ok) {
    var copy = response.clone();
    caches.open(VERSION).then(function (cache) {
      cache.put(request, copy);
    });
  }
  return response;
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;

  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf("/api/") === 0) return;

  if (url.pathname.indexOf("/vendor/") === 0) {
    event.respondWith(
      caches.match(request).then(function (cached) {
        return (
          cached ||
          fetch(request).then(function (response) {
            return store(request, response);
          })
        );
      })
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then(function (response) {
        return store(request, response);
      })
      .catch(function () {
        return caches.match(request, { ignoreSearch: true }).then(function (cached) {
          if (cached) return cached;
          if (request.mode === "navigate") return caches.match("index.html");
          return Response.error();
        });
      })
  );
});
