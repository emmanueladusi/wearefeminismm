/* Celebrate — a tiny, self-contained particle burst in the site's palette.
   ------------------------------------------------------------------
   No libraries, no CDN, no CSS. One shared full-screen canvas that sits
   above everything (pointer-events: none) and rains confetti in the brand
   colours to reward a correct answer, a streak, or a strong final score.

   window.Celebrate.burst(x, y, opts?)
     x, y   — viewport origin in CSS pixels (defaults to screen centre)
     opts   — { count, power, colors }

   Respects prefers-reduced-motion (becomes a no-op). A setTimeout backstop
   clears the canvas even if requestAnimationFrame is throttled (background
   tab / very low-power device), so it can never leave litter on screen. */

(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const COLORS = ["#4a3568", "#a8459e", "#d9a13f", "#9a5fa5", "#e8e0f2", "#58b389"];

  let canvas, ctx, dpr = 1, W = 0, H = 0;
  let particles = [], rafId = 0, running = false, cleanupTid = 0;

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, {
      position: "fixed", inset: "0", width: "100%", height: "100%",
      pointerEvents: "none", zIndex: "9998",
    });
    document.body.appendChild(canvas);
    resize();
    window.addEventListener("resize", resize);
  }
  function resize() {
    if (!canvas) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.width = Math.floor(window.innerWidth * dpr);
    H = canvas.height = Math.floor(window.innerHeight * dpr);
    ctx = canvas.getContext("2d");
  }

  function burst(x, y, opts) {
    if (reduce) return;
    opts = opts || {};
    ensureCanvas();
    const count = opts.count || 46;
    const power = opts.power || 9;
    const colors = opts.colors || COLORS;
    const ox = (x == null ? window.innerWidth / 2 : x) * dpr;
    const oy = (y == null ? window.innerHeight / 2 : y) * dpr;

    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.4 + Math.random()) * power * dpr;
      particles.push({
        x: ox, y: oy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 3 * dpr,     // bias the spray upward
        g: 0.3 * dpr,
        life: 0, ttl: 55 + Math.random() * 35,
        size: (4 + Math.random() * 5) * dpr,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.32,
        color: colors[i % colors.length],
      });
    }
    if (!running) { running = true; rafId = requestAnimationFrame(tick); }
    clearTimeout(cleanupTid);
    cleanupTid = setTimeout(stop, 2800); // backstop if rAF is throttled
  }

  function tick() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    let alive = 0;
    for (const p of particles) {
      if (p.life >= p.ttl) continue;
      alive++;
      p.life++;
      p.vy += p.g;
      p.x += p.vx; p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.ttl);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.62);
      ctx.restore();
    }
    if (alive > 0) rafId = requestAnimationFrame(tick);
    else stop();
  }

  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
    clearTimeout(cleanupTid);
    particles = [];
    if (ctx) ctx.clearRect(0, 0, W, H);
  }

  window.Celebrate = { burst };
})();
