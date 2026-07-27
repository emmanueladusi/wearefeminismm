/* Site menu: the bar carries the mark and one way in; the whole site lives in
   an overlay panel. Runs at every width, so there is one navigation to
   maintain rather than a desktop one and a mobile one that drift apart.
   Scroll is held while it is open (body.nav-open + Lenis stop), focus moves
   into the panel and returns to the button on close, and Escape always exits. */
(function () {
  var btn = document.getElementById("navBurger");
  var menu = document.getElementById("navMenu");
  if (!btn || !menu) return;

  var body = document.body;
  var panel = menu.querySelector(".menu__panel");
  var lastFocus = null;
  var open = false;              // authoritative state; never read back off a class

  function isOpen() { return open; }

  function focusables() {
    return Array.prototype.slice.call(
      panel.querySelectorAll('a[href], button:not([disabled])')
    ).filter(function (el) { return el.offsetParent !== null; });
  }

  function setOpen(on) {
    if (on === isOpen()) return;

    open = on;

    if (on) {
      // fall back to the button, so focus never lands on <body>
      lastFocus = (document.activeElement && document.activeElement !== document.body)
        ? document.activeElement : btn;
      menu.hidden = false;
      /* Force a reflow rather than waiting a frame: requestAnimationFrame does
         not fire in a backgrounded tab, which used to leave the panel in the
         DOM but never opened, and Escape unable to close it. */
      void panel.offsetWidth;
      body.classList.add("nav-open");
    } else {
      body.classList.remove("nav-open");
      // wait out the transition before removing it from the tree
      setTimeout(function () { if (!open) menu.hidden = true; }, 340);
    }

    btn.setAttribute("aria-expanded", on ? "true" : "false");
    var lenis = window.__lenis;
    if (lenis) { on ? lenis.stop() : lenis.start(); }

    if (on) {
      var f = focusables();
      if (f.length) f[0].focus();
    } else {
      (lastFocus || btn).focus();
    }
  }

  btn.addEventListener("click", function () { setOpen(!isOpen()); });

  // the scrim and the close button both carry data-menu-close
  menu.addEventListener("click", function (e) {
    if (e.target.hasAttribute("data-menu-close")) setOpen(false);
  });

  // following a link should close the panel, including to the current page
  menu.addEventListener("click", function (e) {
    if (e.target.closest(".menu__row")) setOpen(false);
  });

  document.addEventListener("keydown", function (e) {
    if (!isOpen()) return;

    if (e.key === "Escape") { setOpen(false); return; }

    /* Keep Tab inside the panel: it is a modal layer over a locked page, so
       tabbing out lands on controls the visitor cannot see or reach. */
    if (e.key === "Tab") {
      var f = focusables();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
})();
