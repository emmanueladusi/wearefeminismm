/* Underwater backdrop — the artwork scrubbed by SCROLL.

   Scroll position through the tall #ask section maps to a frame index, painted
   to a canvas behind the waves. Park the scroll and the scene holds perfectly
   still; scroll and it plays. Same scrub range waves.js uses, so the ocean, the
   cards and the artwork advance together.

   PERFORMANCE — the design is about never blocking the scroll thread:

     * Bounded memory. Holding every frame decoded is hundreds of MB (the naive
       Promise.all approach). We keep an LRU of ~20 decoded ImageBitmaps around
       the playhead and let the rest stay as compressed bytes in the HTTP cache.
     * Off-main-thread decode. createImageBitmap() decodes on a worker thread,
       so a frame never decodes synchronously inside a scroll frame. We decode a
       window AHEAD of the scroll direction so a frame is ready before it's
       needed; if it isn't, we paint the nearest frame we do have rather than
       stalling or blanking.
     * Bounded fill rate. Backing store capped by DPR and an absolute width —
       the frames are 768px wide, so a 2x retina canvas would multiply per-frame
       fill cost for no visible gain.
     * Lazy start. Frames aren't fetched until #ask nears the viewport.
     * Paint only on change. Scroll fires constantly; the frame index doesn't.

   Fail-safe: no manifest -> nothing happens, the hand-drawn .seascape stays.
   Reduced motion: paints one representative frame and never scrubs. */

(function () {
  const canvas = document.getElementById("uwscrub");
  const ask = document.getElementById("ask");
  if (!canvas || !ask) return;

  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const useBitmap = typeof createImageBitmap === "function";
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  const BASE = "img/underwater/";
  const MAX_BACKING_W = 1280;
  const MAX_DPR = 1.5;
  const LRU = 20;    // decoded bitmaps held at once
  const AHEAD = 10;  // decode this far in the scroll direction
  const BEHIND = 3;
  const IMG_WINDOW = 22; // HTMLImageElements kept around the playhead (bounds decoded-pixel memory)

  let files = [];
  let rev = "";
  const imgs = [];
  const bmps = new Map();
  const decoding = new Set();

  let N = 0;
  let askTop = 0, scrubLen = 1;
  let cur = -1;      // frame currently painted
  let lastIdx = 0;   // frame we WANT (target)
  let dir = 1;
  let ticking = false, ready = false;

  /* ---------- geometry ---------- */

  function measure() {
    askTop = ask.getBoundingClientRect().top + window.scrollY;
    scrubLen = Math.max(1, ask.offsetHeight - window.innerHeight);
  }
  const progress = () => clamp01((window.scrollY - askTop) / scrubLen);

  function sizeCanvas() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const scale = Math.min(dpr, MAX_BACKING_W / r.width);
    const w = Math.max(1, Math.round(r.width * scale));
    const h = Math.max(1, Math.round(r.height * scale));
    if (w !== canvas.width || h !== canvas.height) {
      canvas.width = w;
      canvas.height = h;
      cur = -1; // force a repaint at the new size
    }
  }

  // cover-fit, like background-size: cover
  function blit(src, sw, sh) {
    const cw = canvas.width, ch = canvas.height;
    const s = Math.max(cw / sw, ch / sh);
    const w = sw * s, h = sh * s;
    ctx.drawImage(src, (cw - w) / 2, (ch - h) / 2, w, h);
  }

  /* ---------- frame supply ---------- */

  function image(i) {
    let im = imgs[i];
    if (!im) {
      im = imgs[i] = new Image();
      im.decoding = "async";
      // ?v=rev — filenames are stable across re-extracts, so without this a
      // browser serves the previous encode's pixels from cache.
      im.src = BASE + files[i] + (rev ? "?v=" + rev : "");
    }
    return im;
  }

  // The LRU above bounds decoded ImageBitmaps — but every visited frame also
  // left a loaded HTMLImageElement in imgs[] holding its OWN decoded pixels,
  // and those were never released. Across a full 300+ frame scrub that grows
  // into hundreds of MB and crashes the tab on the way back up. Release images
  // far from the playhead; image() transparently recreates them from the HTTP
  // cache if they're revisited.
  function pruneImages() {
    for (let k = 0; k < imgs.length; k++) {
      const im = imgs[k];
      if (im && !decoding.has(k) && Math.abs(k - lastIdx) > IMG_WINDOW) {
        im.src = "";
        imgs[k] = null;
      }
    }
  }

  function evict() {
    while (bmps.size > LRU) {
      let worst = -1, worstD = -1;
      for (const k of bmps.keys()) {
        const d = Math.abs(k - lastIdx);
        if (d > worstD) { worstD = d; worst = k; }
      }
      if (worst < 0) break;
      const b = bmps.get(worst);
      bmps.delete(worst);
      if (b && b.close) b.close();
    }
  }

  function decode(i) {
    if (i < 0 || i >= N) return;
    if (bmps.has(i) || decoding.has(i)) return;
    const im = image(i);
    if (!useBitmap) return; // drawImage(img) path needs no decode step
    decoding.add(i);
    const go = () =>
      createImageBitmap(im)
        .then((b) => {
          bmps.set(i, b);
          evict();
          // repaint against the frame we currently WANT, not the one last
          // drawn — otherwise a frame arriving after a failed paint is never
          // shown and the canvas stays blank.
          if (i === lastIdx) paint(i);
        })
        .catch(() => {})
        .finally(() => decoding.delete(i));
    if (im.complete && im.naturalWidth) go();
    else im.addEventListener("load", go, { once: true });
  }

  function prefetch(i) {
    const lo = i - (dir > 0 ? BEHIND : AHEAD);
    const hi = i + (dir > 0 ? AHEAD : BEHIND);
    for (let k = lo; k <= hi; k++) decode(k);
  }

  /* ---------- painting ---------- */

  function isReady(i) {
    if (bmps.has(i)) return true;
    const im = imgs[i];
    return !!(im && im.complete && im.naturalWidth);
  }

  function paint(i) {
    const b = bmps.get(i);
    if (b) { blit(b, b.width, b.height); cur = i; return true; }
    const im = imgs[i];
    if (im && im.complete && im.naturalWidth) {
      blit(im, im.naturalWidth, im.naturalHeight);
      cur = i;
      return true;
    }
    return false; // not ready
  }

  // the target frame may still be decoding — show the closest one we have
  // rather than a blank canvas. The decode callback repaints the real frame.
  function paintNearest(target) {
    let best = -1, bestD = Infinity;
    for (const k of bmps.keys()) {
      const d = Math.abs(k - target);
      if (d < bestD) { bestD = d; best = k; }
    }
    for (let k = 0; k < N; k++) {
      if (!isReady(k)) continue;
      const d = Math.abs(k - target);
      if (d < bestD) { bestD = d; best = k; }
    }
    if (best >= 0) paint(best);
  }

  function render(p) {
    const i = Math.max(0, Math.min(N - 1, Math.round(p * (N - 1))));
    if (i !== lastIdx) { dir = i > lastIdx ? 1 : -1; lastIdx = i; }
    prefetch(i);
    pruneImages();                      // bound decoded-image memory (see above)
    if (i === cur) return;              // scroll moved, frame didn't: nothing to do
    if (!paint(i)) paintNearest(i);     // never leave the canvas blank
  }

  function onScroll() {
    if (!ready || ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      render(progress());
      ticking = false;
    });
  }

  function remeasure() {
    sizeCanvas();
    measure();
    if (ready) { cur = -1; render(progress()); }
  }

  /* ---------- boot ---------- */

  function activate() {
    document.body.classList.add("uwscrub-on"); // shows canvas, hides scenery
    sizeCanvas();
    measure();
    ready = true;

    if (reduce) {
      const i = Math.floor(N * 0.35);
      lastIdx = i;
      decode(i);
      const im = image(i);
      if (im.complete && im.naturalWidth) paint(i);
      else im.addEventListener("load", () => paint(i), { once: true });
      return;
    }

    render(progress());

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", remeasure);
    // #ask grows tall (engulf.js adds .aw-cine) after this runs — without a
    // re-measure the scrub would map to a stale scroll range.
    if (typeof ResizeObserver === "function") new ResizeObserver(remeasure).observe(ask);
    if (window.ScrollTrigger && typeof window.ScrollTrigger.addEventListener === "function") {
      window.ScrollTrigger.addEventListener("refresh", remeasure);
    }
  }

  function start() {
    fetch(BASE + "manifest.json?v=6")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no manifest"))))
      .then((m) => {
        if (!m.files || m.files.length < 2) throw new Error("not enough frames");
        files = m.files;
        N = files.length;
        rev = m.rev || "";

        const first = image(reduce ? Math.floor(N * 0.35) : 0);
        if (first.complete && first.naturalWidth) activate();
        else first.addEventListener("load", activate, { once: true });
      })
      .catch(() => {
        /* frames not extracted — leave the existing seascape alone */
      });
  }

  // don't spend the payload until the section is approaching
  if (typeof IntersectionObserver === "function") {
    const io = new IntersectionObserver(
      (es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); start(); } },
      { rootMargin: "150% 0px" }
    );
    io.observe(ask);
  } else {
    start();
  }
})();
