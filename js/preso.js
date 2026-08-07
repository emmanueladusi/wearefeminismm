/* PRESO — the recap, as a piece of film.
   ------------------------------------------------------------------
   It used to be scroll-driven: the section was one viewport tall PER
   scene, pinned, and your scroll position picked the scene. That made
   the recap unskippable by design -- six screens of scrolling before
   the page would move on -- which is exactly the thing people leave
   over. It is now one screen tall and plays itself, so scrolling past
   costs a single swipe and nobody is held.

   It behaves like a video: it starts when it comes into view, pauses
   when it leaves, and there is a play/pause control. That control is
   not a nicety -- WCAG 2.0 A (2.2.2 Pause, Stop, Hide) requires one
   for anything that moves on its own for more than five seconds
   alongside other content, and this runs about twenty.

   Reduced motion and accessible mode: nothing auto-starts. The first
   scene sits there and the control reads Play, so the recap is
   reachable but never imposed. */

(function () {
  const root = document.getElementById("preso");
  if (!root) return;
  const scenes = Array.from(root.querySelectorAll(".scene"));
  if (!scenes.length) return;


  /* ---------- photos (swap these for real shots) ---------- */
  const PHOTOS = {
    vancouver: "img/preso/vancouver-1.jpg?v=1",   // skyline — inside the VANCOUVER letters
    moment: "img/preso/vancouver-2.jpg?v=1",      // the SFU handshake
    ypar: "img/preso/ypar-stage.jpg?v=1",         // on stage at YPAR — the "Findings" slide
    team: "img/preso/team.jpg?v=1",               // the team at the "ready · unconventional · fearless" wall
    room: "img/preso/room.jpg?v=1",               // spoken-word under the spotlight
    stage: "img/preso/stage.jpg?v=1",             // Emmanuel presenting at the podium (falls back to placeholder until the file is added)

  };
  function placeholder(label) {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#452f28"/><stop offset=".55" stop-color="#93485d"/>' +
      '<stop offset="1" stop-color="#ea7393"/></linearGradient></defs>' +
      '<rect width="900" height="1200" fill="url(#g)"/>' +
      '<text x="450" y="600" fill="rgba(242,239,237,.85)" font-family="monospace" font-size="44" text-anchor="middle" letter-spacing="6">' +
      label.toUpperCase() + "</text>" +
      '<text x="450" y="660" fill="rgba(242,239,237,.55)" font-family="monospace" font-size="26" text-anchor="middle" letter-spacing="4">drop photo here</text>' +
      "</svg>";
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }
  root.querySelectorAll("[data-photo]").forEach((el) => {
    const key = el.dataset.photo;
    const src = PHOTOS[key];
    const fallback = placeholder(key);
    if (!src) { el.style.backgroundImage = "url('" + fallback + "')"; return; }
    // use the real photo, but drop back to the placeholder if it 404s or fails
    // to load — so a not-yet-added shot never shows as a broken card.
    el.style.backgroundImage = "url('" + src + "')";
    const probe = new Image();
    probe.onerror = function () { el.style.backgroundImage = "url('" + fallback + "')"; };
    probe.src = src;
  });

  /* ---------- playback ---------- */

  const hudIdx  = root.querySelector("#presoIdx");
  const hudFill = root.querySelector("#presoFill");
  const playBtn = root.querySelector("#presoPlay");
  const pad = (n) => String(n + 1).padStart(2, "0");

  const HOLD = 3400;          // ms a scene is held before the next one
  const reduce = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.hasAttribute("data-a11y");

  let cur = -1, timer = null, playing = false, ended = false, inView = false;

  function show(i) {
    if (i === cur) return;
    cur = i;
    scenes.forEach((sc, k) => {
      if (k === i) {
        // re-trigger the entrance so every arrival plays it
        sc.classList.remove("is-on"); void sc.offsetWidth; sc.classList.add("is-on");
      } else {
        sc.classList.remove("is-on");
      }
    });
    if (hudIdx) hudIdx.textContent = pad(i) + " / " + pad(scenes.length - 1);
    if (hudFill) {
      // The bar fills across the scene it is on, so it reads as time passing
      // rather than as a counter ticking over.
      hudFill.style.transition = "none";
      hudFill.style.width = ((i / scenes.length) * 100).toFixed(1) + "%";
      void hudFill.offsetWidth;
      if (playing) {
        hudFill.style.transition = "width " + HOLD + "ms linear";
        hudFill.style.width = (((i + 1) / scenes.length) * 100).toFixed(1) + "%";
      }
    }
  }

  function label(state) {
    if (!playBtn) return;
    playBtn.textContent = state;
    playBtn.setAttribute("aria-label",
      state === "Pause" ? "Pause last year's recap" : "Play last year's recap");
  }

  function tick() {
    timer = setTimeout(() => {
      if (cur >= scenes.length - 1) { finish(); return; }
      show(cur + 1);
      tick();
    }, HOLD);
  }

  // Arming the bar is separate from changing scene, because a replay resumes
  // on the scene it is already showing: show() returns early when the index has
  // not moved, so the bar would never start.
  function armBar() {
    if (!hudFill || !playing) return;
    hudFill.style.transition = "none";
    hudFill.style.width = ((cur / scenes.length) * 100).toFixed(1) + "%";
    void hudFill.offsetWidth;
    hudFill.style.transition = "width " + HOLD + "ms linear";
    hudFill.style.width = (((cur + 1) / scenes.length) * 100).toFixed(1) + "%";
  }

  function play() {
    if (playing) return;
    if (ended) { ended = false; cur = -1; }
    playing = true;
    label("Pause");
    if (cur < 0) show(0);
    armBar();
    tick();
  }

  function pause() {
    if (!playing) return;
    playing = false;
    clearTimeout(timer); timer = null;
    label(ended ? "Replay" : "Play");
    if (hudFill) {                      // freeze the bar where it actually is
      const w = getComputedStyle(hudFill).width;
      hudFill.style.transition = "none";
      hudFill.style.width = w;
    }
  }

  function finish() {
    ended = true;
    pause();
    label("Replay");
    if (hudFill) { hudFill.style.transition = "none"; hudFill.style.width = "100%"; }
  }

  show(0);
  label("Play");

  // One handler. Two of them racing on the same click meant the second read
  // state the first had already flipped.
  let userPaused = false;
  if (playBtn) {
    playBtn.addEventListener("click", () => {
      if (playing) { userPaused = true; pause(); }
      else { userPaused = false; play(); }
    });
  }

  // Like a video: it runs while it is on screen and stops when it is not, so
  // it is never playing to an empty room or burning cycles below the fold.

  // Visibility by measurement, not by IntersectionObserver. Every other
  // scroll-aware module here works this way, and it is the one that can
  // actually be tested: the observer proved impossible to verify, returning a
  // callback on one run of the same page and none on the next.
  function visible() {
    const r = root.getBoundingClientRect();
    const shown = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
    return shown > 0 && shown / Math.min(r.height, innerHeight) >= 0.55;
  }

  let ticking = false;
  function check() {
    ticking = false;
    const now = visible();
    if (now === inView) return;
    inView = now;
    if (inView && !userPaused && !ended && !reduce()) play();
    else if (!inView) pause();
  }
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(check);
  }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  check();

})();
