/* Scroll-reactive rainbow — the Apple-Intelligence ring spins faster as you scroll.

   The ring's rotation is a CSS animation (ag-spin / ag-comet-spin on .ag-stack,
   aig-spin on .aig__ring). Rather than rewrite --ag-duration — which recomputes
   progress as currentTime/duration and makes the gradient visibly JUMP — this
   reaches for the Web Animations API and just nudges playbackRate. The angle
   keeps its phase; only the rate changes, so speeding up is seamless.

   Scroll velocity (px per frame, read off window.scrollY — which Lenis drives)
   maps to a multiplier: still = 1x, a hard flick tops out at MAX. The rate
   attacks quickly and decays slowly, so the ring surges with the scroll and
   winds back down to its resting spin a beat after you stop.

   Both the rotation ("spin") and the breathing/pulse ("breathe") layers rev
   with the scroll: the spin whirls up to MAX, the breath revs a gentler amount
   so the whole glow visibly energises as you scroll, then eases back to its
   calm resting rhythm a beat after you stop.

   Cost: one rAF loop writing a number, plus a cheap animation re-scan on an
   interval (the ring's animations only exist once engulf.js goes .ag-live).
   Skipped entirely under prefers-reduced-motion. */

(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (typeof document.getAnimations !== "function") return; // no WAAPI, leave CSS alone

  const MAX = 10;         // fastest spin multiplier at a hard flick
  const GAIN = 0.09;      // px-per-frame -> multiplier (revs on a gentle scroll too)
  const ATTACK = 0.28;    // how fast it surges
  const RELEASE = 0.045;  // how slowly it winds back down
  const BREATHE_MAX = 3;  // the pulse revs too, but gentler than the spin
  const RESCAN_MS = 500;  // the ring appears mid-page; keep looking for it

  const isSpin = (a) => a.animationName && /spin/i.test(a.animationName);
  const isBreathe = (a) => a.animationName && /breathe/i.test(a.animationName);

  let spins = [];
  let breathes = [];
  let lastY = window.scrollY;
  let speed = 1;
  let running = false;

  function rescan() {
    try {
      const all = document.getAnimations();
      spins = all.filter(isSpin);
      breathes = all.filter(isBreathe);
    } catch (e) {
      spins = [];
      breathes = [];
    }
    if (spins.length || breathes.length) wake();
  }
  rescan();
  setInterval(rescan, RESCAN_MS);

  // the loop only spins while there's something to drive and something to
  // settle — otherwise it parks, so we don't tax every frame of the page.
  function wake() {
    if (running) return;
    running = true;
    requestAnimationFrame(frame);
  }

  function frame() {
    const y = window.scrollY;
    const v = Math.abs(y - lastY);
    lastY = y;

    const target = 1 + Math.min(MAX - 1, v * GAIN);
    speed += (target - speed) * (target > speed ? ATTACK : RELEASE);

    if (Math.abs(speed - 1) < 0.002) speed = 1; // settle exactly at rest

    // the breath revs too, but on a gentler curve than the spin
    const breatheRate = 1 + Math.min(BREATHE_MAX - 1, (speed - 1) * 0.3);

    for (let i = 0; i < spins.length; i++) {
      const a = spins[i];
      // a finished/cancelled animation is harmless to write to; guard anyway
      if (a.playbackRate !== speed) {
        try { a.playbackRate = speed; } catch (e) { /* detached */ }
      }
    }
    for (let i = 0; i < breathes.length; i++) {
      const a = breathes[i];
      if (a.playbackRate !== breatheRate) {
        try { a.playbackRate = breatheRate; } catch (e) { /* detached */ }
      }
    }

    // park once everything is at rest and the page is still
    if ((!spins.length && !breathes.length) || (speed === 1 && v === 0)) { running = false; return; }
    requestAnimationFrame(frame);
  }

  window.addEventListener("scroll", wake, { passive: true });

  // expose for debugging / tuning
  window.__aigSpeed = { rate: () => speed, count: () => spins.length + breathes.length };
})();
