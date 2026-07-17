/* "What we're building." sits over the colour-morph backdrop. When that
   backdrop darkens to violet the dark heading would disappear, so fade the
   heading (and its em) from ink/violet toward GOLD as the background gets
   darker — and back again as it lightens. Reads the live colour morph.js
   writes onto #morph each frame. Runs only while the deck is near the view. */
(function () {
  var heading = document.querySelector(".ec-heading");
  var morph = document.getElementById("morph");
  if (!heading || !morph) return;
  var em = heading.querySelector("em");

  var INK = [44, 33, 64], VIOLET = [74, 53, 104], GOLD = [217, 161, 63];
  function lum(r, g, b) { return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }
  function mix(a, b, t) {
    return "rgb(" + Math.round(a[0] + (b[0] - a[0]) * t) + "," +
                    Math.round(a[1] + (b[1] - a[1]) * t) + "," +
                    Math.round(a[2] + (b[2] - a[2]) * t) + ")";
  }
  function clear() { heading.style.color = ""; if (em) em.style.color = ""; }

  var running = false;
  function tick() {
    if (!document.body.classList.contains("morph-on")) { clear(); if (running) requestAnimationFrame(tick); return; }
    var m = getComputedStyle(morph).backgroundColor.match(/[\d.]+/g);
    if (m && m.length >= 3) {
      var L = lum(+m[0], +m[1], +m[2]);
      // light backdrop (L>=0.6) -> ink/violet (t=0); dark violet backdrop (L<=0.28) -> gold (t=1)
      var t = Math.max(0, Math.min(1, (0.6 - L) / 0.32));
      heading.style.color = mix(INK, GOLD, t);
      if (em) em.style.color = mix(VIOLET, GOLD, t);
    }
    if (running) requestAnimationFrame(tick);
  }

  new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) { if (!running) { running = true; requestAnimationFrame(tick); } }
      else { running = false; clear(); }
    });
  }, { rootMargin: "300px 0px" }).observe(heading.closest(".ec-section") || heading);
})();
