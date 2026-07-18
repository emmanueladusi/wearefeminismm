/* Dark mode + accessible mode (nav toggles).
   - Dark mode follows the OS by default and can be flipped manually; the choice
     is remembered. The no-flash <head> script sets the initial state so there's
     no light flash on load; this only wires the buttons and keeps them synced.
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

  function setDark(on) {
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

  // keep following the OS while the visitor hasn't made an explicit choice
  try {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    (mq.addEventListener ? mq.addEventListener.bind(mq, "change") : mq.addListener.bind(mq))(function (e) {
      var saved; try { saved = localStorage.getItem(LS_THEME); } catch (x) {}
      if (!saved) setDark(e.matches);
    });
  } catch (e) {}

  sync();
})();
