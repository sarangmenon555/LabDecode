(function (root) {
  "use strict";

  var synth = root.speechSynthesis;
  var supported = !!(synth && root.SpeechSynthesisUtterance);

  var REGION = {
    en: "en-IN",
    as: "as-IN",
    bn: "bn-IN",
    gu: "gu-IN",
    hi: "hi-IN",
    kn: "kn-IN",
    ml: "ml-IN",
    mr: "mr-IN",
    or: "or-IN",
    ta: "ta-IN",
    te: "te-IN"
  };

  var queue = [];
  var active = false;
  var paused = false;
  var rate = 0.92;
  var token = 0;

  function voicesReady() {
    return new Promise(function (resolve) {
      if (!supported) {
        resolve([]);
        return;
      }
      var list = synth.getVoices();
      if (list.length) {
        resolve(list);
        return;
      }
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        synth.removeEventListener("voiceschanged", finish);
        resolve(synth.getVoices());
      }
      synth.addEventListener("voiceschanged", finish);
      setTimeout(finish, 1500);
    });
  }

  function pickVoice(voices, code) {
    var target = (REGION[code] || code).toLowerCase();
    var base = code.toLowerCase();
    var exact = null;
    var loose = null;
    voices.forEach(function (voice) {
      var lang = (voice.lang || "").toLowerCase().replace("_", "-");
      if (!exact && lang === target) exact = voice;
      if (!loose && (lang === base || lang.indexOf(base + "-") === 0)) loose = voice;
    });
    return exact || loose;
  }

  function split(text) {
    var pieces = [];
    var flat = String(text).replace(/\s+/g, " ").trim();
    (flat.match(/[^.!?\u0964\u0965]+[.!?\u0964\u0965]*/g) || [])
      .map(function (sentence) {
        return sentence.trim();
      })
      .filter(Boolean)
      .forEach(function (sentence) {
        var rest = sentence;
        while (rest.length > 220) {
          var cut = rest.lastIndexOf(",", 220);
          if (cut < 80) cut = rest.lastIndexOf(" ", 220);
          if (cut < 40) cut = 220;
          pieces.push(rest.slice(0, cut + 1).trim());
          rest = rest.slice(cut + 1).trim();
        }
        if (rest) pieces.push(rest);
      });
    return pieces;
  }

  function stop() {
    token += 1;
    queue = [];
    active = false;
    paused = false;
    if (supported) synth.cancel();
  }

  function setRate(value) {
    var number = parseFloat(value);
    if (number >= 0.5 && number <= 1.6) rate = number;
  }

  function pause() {
    if (!supported || !active || paused) return false;
    synth.pause();
    paused = true;
    return true;
  }

  function resume() {
    if (!supported || !paused) return false;
    paused = false;
    synth.resume();
    return true;
  }

  function isPaused() {
    return paused;
  }

  function speak(texts, code, handlers) {
    var on = handlers || {};
    if (!supported) {
      if (on.error) on.error("This browser cannot read text aloud.");
      return;
    }

    voicesReady().then(function (voices) {
      var voice = pickVoice(voices, code);
      if (!voice && code !== "en") {
        if (on.error) on.error("This device has no voice for this language. Try English or install a voice in your device settings.");
        return;
      }

      stop();
      var mine = token;
      queue = [];
      texts.forEach(function (text) {
        split(text).forEach(function (piece) {
          queue.push(piece);
        });
      });
      if (!queue.length) return;

      active = true;
      if (on.start) on.start();

      function next() {
        if (mine !== token) return;
        if (!queue.length) {
          active = false;
          paused = false;
          if (on.end) on.end();
          return;
        }
        var utterance = new root.SpeechSynthesisUtterance(queue.shift());
        utterance.lang = voice ? voice.lang : REGION[code] || code;
        if (voice) utterance.voice = voice;
        utterance.rate = rate;
        utterance.onend = next;
        utterance.onerror = function (event) {
          if (mine !== token) return;
          if (event && event.error === "interrupted") return;
          active = false;
          if (on.error) on.error("Reading aloud stopped unexpectedly.");
        };
        synth.speak(utterance);
      }

      next();
    });
  }

  function isActive() {
    return active;
  }

  root.addEventListener("pagehide", stop);

  root.LabSpeech = {
    supported: supported,
    speak: speak,
    stop: stop,
    isActive: isActive,
    setRate: setRate,
    pause: pause,
    resume: resume,
    isPaused: isPaused
  };
})(window);
