/* Dark mode + accessible mode (nav toggles).
   - The site opens in LIGHT mode. Dark is opt-in via the nav toggle and the
     choice is remembered; the OS colour scheme is deliberately not consulted.
     The no-flash <head> script sets the initial state before first paint, so
     this file only wires the buttons and keeps them synced.
   - Accessible mode forces reduced motion, higher contrast, larger + plainer
     text (all via CSS on <html data-a11y>), remembered too. */
(function () {
  var root = document.documentElement;
  var LS_THEME = "wf-theme"; // "dark" | "light"
  var LS_A11Y = "wf-a11y";   // "1"

  function isDark() { return root.getAttribute("data-theme") === "dark"; }
  function isA11y() { return root.hasAttribute("data-a11y"); }

  var darkBtn = document.getElementById("darkToggle");
  var a11yBtn = document.getElementById("a11yToggle");

  function sync() {
    if (darkBtn) {
      darkBtn.setAttribute("aria-pressed", isDark() ? "true" : "false");
      darkBtn.title = isDark() ? "Switch to light mode" : "Switch to dark mode";
    }
    if (a11yBtn) {
      a11yBtn.setAttribute("aria-pressed", isA11y() ? "true" : "false");
      a11yBtn.title = isA11y() ? "Turn off accessible mode" : "Accessible mode";
    }
  }

  /* Flipping the theme repaints the whole page at once. Carrying it with a
     short tint reads as one state change rather than a hard cut. The class is
     only present for the length of the transition, so it can never fire during
     initial paint, which is what makes most theme transitions feel janky. */
  var shiftTimer = null;
  function carryThemeChange() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        root.hasAttribute("data-a11y")) return;
    root.classList.add("theme-shifting");
    clearTimeout(shiftTimer);
    shiftTimer = setTimeout(function () { root.classList.remove("theme-shifting"); }, 480);
  }

  function setDark(on) {
    carryThemeChange();
    root.setAttribute("data-theme", on ? "dark" : "light");
    try { localStorage.setItem(LS_THEME, on ? "dark" : "light"); } catch (e) {}
    sync();
  }
  function setA11y(on) {
    if (on) root.setAttribute("data-a11y", ""); else root.removeAttribute("data-a11y");
    try { on ? localStorage.setItem(LS_A11Y, "1") : localStorage.removeItem(LS_A11Y); } catch (e) {}
    sync();
  }

  if (darkBtn) darkBtn.addEventListener("click", function () { setDark(!isDark()); });
  if (a11yBtn) a11yBtn.addEventListener("click", function () { setA11y(!isA11y()); });

  /* The site no longer follows the OS colour scheme. Light is the default and
     dark is something the visitor turns on, so there is nothing to listen to:
     an OS-preference listener here would have flipped the page to dark under
     someone who never asked for it, undoing the default set by the no-flash
     script in each page's <head>. */

  sync();
})();
