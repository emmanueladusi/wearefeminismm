/* Shark word-swap — a shark swims across the line, its mouth EATING the current
   words as it passes; the next words surface behind its tail, then the whole
   shark's body is revealed as it clears. Loops through a few playful phrases.

   The fish and bubbles are pure CSS (see styles.css); this only drives the
   shark + the two text layers' clip-paths. Skipped under reduced motion. */

(function () {
  const swap = document.querySelector(".shark-swap");
  const oldEl = document.getElementById("sharkOld");
  const newEl = document.getElementById("sharkNew");
  const shark = document.getElementById("shark");
  if (!swap || !oldEl || !newEl || !shark) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const PHRASES = [
    "make waves",
    "the tide is turning",
    "rise together",
    "ride the current",
    "no calm seas here",
  ];
  const SWIM = 2800; // ms the shark takes to cross
  const HOLD = 3400; // ms the finished phrase rests before the next swim

  let idx = 0;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  oldEl.textContent = PHRASES[0];
  newEl.textContent = PHRASES[1];

  // vertical breathing room so italics/descenders never get clipped
  const PAD = "-25% ";

  function frame(now, start, W, sharkW) {
    const p = easeInOut(clamp((now - start) / SWIM, 0, 1));
    // shark travels from just off the right to just off the left; its mouth is
    // its left edge (the silhouette faces left).
    const sharkLeft = (W + sharkW) + (-(W + sharkW) - sharkW) * p; // W+sharkW → -sharkW
    const mouthX = sharkLeft;
    const tailX = sharkLeft + sharkW;

    // old words survive only to the LEFT of the mouth (right side eaten away)
    oldEl.style.clipPath = `inset(${PAD}${clamp(W - mouthX, 0, W)}px ${PAD}-6%)`;
    // new words surface only to the RIGHT of the tail (where the shark has cleared)
    newEl.style.clipPath = `inset(${PAD}-6% ${PAD}${clamp(tailX, 0, W)}px)`;

    shark.style.transform = `translate(${sharkLeft}px, -50%)`;

    if (p < 1) {
      requestAnimationFrame((t) => frame(t, start, W, sharkW));
    } else {
      // hand off: the new phrase becomes current, shark parks, queue the next
      oldEl.textContent = newEl.textContent;
      oldEl.style.clipPath = "none";
      newEl.classList.add("pop");
      shark.style.transform = "translate(-160%, -50%)";
      idx = (idx + 1) % PHRASES.length;
      setTimeout(() => {
        newEl.classList.remove("pop");
        newEl.textContent = PHRASES[(idx + 1) % PHRASES.length];
        newEl.style.clipPath = `inset(0 0 0 100%)`; // hidden, ready
        setTimeout(run, HOLD);
      }, 500);
    }
  }

  function run() {
    const W = swap.clientWidth;
    const sharkW = shark.getBoundingClientRect().width || 130;
    // seed start state so nothing flashes
    oldEl.style.clipPath = "none";
    newEl.style.clipPath = `inset(0 0 0 100%)`;
    requestAnimationFrame((t) => frame(t, t, W, sharkW));
  }

  // only start once the waves scene has actually been revealed, and give layout
  // a moment so widths are real.
  let started = false;
  function maybeStart() {
    if (started) return;
    if (!document.body.classList.contains("ask-waves-on")) return;
    started = true;
    setTimeout(run, 600);
  }
  // poll cheaply for the reveal (engulf toggles the body class)
  const iv = setInterval(() => {
    maybeStart();
    if (started) clearInterval(iv);
  }, 500);
})();
