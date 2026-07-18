/* Pulse hold — hold the screen once the thread has finished drawing the graph.
   ---------------------------------------------------------------------------
   The page-thread (js/thread.js) routes its one continuous line into the card
   and traces the graph as you scroll — the gold line flows straight into the
   chart and draws it. This module does NOT draw anything; it only watches that
   trace, and the moment the graph is fully drawn it briefly freezes the scroll
   so the finished graph holds on screen, then releases.

   The hold is safe because nothing is being drawn during it — the trace is
   already complete and the scroll is frozen, so nothing slides or redraws. It
   blocks native scroll so it can't fight anything, and releases on a scroll-up,
   a timer, or a hidden tab. Skipped for reduced motion / accessible mode /
   small touch screens. */
(function () {
  const card = document.querySelector(".sparkcard");
  if (!card) return;

  const reduced =
    (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) ||
    document.documentElement.hasAttribute("data-a11y");
  if (reduced) return;
  if (window.innerWidth < 720) return; // don't freeze touch scroll on phones

  const lenis = window.__lenis;
  if (!lenis) return;

  const spark = document.querySelector(".thread__spark"); // the thread's graph trace
  if (!spark) return;

  const HOLD_MS = 1100;

  let dir = "down", lastY = window.scrollY;
  let held = false, holding = false, timer = 0, touchY = 0;

  const onWheel = (e) => { if (!holding) return; if (e.cancelable) e.preventDefault(); if (e.deltaY < 0) release(); };
  const onTouchStart = (e) => { touchY = e.touches ? e.touches[0].clientY : 0; };
  const onTouchMove = (e) => { if (!holding) return; if (e.cancelable) e.preventDefault(); if (e.touches && e.touches[0].clientY > touchY + 6) release(); };

  function release() {
    if (!holding) return;
    holding = false;
    clearTimeout(timer);
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    lenis.start();
  }
  function hold() {
    if (held || holding) return;
    held = true;
    holding = true;
    lenis.stop();
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    timer = setTimeout(release, HOLD_MS);
  }

  // the thread's red trace is fully drawn when its dash offset has reached ~0
  function graphDrawn() {
    if (spark.style.opacity !== "1") return false;
    const off = parseFloat(spark.style.strokeDashoffset || "999");
    return off <= 1.5;
  }

  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    if (y > lastY + 0.5) dir = "down";
    else if (y < lastY - 0.5) dir = "up";
    lastY = y;
    if (held || holding || dir !== "down") return;
    const r = card.getBoundingClientRect();
    if (r.top > window.innerHeight * 0.55 || r.bottom < 0) return; // card must be up in view
    if (graphDrawn()) hold();
  }, { passive: true });

  document.addEventListener("visibilitychange", () => { if (document.hidden) release(); });

  // reset when the card leaves, so scrolling back down can hold again
  new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) { release(); held = false; }
  }, { threshold: 0 }).observe(card);
})();
