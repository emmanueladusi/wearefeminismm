/* Hero fluid — real GPU fluid simulation (Navier–Stokes on the GPU)
   via the webgl-fluid library (Pavel Dobryakov's WebGL-Fluid-Simulation).
   Violet/gold ink over the warm paper hero, with bloom + sunrays glow.

   The canvas lives fixed behind the whole page; the transparent hero
   reveals it. It binds pointer listeners to its own canvas, so we forward
   window pointer events to it (works through pointer-events:none because
   dispatched events skip hit-testing). Degrades to nothing on reduced
   motion or if the library/WebGL is unavailable. */

(function () {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.getElementById("fluid");
  if (!canvas || typeof WebGLFluid === "undefined" || reduceMotion) return;

  // low-end school hardware: lighter render targets, drop the priciest pass
  const lean =
    (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);

  try {
    WebGLFluid(canvas, {
      TRIGGER: "hover",       // ink follows the cursor
      IMMEDIATE: true,        // a few splats on load so the hero isn't empty
      AUTO: true,             // ambient splats keep it alive when idle
      INTERVAL: 2600,
      SIM_RESOLUTION: lean ? 48 : 64,
      DYE_RESOLUTION: lean ? 256 : 384,
      DENSITY_DISSIPATION: 1.4,   // ink lingers, then clears so paper stays clean
      VELOCITY_DISSIPATION: 0.35,
      PRESSURE: 0.8,
      CURL: 26,                   // swirl / turbulence
      SPLAT_RADIUS: 0.28,
      SPLAT_FORCE: 6200,
      SHADING: !lean,             // cheap-ish; drop it on lean hardware
      COLORFUL: false,
      SPLAT_COLOR: { r: 0.42, g: 0.29, b: 0.69 }, // brand violet ink
      // BLOOM + SUNRAYS are extra full-screen passes EVERY frame — the biggest
      // continuous GPU cost, and the sim keeps running even scrolled past. Off.
      BLOOM: false,
      SUNRAYS: false,
      TRANSPARENT: true,          // composite over the paper hero
    });
  } catch {
    return; // WebGL unavailable — hero just shows without fluid
  }

  /* Forward pointer events to the canvas so ink reacts anywhere on the
     hero, while the real UI above stays fully clickable. */
  function forward(type, e) {
    if (!e.isTrusted) return; // never re-forward our own dispatched events
    const t = e.touches ? e.touches[0] : e;
    if (!t) return;
    canvas.dispatchEvent(
      new MouseEvent(type, { clientX: t.clientX, clientY: t.clientY, bubbles: true })
    );
  }

  // only spend cycles reacting while the hero is actually on screen — and
  // once you've scrolled past it, drop the full-viewport GL layer out of the
  // compositor so it stops being repainted behind every section as you scroll
  // (the ink is only ever visible through the transparent hero anyway).
  // The webgl-fluid library checks `PAUSED` live in its render loop and skips
  // the (expensive) simulation step when it's on — and it toggles that flag on
  // a 'KeyP' keydown. So we drive its OWN pause: once the hero scrolls away, we
  // hide the canvas AND pause the Navier–Stokes solve, freeing the GPU for the
  // rest of the page. This is the fix for "smooth alone, laggy in the full site."
  let heroVisible = true;
  let simPaused = false; // mirrors the library's PAUSED (starts false)
  function setFluidPaused(paused) {
    if (paused === simPaused) return;
    // one keydown flips the library's flag; bubbles so it reaches a window- or
    // document-level listener either way.
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyP", bubbles: true }));
    simPaused = paused;
  }
  const hero = document.getElementById("top");
  if (hero) {
    new IntersectionObserver(
      ([entry]) => {
        heroVisible = entry.isIntersecting;
        canvas.style.visibility = heroVisible ? "" : "hidden";
        setFluidPaused(!heroVisible);
      },
      { threshold: 0 }
    ).observe(hero);
  }

  window.addEventListener("mousemove", (e) => heroVisible && forward("mousemove", e), { passive: true });
  window.addEventListener("mousedown", (e) => heroVisible && forward("mousedown", e), { passive: true });
  window.addEventListener("touchstart", (e) => heroVisible && forward("mousedown", e), { passive: true });
  window.addEventListener("touchmove", (e) => heroVisible && forward("mousemove", e), { passive: true });
})();
