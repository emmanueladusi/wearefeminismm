/* Ask section — "Hey, what is feminism?" pins centred on screen, then plays a
   fixed beat:
     1. the Apple-Intelligence rainbow border blooms in (~1s)
     2. it holds fully lit while the light leak sweeps
     3. the question text fades away, then the border fades out
   The section stays PINNED and scroll is locked (via Lenis) the moment it pins.
   If left alone the beat plays out in full and releases itself once the border
   has faded. A deliberate scroll DOWN ("move on") skips straight to the end of
   the beat, and a scroll UP leaves the way you came — so you're never forced
   to sit through it. The timeline section below answers the question.

   (The waves screen that used to be revealed here is gone — the four waves
   now live in the interactive timeline, #timeline, right after this section.)

   Reduced motion / no Lenis: the border is shown and the text kept, with no
   scroll lock. */

(function () {
  const section = document.getElementById("ask");
  if (!section) return;

  const stack = section.querySelector(".ag-stack");
  const content = section.querySelector(".askpin__content");
  if (!stack || !content) return;

  const chat = document.getElementById("aiChat");
  const chatText = document.getElementById("aiChatText");
  const QUESTION = "Hey, what is feminism?";

  // Accessible mode counts as reduced motion here — otherwise the CSS-driven
  // border bloom is killed mid-animation and the beat looks broken.
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    || document.documentElement.hasAttribute("data-a11y");

  if (reduceMotion || !("IntersectionObserver" in window)) {
    // show the scene already resolved: question sent, border lit
    if (chatText) chatText.textContent = QUESTION; // fully-typed prompt
    if (chat) chat.classList.add("aichat--sent");
    stack.classList.add("ag-live");
    stack.style.setProperty("--ag-reveal", "1");
    document.body.classList.add("ask-glow-active");
    return;
  }

  const TYPE_START = 480;  // pause after the box appears before typing begins
  const CHAR_MS = 58;      // per-character typing speed
  const SEND_PAUSE = 520;  // beat between finishing typing and firing the border
  const FADE_IN = 1000;    // border blooms in
  const HOLD = 5200;       // border fully lit (long enough for the slow leak to drift across)
  const TEXT_FADE = 800;   // question fades out
  const BORDER_OUT = 1000; // the rainbow border then fades away

  const lenis = () => window.__lenis;

  // Track scroll direction so we only hold the beat when arriving from ABOVE
  // (scrolling down into it). Scrolling UP into the section must never re-lock
  // — that was the "stuck going back up" bug.
  let dir = "down";
  let lastY = window.scrollY;
  window.addEventListener(
    "scroll",
    () => {
      const y = window.scrollY;
      if (y > lastY + 0.5) dir = "down";
      else if (y < lastY - 0.5) dir = "up";
      lastY = y;
    },
    { passive: true }
  );

  // While the border is visible the scroll is HELD — we don't move on. The
  // only thing that releases the hold is the user trying to scroll UP (leaving
  // the way they came). Downward input is ignored, so the moment plays out and
  // you can't get stuck (up always frees you); the beat then releases itself
  // once the border has faded.
  let locked = false;
  let touchStartY = 0;
  let downAcc = 0;             // accumulated downward scroll while held
  const SKIP_AT = 120;        // px of deliberate downward scroll → jump to the waves
  // Scrolling UP leaves the way you came (resets the beat). Scrolling DOWN means
  // "move on" — so once you've pushed down a little we jump STRAIGHT to the
  // revealed waves (skip) rather than ignoring you until the timed beat ends.
  // The small threshold keeps a stray flick from skipping, but a real scroll
  // past always brings the waves up right after.
  const onWheel = (e) => {
    if (!locked) return;
    if (e.deltaY < 0) { unlock(); return; }        // up = leave the way you came
    downAcc += e.deltaY;                            // down = move on → reveal the waves
    if (downAcc >= SKIP_AT) skip();
  };
  const onTouchStart = (e) => { touchStartY = e.touches ? e.touches[0].clientY : 0; };
  const onTouchMove = (e) => {
    if (!locked || !e.touches) return;
    const y = e.touches[0].clientY;
    if (y > touchStartY + 6) { unlock(); return; } // dragging down = scrolling up = leave
    if (touchStartY - y >= SKIP_AT) skip();        // dragging up = scrolling down → waves
  };
  const onKey = (e) => {
    if (!locked) return;
    if (e.key === "ArrowUp" || e.key === "PageUp" || e.key === "Home") { unlock(); return; }
    if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " " || e.key === "Spacebar") skip();
  };
  function lock() {
    const l = lenis();
    if (!l) return;
    l.stop();
    locked = true;
    downAcc = 0;
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("keydown", onKey);
  }
  function unlock() {
    const l = lenis();
    if (l) l.start();
    locked = false;
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("keydown", onKey);
  }

  let played = false;
  let skipped = false;
  const timers = [];
  const wait = (fn, ms) => timers.push(setTimeout(fn, ms));

  // Skip: jump straight to the resolved beat — the question sent, the border
  // faded — and release the scroll. So the animation is never something
  // you're forced to sit through; a scroll down skips it.
  function skip() {
    if (!played || skipped) return;
    skipped = true;
    timers.forEach(clearTimeout);
    timers.length = 0;
    stopDistortion();
    if (chatText) chatText.textContent = QUESTION;
    if (chat) { chat.classList.remove("aichat--typing"); chat.classList.add("aichat--sent"); }
    if (content) content.classList.add("ask-faded");
    document.body.classList.add("ask-glow-active");
    if (stack) { stack.style.setProperty("--ag-reveal", "0"); stack.classList.remove("ag-live"); }
    unlock();
  }

  /* ---- light-leak refraction: while the streak sweeps, drag an SVG
     displacement across the question so the screen visibly warps, ramping
     the distortion up as the leak enters and back down as it leaves. Runs
     only during the ~4.6s sweep (section pinned, scroll locked), then the
     filter is detached so there's zero cost afterwards. ---- */
  const distortMap = document.getElementById("ag-distort-map");
  const LEAK_DELAY = 300;      // matches the CSS streak animation-delay
  const LEAK_DURATION = 7500;  // matches ag-sweep duration (7.5s)
  const DISTORT_PEAK = 9;      // barely-there warp — the haze drifts, it doesn't shove
  let distortRAF = 0;

  function runDistortion() {
    if (!distortMap || !content) return;
    content.style.filter = "url(#ag-distort)";
    content.style.willChange = "filter";
    const start = performance.now();
    (function step(now) {
      const s = (now - start) / LEAK_DURATION;
      if (s >= 1) {
        distortMap.setAttribute("scale", "0");
        content.style.filter = "";
        content.style.willChange = "";
        distortRAF = 0;
        return;
      }
      // distortion is tied strictly to the leak's on-screen passage: the
      // streak is only visible from ~12%→90% of the sweep, so the warp stays
      // at 0 before it appears, ramps up as it crosses, and settles back to 0
      // once it has left. The screen only distorts WHILE the leak is passing.
      const w = Math.max(0, Math.min(1, (s - 0.22) / (0.78 - 0.22)));
      const bump = Math.sin(Math.PI * w);
      distortMap.setAttribute("scale", (DISTORT_PEAK * bump).toFixed(2));
      distortRAF = requestAnimationFrame(step);
    })(start);
  }

  function stopDistortion() {
    if (distortRAF) cancelAnimationFrame(distortRAF);
    distortRAF = 0;
    if (distortMap) distortMap.setAttribute("scale", "0");
    if (content) { content.style.filter = ""; content.style.willChange = ""; }
  }

  function play() {
    if (played) return;
    played = true;

    document.body.classList.add("ask-glow-active");
    if (dir !== "up") lock(); // only hold the beat when arriving from above

    // 1. type the question into the chat box, character by character, THEN
    //    "send" it — which fires the rainbow border.
    if (chat && chatText) {
      chatText.textContent = "";
      chat.classList.remove("aichat--sent");
      wait(() => {
        chat.classList.add("aichat--typing");
        typeChar(0);
      }, TYPE_START);
    } else {
      fireBorder(); // no chat box present — just do the border
    }
  }

  function typeChar(i) {
    chatText.textContent = QUESTION.slice(0, i);
    if (i < QUESTION.length) {
      wait(() => typeChar(i + 1), CHAR_MS);
    } else {
      // done typing — hit send, pause, then fire the border
      chat.classList.remove("aichat--typing");
      chat.classList.add("aichat--sent");
      wait(fireBorder, SEND_PAUSE);
    }
  }

  function fireBorder() {
    // bloom the rainbow border in
    stack.classList.add("ag-live");
    requestAnimationFrame(() =>
      requestAnimationFrame(() => stack.style.setProperty("--ag-reveal", "1"))
    );

    // the light leak sweeps + warps the screen as it crosses
    wait(runDistortion, LEAK_DELAY);

    // after the hold, fade the chat prompt away
    wait(() => content.classList.add("ask-faded"), FADE_IN + HOLD);

    // once the question is gone, fade the border out and release the scroll —
    // the answer is the timeline waiting right below.
    wait(() => {
      stack.style.setProperty("--ag-reveal", "0");
      unlock();
    }, FADE_IN + HOLD + TEXT_FADE);
    wait(() => stack.classList.remove("ag-live"),
      FADE_IN + HOLD + TEXT_FADE + BORDER_OUT);
  }

  function reset() {
    timers.forEach(clearTimeout);
    timers.length = 0;
    stopDistortion();
    unlock();
    played = false;
    skipped = false;
    stack.classList.remove("ag-live");
    stack.style.setProperty("--ag-reveal", "0");
    content.classList.remove("ask-faded");
    if (chat) chat.classList.remove("aichat--typing", "aichat--sent");
    if (chatText) chatText.textContent = "";
    document.body.classList.remove("ask-glow-active");
  }

  // Fire the moment the section pins — i.e. its top reaches the top of the
  // viewport (root shrunk to a line at the top via the -100% bottom margin).
  new IntersectionObserver(
    ([entry]) => { if (entry.isIntersecting) play(); },
    { rootMargin: "0px 0px -100% 0px" }
  ).observe(section);

  // Reset when the section has fully left the viewport, so scrolling back up
  // replays the whole beat from the top.
  new IntersectionObserver(
    ([entry]) => { if (!entry.isIntersecting) reset(); },
    { threshold: 0 }
  ).observe(section);
})();
