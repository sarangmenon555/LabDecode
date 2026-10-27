(function (root) {
  "use strict";

  var Recognition = root.SpeechRecognition || root.webkitSpeechRecognition;
  var supported = !!Recognition;

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

  var current = null;

  function stop() {
    if (current) {
      try {
        current.stop();
      } catch (error) {
        current = null;
      }
    }
  }

  function start(code, handlers) {
    var on = handlers || {};
    if (!supported) {
      if (on.error) on.error("This browser cannot take dictation. Type the question instead.");
      return;
    }

    stop();
    var recognition = new Recognition();
    var transcript = "";
    recognition.lang = REGION[code] || code;
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = function () {
      if (on.start) on.start();
    };
    recognition.onresult = function (event) {
      for (var i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) transcript += event.results[i][0].transcript + " ";
      }
    };
    recognition.onerror = function (event) {
      var code2 = event && event.error;
      var message = "Dictation stopped. Type the question instead.";
      if (code2 === "not-allowed" || code2 === "service-not-allowed") {
        message = "Microphone access was blocked. Allow it in your browser settings or type the question.";
      } else if (code2 === "no-speech") {
        message = "No speech was heard. Try again.";
      } else if (code2 === "language-not-supported") {
        message = "Dictation is not available for this language on this device.";
      }
      if (on.error) on.error(message);
    };
    recognition.onend = function () {
      current = null;
      if (on.end) on.end(transcript.trim());
    };

    current = recognition;
    try {
      recognition.start();
    } catch (error) {
      current = null;
      if (on.error) on.error("Dictation could not start. Type the question instead.");
    }
  }

  root.LabDictate = { supported: supported, start: start, stop: stop };
})(window);
