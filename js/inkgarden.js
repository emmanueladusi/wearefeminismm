/* Ink Garden — the 21st.dev ascii-editor "dither" look, rebuilt in plain
   Canvas2D as the texture behind the Voice poster hero.

   Pipeline (from the exported params): sample the source photo into a
   9px cell grid, lift contrast (158), then ordered-Bayer dither each
   cell — a cell prints a small ink square when its luminance clears the
   Bayer threshold. bgMode "none": only the pattern prints. The "pulse"
   animation (speed 100, intensity 60) breathes the threshold up and
   down so the pattern swells and thins like ink in water.

   Source: img/preso/stage.jpg (same-origin — the 21st.dev demo photo
   can't be pixel-read cross-origin). Ink colour follows the theme.
   Reduced motion / accessible mode get one static frame. The loop
   pauses whenever the hero is off screen. */

(function () {
  const hero = document.querySelector(".hero--poster");
  if (!hero) return;

  const CELL = 9;
  const CONTRAST = 158 / 100;
  const PULSE_SPEED = 1.0;      // animSpeed 100
  const PULSE_DEPTH = 0.6;      // animIntensity 60
  const ALPHA = 0.14;           // texture, not artwork: keep the type readable
  const FPS = 24;

  const still =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.hasAttribute("data-a11y");

  const canvas = document.createElement("canvas");
  canvas.className = "inkgarden";
  canvas.setAttribute("aria-hidden", "true");
  hero.prepend(canvas);
  const ctx = canvas.getContext("2d");

  // 4x4 Bayer matrix, normalised to (0,1)
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(
    (v) => (v + 0.5) / 16
  );

  let grid = null, gw = 0, gh = 0;

  function ink() {
    const s = getComputedStyle(document.documentElement);
    return document.documentElement.getAttribute("data-theme") === "dark"
      ? (s.getPropertyValue("--cream-on-dark").trim() || "#f5efe4")
      : (s.getPropertyValue("--violet").trim() || "#4a3568");
  }

  const img = new Image();
  img.src = "img/preso/stage.jpg";

  function sample() {
    const w = window.innerWidth, h = hero.clientHeight;  /* canvas is full-bleed */
    if (!w || !h || !img.naturalWidth) return;
    canvas.width = w;
    canvas.height = h;
    gw = Math.ceil(w / CELL);
    gh = Math.ceil(h / CELL);
    const off = document.createElement("canvas");
    off.width = gw; off.height = gh;
    const octx = off.getContext("2d", { willReadFrequently: true });
    // cover-fit the photo into the grid
    const s = Math.max(gw / img.naturalWidth, gh / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    octx.drawImage(img, (gw - dw) / 2, (gh - dh) / 2, dw, dh);
    const px = octx.getImageData(0, 0, gw, gh).data;
    grid = new Float32Array(gw * gh);
    for (let i = 0; i < gw * gh; i++) {
      const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
      let l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      l = (l - 0.5) * CONTRAST + 0.5;              // contrast 158
      grid[i] = Math.min(1, Math.max(0, l));
    }
  }

  function draw(t) {
    if (!grid) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = ALPHA;
    ctx.fillStyle = ink();
    // pulse: the whole field breathes around its resting threshold
    const bias = still ? 0 : Math.sin(t * 0.0016 * PULSE_SPEED) * 0.5 * PULSE_DEPTH * 0.35;
    const dot = CELL - 2;                          // density: small gap keeps it airy
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const l = grid[y * gw + x] + bias;
        if (l > BAYER[(y % 4) * 4 + (x % 4)]) {
          ctx.fillRect(x * CELL + 1, y * CELL + 1, dot, dot);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  let running = false, rafId = null, last = 0;
  function loop(t) {
    if (!running) { rafId = null; return; }
    if (t - last >= 1000 / FPS) { last = t; draw(t); }
    rafId = requestAnimationFrame(loop);
  }
  function start() {
    if (still) { draw(0); return; }               // one static frame
    if (!running) { running = true; rafId = requestAnimationFrame(loop); }
  }
  function stop() {
    running = false;
    if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
  }

  img.onload = () => { sample(); start(); };

  new IntersectionObserver(
    (e) => { e[0].isIntersecting ? start() : stop(); },
    { threshold: 0 }
  ).observe(hero);

  let rt;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => { sample(); if (still) draw(0); }, 200);
  });

  // re-ink on theme flips
  new MutationObserver(() => { if (still) draw(0); }).observe(
    document.documentElement,
    { attributes: true, attributeFilter: ["data-theme"] }
  );
})();
