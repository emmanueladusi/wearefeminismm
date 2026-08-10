/* ============================================================================
   Ink Garden — the piece of the month assembles out of dithered ink
   ----------------------------------------------------------------------------
   One moment, one element: the photo tile inside #popculture. As the section
   scrolls up into view the photograph builds itself out of ordered-dither ink,
   holds, then hands off to the real photograph and stops. The section already
   asks you to "sit with it for a minute" — this makes the arrival physical and
   then gets out of the way.

   Three decisions carry the whole file:

   1. The luminance grid is sampled ONCE per (image, size, cell), never per
      frame. The photograph does not change; re-reading its pixels every frame
      would be pure waste.
   2. The grid is drawn one pixel per cell into a tiny canvas and upscaled with
      smoothing off. ~3,000 fillRect calls become one putImageData and one
      drawImage, which is what makes this affordable on a Chromebook.
   3. Once resolved, the loop parks. At rest the section costs nothing at all.

   It renders nothing under prefers-reduced-motion or accessible mode: the
   plain <img> underneath is the real content, and it is what everyone else's
   markup already sees.
   ========================================================================= */
(function () {
  'use strict';

  var host = document.querySelector('.piece__photo[data-ink]');
  if (!host) return;

  var photo = host.querySelector('img');
  if (!photo || !photo.getAttribute('src')) return;

  var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;
  if (document.documentElement.hasAttribute('data-a11y')) return;
  if (!('IntersectionObserver' in window)) return;

  // ───────────────────────── device tiering ─────────────────────────
  // navigator.deviceMemory caps at 8, so an 8GB Chromebook and a 16GB Mac
  // report the same number. Core count separates them far better; the frame
  // probe below is the only signal that measures the machine rather than
  // describing it.
  var cores = navigator.hardwareConcurrency || 2;
  var mem = navigator.deviceMemory || 4;
  var tier = (cores <= 4 || mem <= 4) ? 'low' : (cores <= 6 ? 'mid' : 'high');
  function saver() { return tier === 'low'; }

  // ───────────────────────── parameters ─────────────────────────
  // Ink and paper are not the site tokens here: #popculture is the one dark
  // section on the page, so cream ink on deep violet is the right way round.
  // The paper colour sits a little under the section's own #1e1533 because the
  // bloom pass lifts every pixel slightly and lands it back on it.
  var INK = [250, 246, 239];       // warm cream, the lit cells
  var PAPER = [22, 14, 38];        // deeper than the section, bloom makes up the rest
  var TINT = [255, 138, 61];       // #ff8a3d
  var TINT_MIX = 0.25;

  var CELL = 7;                    // CSS px per cell; saver mode coarsens this
  var CONTRAST = 1.18;
  var BRIGHTNESS = 0.02;
  var DENSITY = 0.45;              // width of the dither ramp
  var EDGE = 0.55;                 // how hard edges resist the dither
  var ANIM_AMP = 0.60 * 0.30;      // shimmer amplitude, as a threshold shift
  var ANIM_SPEED = 1.0;
  var FPS_AMBIENT = 30;            // ambient shimmer; scroll bursts run uncapped

  // ───────────────────────── the ink layer ─────────────────────────
  var layer = document.createElement('div');
  layer.className = 'ink';
  layer.setAttribute('aria-hidden', 'true');

  var cv = document.createElement('canvas');
  cv.className = 'ink__canvas';

  var vig = document.createElement('span');
  vig.className = 'ink__vignette';

  layer.appendChild(cv);
  layer.appendChild(vig);
  host.appendChild(layer);

  var ctx = cv.getContext('2d', { alpha: false });
  // Bloom needs ctx.filter. Older Safari has neither, and an unsupported
  // assignment fails silently rather than throwing, so detect it properly.
  var canBloom = (function () {
    try { ctx.filter = 'blur(1px)'; var ok = ctx.filter !== 'none'; ctx.filter = 'none'; return ok; }
    catch (e) { return false; }
  })();

  // A 1024-entry sine table. Shimmer wants a sine per cell per frame; a table
  // turns each one into an array read, which is the difference between
  // invisible on an M2 and fatal on a Celeron.
  var SIN = new Float32Array(1024);
  for (var si = 0; si < 1024; si++) SIN[si] = Math.sin(si / 1024 * Math.PI * 2);
  var SINMASK = 1023;

  // 8×8 Bayer matrix, normalised 0..1. Ordered dithering: a pure lookup, with
  // no error-diffusion state to carry between cells.
  var BAYER = (function () {
    var m = [
      0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26,
      12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
      3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25,
      15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21
    ];
    var out = new Float32Array(64);
    for (var i = 0; i < 64; i++) out[i] = m[i] / 64;
    return out;
  })();

  var img = null, imgReady = false;
  var grid = null, edgeField = null, phaseHash = null;
  var cols = 0, rows = 0, gridKey = '';
  var W = 0, H = 0;

  var small = document.createElement('canvas');
  var sctx = small.getContext('2d', { alpha: false });
  var sdata = null;

  var samp = document.createElement('canvas');
  var sampctx = samp.getContext('2d', { alpha: false, willReadFrequently: true });

  // ───────────────────────── sizing ─────────────────────────
  function effectiveCell() { return saver() ? 10 : CELL; }

  function resize() {
    var r = host.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width));
    var h = Math.max(1, Math.round(r.height));
    if (w === W && h === H) return;
    W = w; H = h;
    // Dither is blocky by nature: its smallest feature is already 7 CSS px, so
    // rendering at DPR 2 doubles the blit cost for detail nobody can see.
    cv.width = W; cv.height = H;
    ctx.imageSmoothingEnabled = false;
    gridKey = '';
    buildGrid();
  }

  // ───────────────────────── one-time sampling ─────────────────────────
  function buildGrid() {
    if (!imgReady || !W || !H) return;
    var cell = effectiveCell();
    var key = W + 'x' + H + '|' + cell;
    if (key === gridKey) return;
    gridKey = key;

    cols = Math.max(1, Math.ceil(W / cell));
    rows = Math.max(1, Math.ceil(H / cell));

    // Cover-fit the photo at grid resolution, matching the object-position the
    // stylesheet uses on the <img> so the ink and the photograph are the same
    // crop and the hand-off does not jump. The browser's own downscale is the
    // box filter we want, and it runs once.
    samp.width = cols; samp.height = rows;
    var ar = img.width / img.height, tr = W / H;
    var sw, sh, sx, sy;
    if (ar > tr) { sh = img.height; sw = sh * tr; sx = (img.width - sw) * 0.38; sy = 0; }
    else { sw = img.width; sh = sw / tr; sx = 0; sy = (img.height - sh) * 0.18; }
    sampctx.drawImage(img, sx, sy, sw, sh, 0, 0, cols, rows);

    var d = sampctx.getImageData(0, 0, cols, rows).data;
    grid = new Float32Array(cols * rows);
    for (var i = 0, p = 0; i < grid.length; i++, p += 4) {
      grid[i] = (d[p] * 0.2126 + d[p + 1] * 0.7152 + d[p + 2] * 0.0722) / 255;   // Rec. 709
    }

    // Auto-levels. A two-colour dither has no tonal headroom to waste: a photo
    // that happens to sit dark reads as a solid slab, one that sits light
    // nearly vanishes. Stretching the 2nd–98th percentile means next week's
    // piece works without anyone retuning the contrast by hand. Percentiles,
    // not min/max, so one blown highlight cannot flatten everything else.
    var hist = new Uint32Array(256), N = grid.length;
    for (var q = 0; q < N; q++) hist[(grid[q] * 255) | 0]++;
    var loCut = N * 0.02, hiCut = N * 0.98, acc = 0, lo = 0, hi = 255, b;
    for (b = 0; b < 256; b++) { acc += hist[b]; if (acc >= loCut) { lo = b; break; } }
    acc = 0;
    for (b = 0; b < 256; b++) { acc += hist[b]; if (acc >= hiCut) { hi = b; break; } }
    var span = (hi - lo) / 255;
    if (span > 0.06) {
      var loF = lo / 255;
      for (var r2 = 0; r2 < N; r2++) {
        var v2 = (grid[r2] - loF) / span;
        grid[r2] = v2 < 0 ? 0 : v2 > 1 ? 1 : v2;
      }
    }

    // Sobel, once per grid rather than per frame. Ordered dithering thresholds
    // against a fixed spatial pattern, which is fine for smooth tone and
    // destructive to thin strokes — a face at podium distance gets chewed into
    // noise. Where this field is high the dither ramp collapses toward a hard
    // threshold, so structure survives while flat areas keep their texture.
    edgeField = new Float32Array(cols * rows);
    var emax = 0;
    for (var ey = 1; ey < rows - 1; ey++) {
      for (var ex = 1; ex < cols - 1; ex++) {
        var o = ey * cols + ex;
        var tl = grid[o - cols - 1], tc = grid[o - cols], trr = grid[o - cols + 1];
        var ml = grid[o - 1], mr = grid[o + 1];
        var bl = grid[o + cols - 1], bc = grid[o + cols], br = grid[o + cols + 1];
        var gx = (trr + 2 * mr + br) - (tl + 2 * ml + bl);
        var gy = (bl + 2 * bc + br) - (tl + 2 * tc + trr);
        var mag = Math.sqrt(gx * gx + gy * gy);
        edgeField[o] = mag;
        if (mag > emax) emax = mag;
      }
    }
    if (emax > 0) {
      for (var en = 0; en < edgeField.length; en++) {
        // Curve it so only genuinely strong edges count. A linear ramp would
        // treat film grain as structure and re-introduce the noise it removes.
        var v3 = edgeField[en] / emax;
        v3 = v3 * v3 * (3 - 2 * v3);
        edgeField[en] = v3 > 1 ? 1 : v3;
      }
    }

    // Shimmer needs a stable random phase per cell. Recomputing it per frame
    // would boil; as an integer offset into SIN it costs one add and one read.
    phaseHash = new Int32Array(cols * rows);
    for (var y = 0, n = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++, n++) {
        phaseHash[n] = (((x * 73856093) ^ (y * 19349663)) >>> 0) & SINMASK;
      }
    }

    small.width = cols; small.height = rows;
    sctx.imageSmoothingEnabled = false;
    sdata = sctx.createImageData(cols, rows);
    var a = sdata.data;                       // opaque; we only ever write RGB
    for (var j = 3; j < a.length; j += 4) a[j] = 255;
  }

  // ───────────────────────── the render ─────────────────────────
  var fg = [
    INK[0] + (TINT[0] - INK[0]) * TINT_MIX,
    INK[1] + (TINT[1] - INK[1]) * TINT_MIX,
    INK[2] + (TINT[2] - INK[2]) * TINT_MIX
  ];

  function render(resolve, now, animate) {
    var a = sdata.data;
    // `resolve` runs 0..1 as the tile rises into view. It biases the dither
    // threshold, which is what makes the picture feel like it is assembling
    // rather than simply fading up. The floor matters as much as the shape:
    // even unresolved, enough ink stays on to see what the photograph is.
    var thresholdBias = (1 - resolve) * 0.22;
    var spread = 0.35 + DENSITY * 0.9;

    var aamp = 0, aoff = 0;
    if (animate) {
      aamp = ANIM_AMP * (saver() ? 0.7 : 1);
      aoff = ((now * 0.001 * ANIM_SPEED * 2.4 * 1024) | 0);
    }

    var i = 0, p = 0;
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++, i++, p += 4) {
        var L = grid[i];
        L = (L - 0.5) * CONTRAST + 0.5 + BRIGHTNESS;         // pivot on mid grey
        if (L < 0) L = 0; else if (L > 1) L = 1;

        // shimmer: one add and one table read per cell, no trig
        var m = aamp ? SIN[(phaseHash[i] + aoff) & SINMASK] * aamp : 0;

        var b = BAYER[((y & 7) << 3) | (x & 7)];
        var e = EDGE * edgeField[i];
        var Le = e > 0 ? L + (L - 0.5) * e * 0.85 : L;
        if (Le < 0) Le = 0; else if (Le > 1) Le = 1;

        // Ink is the LIT half here, not the dark half: cream on violet is the
        // way round this section reads, so the test is against L, not 1 - L.
        var on = Le > (0.5 + (b - 0.5) * spread * (1 - e * 0.92) + thresholdBias + m);

        a[p] = on ? fg[0] : PAPER[0];
        a[p + 1] = on ? fg[1] : PAPER[1];
        a[p + 2] = on ? fg[2] : PAPER[2];
      }
    }

    sctx.putImageData(sdata, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, cols, rows, 0, 0, W, H);

    // Bloom. One extra additive pass over the same tiny source, blurred on the
    // way up, rather than a per-pixel glow loop — the cheapest honest version
    // of it. It lifts the dark cells a little too, which is why PAPER starts
    // below the section colour and arrives at it. Off on weak hardware.
    if (canBloom && !saver()) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.22;
      ctx.filter = 'blur(5px)';
      ctx.drawImage(small, 0, 0, cols, rows, 0, 0, W, H);
      ctx.restore();
      ctx.filter = 'none';
    }
  }

  // ───────────────────────── scroll driving ─────────────────────────
  // 0 when the tile's top touches the bottom of the viewport, 1 when its
  // centre reaches the middle of the screen.
  function rawProgress() {
    var r = host.getBoundingClientRect();
    var vh = window.innerHeight || 1;
    var denom = vh * 0.5 + r.height * 0.5;
    if (denom <= 0) return 1;
    return Math.max(0, Math.min(1, (vh - r.top) / denom));
  }

  // Once the picture has fully resolved it STAYS resolved, and the loop parks
  // for good. Dissolving it again on the way past would cost frames for
  // something already behind you, and would argue with the section's own
  // instruction to sit with the piece. It only re-arms if the tile goes fully
  // back below the fold, so scrolling up to the top and back down replays it.
  var settled = false;

  function smoothstep(v) {
    v = v < 0 ? 0 : v > 1 ? 1 : v;
    return v * v * (3 - 2 * v);
  }

  // ───────────────────────── loop ─────────────────────────
  var running = false, visible = false, idleAt = 0, lastDraw = 0;
  var probe = [], probeDone = false;

  function frame(now) {
    if (!imgReady || !sdata) { running = false; return; }

    var p = rawProgress();
    if (p >= 1) settled = true;
    else if (p <= 0) settled = false;
    var resolve = settled ? 1 : p;

    // The ink forms the picture first, then hands off to the photograph over
    // the last stretch. Two overlapping ramps, so the crossfade begins while
    // the dither is still sharpening rather than after it has finished.
    var ink = 1 - smoothstep((resolve - 0.55) / 0.45);
    layer.style.opacity = ink;

    if (ink <= 0.002) {
      // Fully handed off. Nothing left to draw, and nothing left to cost —
      // including the compositing layer, which is released here rather than
      // left pinned on a tile that has finished moving.
      layer.style.visibility = 'hidden';
      layer.style.willChange = 'auto';
      running = false;
      return;
    }
    layer.style.visibility = '';
    layer.style.willChange = 'opacity';

    var scrolling = now < idleAt;
    var animate = visible && !document.hidden;
    // Ambient shimmer does not need 60fps; pacing it at 30 halves the cost of
    // something nobody can distinguish. Scroll bursts stay uncapped so dragging
    // the page still feels immediate.
    var cap = scrolling ? (saver() ? 30 : 60) : (saver() ? 20 : FPS_AMBIENT);

    if ((now - lastDraw) >= (1000 / cap) - 0.5) {
      var t0 = performance.now();
      render(smoothstep(resolve / 0.7), now, animate);
      lastDraw = now;

      // Measure the machine instead of describing it: if it cannot hold ~45fps
      // doing this, drop a tier and coarsen the grid.
      if (!probeDone) {
        probe.push(performance.now() - t0);
        if (probe.length >= 30) {
          probeDone = true;
          var s = probe.slice().sort(function (m1, m2) { return m1 - m2; });
          if (s[15] > 8 && tier !== 'low') { tier = 'low'; gridKey = ''; buildGrid(); }
        }
      }
    }

    if (animate || scrolling) requestAnimationFrame(frame);
    else running = false;
  }

  function kick(ms) {
    idleAt = performance.now() + (ms || 400);
    if (!running) { running = true; requestAnimationFrame(frame); }
  }

  // ───────────────────────── wiring ─────────────────────────
  // Same URL as the <img>, so this is one fetch shared with it rather than a
  // second download. The <img> stays lazy; this one is not, because the grid
  // has to exist slightly before the tile arrives.
  var loader = new Image();
  loader.decoding = 'async';
  loader.onload = function () {
    img = loader; imgReady = true;
    resize(); buildGrid(); kick(800);
  };
  // On failure nothing is drawn and the plain photograph stands, which is the
  // same thing every no-JS visitor already gets.
  loader.onerror = function () { layer.remove(); };
  loader.src = photo.getAttribute('src');

  // Only run while the tile is actually on screen. Off-screen or a background
  // tab means no work at all, not merely cheaper work.
  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    if (visible) kick(800);
  }, { rootMargin: '250px' }).observe(host);

  addEventListener('scroll', function () { if (visible) kick(350); }, { passive: true });
  addEventListener('resize', function () { resize(); kick(600); });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && visible) kick(600);
  }, false);
})();
