(function () {
  "use strict";

  var SIZE_KEY = "labdecode-size";
  var CONTRAST_KEY = "labdecode-contrast";
  var THEME_KEY = "labdecode-theme";
  var THEMES = ["auto", "light", "dark"];
  var SIZES = ["normal", "large", "larger"];
  var root = document.documentElement;

  function read(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function write(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      return;
    }
  }

  var size = read(SIZE_KEY);
  if (SIZES.indexOf(size) === -1) size = "normal";

  var theme = read(THEME_KEY);
  if (THEMES.indexOf(theme) === -1) theme = "auto";
  var darkQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  var storedContrast = read(CONTRAST_KEY);
  var contrast;
  if (storedContrast === "high") {
    contrast = true;
  } else if (storedContrast === "normal") {
    contrast = false;
  } else {
    contrast = !!(window.matchMedia && window.matchMedia("(prefers-contrast: more)").matches);
  }

  function isDark() {
    if (contrast) return false;
    if (theme === "dark") return true;
    if (theme === "light") return false;
    return !!(darkQuery && darkQuery.matches);
  }

  function apply() {
    root.setAttribute("data-size", size);
    if (isDark()) root.setAttribute("data-theme", "dark");
    else root.removeAttribute("data-theme");
    if (contrast) root.setAttribute("data-contrast", "high");
    else root.removeAttribute("data-contrast");
  }

  apply();

  document.addEventListener("DOMContentLoaded", function () {
    var buttons = Array.prototype.slice.call(document.querySelectorAll("[data-size-choice]"));
    var toggle = document.getElementById("contrast-toggle");
    var themeButtons = Array.prototype.slice.call(document.querySelectorAll("[data-theme-choice]"));

    function sync() {
      themeButtons.forEach(function (button) {
        button.setAttribute("aria-pressed", button.getAttribute("data-theme-choice") === theme ? "true" : "false");
      });
      buttons.forEach(function (button) {
        button.setAttribute("aria-pressed", button.getAttribute("data-size-choice") === size ? "true" : "false");
      });
      if (toggle) toggle.checked = contrast;
    }

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        size = button.getAttribute("data-size-choice");
        write(SIZE_KEY, size);
        apply();
        sync();
      });
    });

    themeButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        theme = button.getAttribute("data-theme-choice");
        write(THEME_KEY, theme);
        apply();
        sync();
      });
    });

    if (darkQuery && darkQuery.addEventListener) {
      darkQuery.addEventListener("change", apply);
    }

    if (toggle) {
      toggle.addEventListener("change", function () {
        contrast = toggle.checked;
        write(CONTRAST_KEY, contrast ? "high" : "normal");
        apply();
      });
    }

    sync();
  });
})();
