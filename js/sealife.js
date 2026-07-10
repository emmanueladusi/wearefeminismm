/* Shark word-swap — a shark cruises across the line, its mouth EATING the
   current words as it passes; the next words surface behind its tail.

   The shark never resets its position. It swims right-to-left, waits out of
   frame while you read the phrase it just uncovered, then turns and swims
   left-to-right, eating that phrase in turn. Direction alternates forever, so
   there is no snap-back — it reads as one endless patrol.

   Whichever way it travels, its MOUTH is the leading edge and its TAIL the
   trailing one: words ahead of the mouth are still uneaten, words behind the
   tail have already surfaced. The silhouette is drawn facing left, so a
   rightward pass mirrors it with scaleX(-1) — which also swings the mouth from
   the box's left edge to its right.

   The fish and bubbles are pure CSS (see styles.css); this only drives the
   shark plus the two text layers' clip-paths. Skipped under reduced motion. */

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
  const SWIM = 3200; // ms for one crossing
  const HOLD = 3000; // ms the finished phrase rests, shark waiting off-frame

  let idx = 0;
  let dir = -1; // -1 = travelling left, +1 = travelling right
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  oldEl.textContent = PHRASES[0];
  newEl.textContent = PHRASES[1];

  // vertical breathing room so italics/descenders never get clipped
  const PAD = "-25% ";

  // where the shark's box sits at the start / end of a pass, per direction
  function span(W, sharkW) {
    return dir < 0
      ? { from: W + sharkW, to: -sharkW }   // enters right, exits left
      : { from: -sharkW, to: W + sharkW };  // enters left, exits right
  }

  function frame(now, start, W, sharkW) {
    const p = easeInOut(clamp((now - start) / SWIM, 0, 1));
    const { from, to } = span(W, sharkW);
    const boxLeft = from + (to - from) * p;

    // leading edge = mouth, trailing edge = tail
    const mouthX = dir < 0 ? boxLeft : boxLeft + sharkW;
    const tailX = dir < 0 ? boxLeft + sharkW : boxLeft;

    if (dir < 0) {
      // eating leftward: old survives LEFT of the mouth, new surfaces RIGHT of the tail
      oldEl.style.clipPath = `inset(${PAD}${clamp(W - mouthX, 0, W)}px ${PAD}-6%)`;
      newEl.style.clipPath = `inset(${PAD}-6% ${PAD}${clamp(tailX, 0, W)}px)`;
    } else {
      // eating rightward: old survives RIGHT of the mouth, new surfaces LEFT of the tail
      oldEl.style.clipPath = `inset(${PAD}-6% ${PAD}${clamp(mouthX, 0, W)}px)`;
      newEl.style.clipPath = `inset(${PAD}${clamp(W - tailX, 0, W)}px ${PAD}-6%)`;
    }

    // mirror the silhouette so it always faces the way it's swimming
    const flip = dir < 0 ? "" : " scaleX(-1)";
    shark.style.transform = `translate(${boxLeft}px, -50%)${flip}`;

    if (p < 1) {
      requestAnimationFrame((t) => frame(t, start, W, sharkW));
      return;
    }

    // pass complete: the uncovered phrase becomes current. The shark simply
    // stays where it stopped — off frame — and turns around for the next pass.
    oldEl.textContent = newEl.textContent;
    oldEl.style.clipPath = "none";
    newEl.classList.add("pop");
    idx = (idx + 1) % PHRASES.length;
    dir = -dir;

    setTimeout(() => {
      newEl.classList.remove("pop");
      newEl.textContent = PHRASES[(idx + 1) % PHRASES.length];
      // pre-hide the incoming phrase on whichever side the shark will clear from
      newEl.style.clipPath = dir < 0 ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)";
      setTimeout(run, HOLD);
    }, 500);
  }

  function run() {
    const W = swap.clientWidth;
    const sharkW = shark.getBoundingClientRect().width || 130;
    const { from } = span(W, sharkW);

    // seed the start state so nothing flashes on the turn
    oldEl.style.clipPath = "none";
    newEl.style.clipPath = dir < 0 ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)";
    shark.style.transform =
      `translate(${from}px, -50%)` + (dir < 0 ? "" : " scaleX(-1)");

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
  const iv = setInterval(() => {
    maybeStart();
    if (started) clearInterval(iv);
  }, 500);
})();
