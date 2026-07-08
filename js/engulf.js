/* Ask section — "Hey, what is feminism?" pins centred on screen, then plays a
   fixed beat:
     1. the Apple-Intelligence rainbow border blooms in (~1s)
     2. it holds fully lit for 3 seconds
     3. the question text fades away (~0.9s)
   The section stays PINNED for the whole beat — scrolling is locked (via
   Lenis) the moment it pins and released only once the text has faded, so the
   sequence always plays out in full before the page moves on.

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

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion || !("IntersectionObserver" in window)) {
    if (chatText) chatText.textContent = QUESTION; // show the fully-typed prompt
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
  const BORDER_OUT = 1000; // then the border itself fades away before the pin releases

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
  const onWheel = (e) => { if (locked && e.deltaY < 0) unlock(); };            // scrolling up
  const onTouchStart = (e) => { touchStartY = e.touches ? e.touches[0].clientY : 0; };
  const onTouchMove = (e) => {
    if (locked && e.touches && e.touches[0].clientY > touchStartY + 6) unlock(); // dragging down = up
  };
  const onKey = (e) => {
    if (locked && (e.key === "ArrowUp" || e.key === "PageUp" || e.key === "Home")) unlock();
  };
  function lock() {
    const l = lenis();
    if (!l) return;
    l.stop();
    locked = true;
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
  const timers = [];
  const wait = (fn, ms) => timers.push(setTimeout(fn, ms));

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

    // then the rainbow border itself fades out — still pinned
    wait(() => stack.style.setProperty("--ag-reveal", "0"), FADE_IN + HOLD + TEXT_FADE);

    // once the border is gone, stop the animation work and release the pin
    wait(() => {
      stack.classList.remove("ag-live"); // no more rotation / warp / leak cost
      unlock();
    }, FADE_IN + HOLD + TEXT_FADE + BORDER_OUT);
  }

  function reset() {
    timers.forEach(clearTimeout);
    timers.length = 0;
    stopDistortion();
    unlock();
    played = false;
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
