/* The Waves — the four waves of feminism, revealed INSIDE the Apple-
   Intelligence ring (#askwaves) once js/engulf.js has finished the chat beat.

   engulf.js types "Hey, what is feminism?", fires the rainbow border, fades
   the question, then FREEZES the ring and calls window.__askWaves.start().
   From there this module scrubs — as you keep scrolling through the tall #ask
   section (its sticky panel stays pinned), the ocean climbs, warms from cold
   teal toward bold magenta, the wave card cross-fades, and the dots fill in.
   The rolling + oscillating crest is pure CSS, so it costs nothing per frame.

   Progressive enhancement: under prefers-reduced-motion the CSS lays the four
   waves out as a plain readable stack and this module only makes them visible;
   there is no pin and no scrubbing. */

(function () {
  const ask = document.getElementById("ask");
  const wavesEl = document.getElementById("askwaves");
  if (!ask || !wavesEl) return;

  const cards = Array.from(wavesEl.querySelectorAll(".wavecard"));
  const dots = Array.from(wavesEl.querySelectorAll(".waves__dot"));
  const ocean = wavesEl.querySelector("#ocean");
  if (!cards.length || !ocean) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // reduced motion: CSS shows a plain readable stack — just make it visible.
  if (reduce) {
    cards.forEach((c) => c.classList.add("in"));
    return;
  }

  wavesEl.classList.add("is-live");

  const N = cards.length;
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  let askTop = 0;
  let scrubLen = 1;
  let revealed = false;
  let ticking = false;

  // the scrub runs across the part of #ask BELOW the initial pinned screen —
  // i.e. everything after the (scroll-locked) chat beat.
  function measure() {
    askTop = ask.getBoundingClientRect().top + window.scrollY;
    scrubLen = Math.max(1, ask.offsetHeight - window.innerHeight);
  }
  function progress() {
    return clamp01((window.scrollY - askTop) / scrubLen);
  }

  function render(p) {
    const seg = Math.min(N - 1, Math.floor(p * N));
    const level = 22 + p * 46; // ocean rises 22% → 68%
    ocean.style.setProperty("--level", level.toFixed(2) + "%");
    const mix = clamp01((p - 0.45) / 0.5); // warm the water over the back half
    ocean.style.setProperty("--mix", mix.toFixed(3));
    cards.forEach((c, i) => c.classList.toggle("is-active", i === seg));
    dots.forEach((d, i) => d.classList.toggle("is-active", i <= seg));
  }

  function onScroll() {
    if (!revealed || ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      render(progress());
      ticking = false;
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => {
    measure();
    if (revealed) render(progress());
  });
  // #ask grows tall (aw-cine) after this runs; re-measure on ScrollTrigger
  // refreshes (fired when the pinned deck / fly-through settle the layout).
  if (window.ScrollTrigger && typeof window.ScrollTrigger.addEventListener === "function") {
    window.ScrollTrigger.addEventListener("refresh", () => {
      measure();
      if (revealed) render(progress());
    });
  }

  // seed wave 1 so the reveal opens onto content, never a blank screen
  render(0);

  window.__askWaves = {
    start() {
      revealed = true;
      wavesEl.style.opacity = "1"; // fade the wave-screen in (transition on .askwaves)
      measure();
      render(progress());
    },
    stop() {
      revealed = false;
      wavesEl.style.opacity = "";
      render(0);
    },
  };
})();
