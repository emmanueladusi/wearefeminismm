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
      SIM_RESOLUTION: 128,
      DYE_RESOLUTION: lean ? 512 : 1024,
      DENSITY_DISSIPATION: 1.4,   // ink lingers, then clears so paper stays clean
      VELOCITY_DISSIPATION: 0.35,
      PRESSURE: 0.8,
      CURL: 26,                   // swirl / turbulence
      SPLAT_RADIUS: 0.28,
      SPLAT_FORCE: 6200,
      SHADING: true,
      COLORFUL: false,
      SPLAT_COLOR: { r: 0.42, g: 0.29, b: 0.69 }, // brand violet ink
      BLOOM: true,
      BLOOM_INTENSITY: 0.75,
      BLOOM_THRESHOLD: 0.55,
      SUNRAYS: !lean,             // god-ray glow; skipped on lean devices
      SUNRAYS_WEIGHT: 0.9,
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

  // only spend cycles reacting while the hero is actually on screen
  let heroVisible = true;
  const hero = document.getElementById("top");
  if (hero) {
    new IntersectionObserver(
      ([entry]) => (heroVisible = entry.isIntersecting),
      { threshold: 0 }
    ).observe(hero);
  }

  window.addEventListener("mousemove", (e) => heroVisible && forward("mousemove", e), { passive: true });
  window.addEventListener("mousedown", (e) => heroVisible && forward("mousedown", e), { passive: true });
  window.addEventListener("touchstart", (e) => heroVisible && forward("mousedown", e), { passive: true });
  window.addEventListener("touchmove", (e) => heroVisible && forward("mousemove", e), { passive: true });
})();
