/* Viewport edge glow driver — Apple Intelligence-style border,
   feminism-themed (violet/gold/rose flowing around the screen).

   Moments:
     intro    — after the preloader lifts: colors sweep the perimeter
                for ~2.6s, then fade out.
     typing   — while the Wall or Pulse textareas are focused: a calm
                breathing glow that flows continuously; each keystroke
                nudges it brighter (the site listening).
     sweep    — on posting to the Wall or sending the Pulse form: one
                fast bright lap around the edge.

   Mechanics: a single rAF loop rotates --edge-angle (conic gradient
   spin = colors traveling the border) and eases --edge-pulse toward
   the current moment's target. When pulse settles at 0 the overlay is
   hidden entirely, so idle cost is zero. No WebGL. */

(function () {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const el = document.getElementById("edgeGlow");
  if (!el || reduceMotion) return;

  let pulse = 0;        // current eased intensity
  let target = 0;       // where pulse is heading
  let angle = 0;        // gradient rotation, degrees
  let speed = 40;       // degrees per second
  let boost = 0;        // keystroke reaction
  let mode = "idle";    // idle | intro | typing | sweep
  let modeUntil = 0;    // timestamp when a timed mode ends
  let focusCount = 0;   // how many glow fields are focused
  let running = false;
  let last = 0;

  function setMode(m, durationMs) {
    mode = m;
    modeUntil = durationMs ? performance.now() + durationMs : Infinity;
    if (m === "intro") { target = 0.85; speed = 120; }
    if (m === "typing") { target = 0.55; speed = 55; }
    if (m === "sweep") { target = 1; speed = 420; }
    if (m === "idle") { target = 0; speed = 40; }
    wake();
  }

  function wake() {
    if (running) return;
    running = true;
    last = performance.now();
    el.classList.add("is-active");
    requestAnimationFrame(loop);
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    // timed modes hand back to whatever state is underneath
    if (now > modeUntil) {
      setModeAfterTimed();
    }

    // breathing on top of the typing target (same 4s sine as the field glow)
    let t = target;
    if (mode === "typing") {
      const breath = 0.5 + 0.25 * (Math.sin(0.25 * (now / 1000) * Math.PI * 2) + 1);
      t = target * breath + Math.min(0.35, boost * 0.35);
    }
    boost *= Math.pow(0.02, dt);

    // ease pulse toward target
    pulse += (t - pulse) * Math.min(1, dt * 3.2);
    angle = (angle + speed * dt) % 360;

    el.style.setProperty("--edge-pulse", pulse.toFixed(3));
    el.style.setProperty("--edge-angle", angle.toFixed(1) + "deg");

    if (mode === "idle" && pulse < 0.004) {
      pulse = 0;
      el.style.setProperty("--edge-pulse", "0");
      el.classList.remove("is-active");
      running = false;
      return;
    }
    requestAnimationFrame(loop);
  }

  function setModeAfterTimed() {
    modeUntil = Infinity;
    if (focusCount > 0) setMode("typing");
    else setMode("idle");
  }

  /* ---- intro: fires when the preloader releases the page ---- */
  function intro() { setMode("intro", 2600); }

  if (document.body.classList.contains("is-loading")) {
    const mo = new MutationObserver(() => {
      if (!document.body.classList.contains("is-loading")) {
        mo.disconnect();
        setTimeout(intro, 350); // let the curtain clear first
      }
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    // reduced-motion path removes the preloader synchronously before we
    // observe; this observer simply never fires in that case (and the
    // whole module is skipped under reduced motion anyway).
  } else {
    setTimeout(intro, 350);
  }

  /* ---- typing: mirror the field glow's listening state ---- */
  ["wallText", "pulseText"].forEach((id) => {
    const field = document.getElementById(id);
    if (!field) return;
    field.addEventListener("focus", () => {
      focusCount++;
      if (mode === "idle") setMode("typing");
    });
    field.addEventListener("blur", () => {
      focusCount = Math.max(0, focusCount - 1);
      if (focusCount === 0 && mode === "typing") setMode("idle");
    });
    field.addEventListener("input", () => {
      boost = Math.min(1, boost + 0.4);
      wake();
    });
  });

  /* ---- sweep: celebrate a post or a pulse submission ---- */
  ["wallForm", "pulseForm"].forEach((id) => {
    const form = document.getElementById(id);
    if (!form) return;
    form.addEventListener("submit", () => setMode("sweep", 1100));
  });

  /* ---- external trigger: other modules can request a sweep ---- */
  window.addEventListener("edgeglow:sweep", (e) => {
    setMode("sweep", (e.detail && e.detail.duration) || 1100);
  });

  /* ---- external scrub: drive a sustained flare by intensity (0..1).
     Used by the ask section to flare the edges while the question is
     pinned. Pass level > 0 to hold a flare; level 0 releases to idle. ---- */
  window.addEventListener("edgeglow:scrub", (e) => {
    const level = e.detail ? e.detail.level : 0;
    if (level > 0.01) {
      mode = "scrub";
      modeUntil = Infinity;
      target = 0.4 + level * 0.6;   // 0.4 → 1.0
      speed = 90 + level * 160;      // colors travel faster as it intensifies
      wake();
    } else if (mode === "scrub") {
      setMode(focusCount > 0 ? "typing" : "idle");
    }
  });
})();
