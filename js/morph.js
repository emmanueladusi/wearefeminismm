/* Global colour-morph backdrop — the Oryzo "one living field".

   A single fixed layer (#morph, z-index -2, behind the fluid sim) whose
   colour is interpolated across the WHOLE page as you scroll. Each section
   declares its own resting colour via data-bg; the backdrop lerps between
   the section bracketing the viewport centre and the next one, so the seams
   between sections dissolve into one continuous, slowly shifting field
   instead of hard cuts.

   Sections are made transparent (body.morph-on, in CSS) so the backdrop
   shows through — EXCEPT #ask, which keeps its light paper background so the
   rainbow-border interior stays clean during its pinned beat.

   Cost: one rAF-throttled scroll handler that writes a single background
   colour. No layout thrash (offsets are cached, re-measured only on resize
   and ScrollTrigger refresh, i.e. when pins change the page height).

   Skipped under prefers-reduced-motion — sections keep their solid CSS
   backgrounds and nothing here runs. */

(function () {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const layer = document.getElementById("morph");
  if (!layer || reduceMotion) return;

  const nodes = Array.from(document.querySelectorAll("[data-bg]"));
  if (!nodes.length) return;

  // parse "#rrggbb" -> [r,g,b]
  const toRGB = (hex) => {
    const h = hex.trim().replace("#", "");
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  };

  const colors = nodes.map((n) => toRGB(n.getAttribute("data-bg")));
  let tops = [];

  // record each anchor's document-space top. Measured after layout settles
  // (and after every ScrollTrigger refresh) so GSAP pin spacers are included.
  function measure() {
    const y = window.scrollY;
    tops = nodes.map((n) => n.getBoundingClientRect().top + y);
  }

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  // smootherstep — eases the colour hand-off so it settles gently at each end
  const ease = (t) => t * t * t * (t * (t * 6 - 15) + 10);

  let paintedR = -1, paintedG = -1, paintedB = -1;

  function update() {
    const center = window.scrollY + window.innerHeight * 0.5;

    // find the segment [i, i+1] whose tops bracket the viewport centre
    let i = 0;
    while (i < tops.length - 1 && center >= tops[i + 1]) i++;

    let r, g, b;
    if (center <= tops[0]) {
      [r, g, b] = colors[0];
    } else if (i >= tops.length - 1) {
      [r, g, b] = colors[colors.length - 1];
    } else {
      const span = tops[i + 1] - tops[i] || 1;
      const t = ease(clamp01((center - tops[i]) / span));
      const a = colors[i], c = colors[i + 1];
      r = a[0] + (c[0] - a[0]) * t;
      g = a[1] + (c[1] - a[1]) * t;
      b = a[2] + (c[2] - a[2]) * t;
    }

    r = Math.round(r); g = Math.round(g); b = Math.round(b);
    if (r === paintedR && g === paintedG && b === paintedB) return; // no change
    paintedR = r; paintedG = g; paintedB = b;
    layer.style.backgroundColor = `rgb(${r},${g},${b})`;
  }

  // rAF-throttled scroll — only runs while the page is actually moving
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { update(); ticking = false; });
  }

  document.body.classList.add("morph-on");
  measure();
  update();

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => { measure(); update(); });
  window.addEventListener("load", () => { measure(); update(); });

  // pins (card deck, fly-through) change the page height when ScrollTrigger
  // sets up / refreshes — re-measure so our offsets stay honest.
  if (window.ScrollTrigger && typeof window.ScrollTrigger.addEventListener === "function") {
    window.ScrollTrigger.addEventListener("refresh", () => { measure(); update(); });
  }
  // belt-and-braces: a couple of delayed re-measures for late layout (fonts,
  // pins created after this script runs).
  setTimeout(() => { measure(); update(); }, 400);
  setTimeout(() => { measure(); update(); }, 1400);
})();
