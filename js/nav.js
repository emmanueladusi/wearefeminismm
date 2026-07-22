/* Mobile nav (≤760px): the burger opens a full-screen menu with the same
   four links + the dark/a11y toggles. Desktop nav is untouched — the burger
   only exists visually inside the mobile media query. Scroll is held while
   the menu is open (body.nav-open + Lenis stop). */
(function () {
  var burger = document.getElementById("navBurger");
  if (!burger) return;
  var body = document.body;

  function isOpen() { return body.classList.contains("nav-open"); }

  function setOpen(on) {
    if (on === isOpen()) return;
    body.classList.toggle("nav-open", on);
    burger.setAttribute("aria-expanded", on ? "true" : "false");
    burger.setAttribute("aria-label", on ? "Close menu" : "Open menu");
    var lenis = window.__lenis;
    if (lenis) { on ? lenis.stop() : lenis.start(); }
  }

  burger.addEventListener("click", function () { setOpen(!isOpen()); });

  // Tapping a link (including the current page's) should close the menu.
  var links = document.querySelectorAll(".nav__links a");
  for (var i = 0; i < links.length; i++) {
    links[i].addEventListener("click", function () { setOpen(false); });
  }

  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setOpen(false);
  });

  // Leaving mobile widths (rotation, resize) must never strand a locked body.
  window.addEventListener("resize", function () {
    if (window.innerWidth > 760) setOpen(false);
  });
})();
