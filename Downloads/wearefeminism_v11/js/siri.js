/* Siri glow + Oryzo motion layer.

   Glow: replicates Oryzo's hero-video glow driver —
     pulse = activeRatio * (0.5 + 0.25 * (sin(0.25 * t * 2π) + 1))
   a slow 4-second breath, where activeRatio ramps toward a target
   set by the element's state: idle shimmer, hover, or focused
   ("listening"). Each keystroke adds a decaying boost so the glow
   visibly reacts while someone writes — the site listening to them.

   Cost: no WebGL, no layout work. One rAF loop that only runs while
   a glow element is on screen, writing a single CSS custom property.

   Flipper: Oryzo's text-flip hover on buttons/links, fine pointers only.
   Both features skip entirely under prefers-reduced-motion. */

(function () {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ============================ Siri glow ============================ */
  (function siriGlow() {
    if (reduceMotion) return; // CSS holds a static mid-glow instead

    const els = Array.from(document.querySelectorAll(".siri-glow"));
    if (!els.length) return;

    const states = els.map((el) => {
      const field = el.querySelector("textarea, input");
      const s = {
        el,
        ratio: 0,      // ramps toward target, like Oryzo's playingRatio
        target: 0.12,  // idle shimmer
        boost: 0,      // keystroke reaction, decays
        visible: false,
        focused: false,
        hovered: false,
      };

      function retarget() {
        s.target = s.focused ? 1 : s.hovered ? 0.45 : 0.12;
      }

      el.addEventListener("mouseenter", () => { s.hovered = true; retarget(); });
      el.addEventListener("mouseleave", () => { s.hovered = false; retarget(); });
      if (field) {
        field.addEventListener("focus", () => { s.focused = true; retarget(); });
        field.addEventListener("blur", () => { s.focused = false; retarget(); });
        field.addEventListener("input", () => { s.boost = Math.min(1, s.boost + 0.35); });
      }

      new IntersectionObserver(
        ([entry]) => {
          s.visible = entry.isIntersecting;
          if (s.visible) wake();
        },
        { threshold: 0 }
      ).observe(el);

      return s;
    });

    let running = false;
    let last = 0;

    function wake() {
      if (running) return;
      running = true;
      last = performance.now();
      requestAnimationFrame(loop);
    }

    function loop(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      // Oryzo's breath: 0.5..1.0 over a 4-second sine
      const breath = 0.5 + 0.25 * (Math.sin(0.25 * t * Math.PI * 2) + 1);

      let anyVisible = false;
      for (const s of states) {
        if (!s.visible) continue;
        anyVisible = true;
        // ramp ratio toward target (≈ Oryzo's playingRatio ramp)
        const step = dt * 1.4;
        if (s.ratio < s.target) s.ratio = Math.min(s.target, s.ratio + step);
        else if (s.ratio > s.target) s.ratio = Math.max(s.target, s.ratio - step);

        s.boost *= Math.pow(0.02, dt); // fast decay after each keystroke

        const pulse = Math.min(1, s.ratio * breath + s.boost * 0.25);
        s.el.style.setProperty("--pulse", pulse.toFixed(3));
      }

      if (anyVisible) {
        requestAnimationFrame(loop);
      } else {
        running = false;
      }
    }
  })();

  /* ============================ Flipper ============================ */
  (function flipper() {
    if (reduceMotion || !finePointer) return;

    const targets = document.querySelectorAll(
      ".btn, .cta, .nav__links a, .quick-exit, .footer__ig"
    );

    targets.forEach((el) => {
      if (el.dataset.flip !== undefined) return;
      el.dataset.flip = "";
      const original = el.innerHTML;
      el.innerHTML =
        '<span class="flip"><span class="flip__inner">' +
        '<span class="flip__copy">' + original + "</span>" +
        '<span class="flip__copy" aria-hidden="true">' + original + "</span>" +
        "</span></span>";
    });
  })();
})();
