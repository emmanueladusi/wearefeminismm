/* Descent — a watercolour underwater scene that SINKS as you scroll.

   A tall #descent section holds a sticky 100vh stage (.uw). This module
   scrubs: as you scroll through the section, it writes a single progress
   value --p (0→1) onto the stage, plus --dark (the water deepens toward
   the sea floor) and --light (the god-rays fade the deeper you go). Every
   layer in CSS parallaxes at its own --rate, so the camera feels like it
   is sinking — the foreground kelp streams up past you while the deep
   background barely drifts. A single line of copy surfaces mid-descent.

   Everything organic — kelp sway, rising bubbles, drifting plankton, the
   shimmering light shafts and the cruising fish — is pure CSS and costs
   nothing per frame; this only maps scroll → a handful of custom props,
   rAF-throttled, reading window.scrollY (which Lenis drives). Under
   prefers-reduced-motion the CSS lays the scene out as one calm still and
   this module does nothing. */

(function () {
  const section = document.getElementById("descent");
  const stage = section && section.querySelector(".uw");
  if (!section || !stage) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  // smootherstep across [a,b]
  const ramp = (p, a, b) => {
    const t = clamp01((p - a) / (b - a));
    return t * t * t * (t * (t * 6 - 15) + 10);
  };

  let top = 0;
  let len = 1;
  let ticking = false;

  function measure() {
    top = section.getBoundingClientRect().top + window.scrollY;
    len = Math.max(1, section.offsetHeight - window.innerHeight);
  }
  function progress() {
    return clamp01((window.scrollY - top) / len);
  }

  function render(p) {
    stage.style.setProperty("--p", p.toFixed(4));
    // the water deepens over the back half; the light shafts dim as we sink
    stage.style.setProperty("--dark", ramp(p, 0.35, 1).toFixed(3));
    stage.style.setProperty("--light", (1 - 0.72 * ramp(p, 0.1, 0.85)).toFixed(3));
    // the line surfaces, holds, then sinks away
    const cap = Math.min(ramp(p, 0.22, 0.42), 1 - ramp(p, 0.72, 0.92));
    stage.style.setProperty("--cap", cap.toFixed(3));
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      render(progress());
      ticking = false;
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => {
    measure();
    render(progress());
  });
  // pins elsewhere change the page height; re-measure when they settle
  if (window.ScrollTrigger && typeof window.ScrollTrigger.addEventListener === "function") {
    window.ScrollTrigger.addEventListener("refresh", () => {
      measure();
      render(progress());
    });
  }

  measure();
  render(progress());
})();
