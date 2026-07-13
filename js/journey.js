/* The journey — makes scrolling feel like moving THROUGH the page rather than
   down it (the Oryzo feeling), plus kinetic headline reveals.

   Two parts:

   1. Depth cross-dissolve. Every "flat" content section (marked data-scene)
      is treated as a plane at a depth. As it approaches the viewport centre
      it rises toward you (scale up + fade in); as it leaves it recedes
      (scale down + fade out). Combined with the colour morph behind it, you
      read the page as advancing through stages, not scrolling past them.
      A subtle scroll-velocity stretch/skew gives it physical weight.

      Sections with sticky/pinned children (#ask, #mission, #pillars) are
      deliberately NOT scened — a transform on them would break the pin — and
      they already carry the journey feel through their pins.

   2. Kinetic text. Target headlines are split into words, each masked and
      lifted into place on a stagger when the heading enters view.

   Everything is transform/opacity only (GPU-composited), the loop parks
   itself when the page is still, and the whole module is skipped under
   prefers-reduced-motion. */

(function () {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* ============================================================
     1. KINETIC TEXT — split headlines into masked, lifting words
     ============================================================ */
  const kineticTargets = document.querySelectorAll(
    ".ec-heading, .fly__statement, .wall-section__title, .bias__title, .pulse__title"
  );

  function splitWords(el) {
    const frag = document.createDocumentFragment();
    let idx = 0;
    el.childNodes.forEach((node) => {
      const isEm = node.nodeType === 1 && node.tagName === "EM";
      const text = node.textContent;
      // keep whitespace as real spaces between inline-block words
      text.split(/(\s+)/).forEach((tok) => {
        if (tok === "") return;
        if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(" ")); return; }
        const w = document.createElement("span");
        w.className = "kin";
        // keep <em> as the inner element so existing `.section em{}` colour
        // rules still apply; plain words use a span
        const inner = document.createElement(isEm ? "em" : "span");
        inner.className = "kin__i";
        inner.textContent = tok;
        inner.style.transitionDelay = Math.min(idx * 0.04, 0.5) + "s";
        idx++;
        w.appendChild(inner);
        frag.appendChild(w);
      });
    });
    el.textContent = "";
    el.appendChild(frag);
    el.classList.add("kin-ready");
  }

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("kin-in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.35, rootMargin: "0px 0px -8% 0px" }
    );
    kineticTargets.forEach((el) => {
      if (!el.textContent.trim()) return;
      el.classList.remove("reveal"); // kinetic owns this heading now (no double anim from main.js)
      splitWords(el);
      io.observe(el);
    });
  } else {
    kineticTargets.forEach((el) => el.classList.add("kin-in"));
  }

  /* ============================================================
     2. DEPTH CROSS-DISSOLVE + velocity weight
     ============================================================ */
  const scenes = Array.from(document.querySelectorAll("[data-scene]"));
  if (!scenes.length) return;
  scenes.forEach((el) => (el.style.willChange = "transform, opacity"));

  let prevY = window.scrollY;
  let vel = 0;             // smoothed scroll velocity (px/frame)
  let running = false;
  let idle = 0;

  function apply() {
    const vh = window.innerHeight;
    // read all geometry first (avoid layout thrash), then write
    const measured = scenes.map((el) => {
      const r = el.getBoundingClientRect();
      return (r.top + r.height / 2 - vh / 2) / vh; // 0 = centred, ± = off
    });

    const vScale = clamp(Math.abs(vel) * 0.0013, 0, 0.05); // vertical stretch on fast scroll
    const skew = clamp(vel * 0.007, -3, 3);                // lean into the motion

    scenes.forEach((el, i) => {
      const p = measured[i];                   // 0 = centred, +below / -above
      const ax = Math.abs(p);
      const t = clamp((ax - 0.05) / 0.72, 0, 1); // tiny dead-zone, then ramp hard
      const e = t * t * (3 - 2 * t);           // smoothstep the ramp
      const scale = 1 - 0.17 * e;              // recede toward you-ward depth (1 → 0.83)
      const opa = 1 - 0.82 * e;                // and dissolve (1 → 0.18)
      const rx = clamp(-p * 10, -11, 11);      // tilt through space: planes lean as they pass
      const ty = -p * 52;                      // counter-parallax so it feels held, not scrolled
      // (depth-of-field blur removed — the constant soft-focus on every
      //  section read as busy; the recede + fade carry the depth on their own.)
      el.style.transform =
        `perspective(1000px) translate3d(0, ${ty.toFixed(2)}px, 0) rotateX(${rx.toFixed(3)}deg) scale(${scale.toFixed(4)}) scaleY(${(1 + vScale).toFixed(4)}) skewY(${skew.toFixed(3)}deg)`;
      el.style.opacity = opa.toFixed(3);
    });
  }

  function loop() {
    const y = window.scrollY;
    const raw = y - prevY;
    prevY = y;
    vel += (raw - vel) * 0.2; // smooth toward the real delta

    apply();

    // park the loop once the page is still and the velocity has relaxed
    if (Math.abs(raw) < 0.1 && Math.abs(vel) < 0.05) {
      if (++idle > 24) { running = false; vel = 0; return; }
    } else {
      idle = 0;
    }
    requestAnimationFrame(loop);
  }

  function wake() {
    if (running) return;
    running = true;
    idle = 0;
    prevY = window.scrollY;
    requestAnimationFrame(loop);
  }

  window.addEventListener("scroll", wake, { passive: true });
  window.addEventListener("resize", () => { apply(); }, { passive: true });
  apply(); // set initial state so nothing pops on first paint
})();
