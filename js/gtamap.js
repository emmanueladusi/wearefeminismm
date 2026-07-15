/* Interactive GTA dot field (Community · "Find your people in the GTA").

   Dots trace the GTA silhouette and stay flat on the canvas — they don't move
   under the cursor, they just light up (and their neighbour links brighten) as
   the pointer passes, like a lamp sweeping across the map. The five org markers
   sit in the SVG overlay above this as little houses, each linked by a gold arc
   that draws + un-draws in a seamless loop.

   Reduced motion: one calm static frame, no interaction. */

(function () {
  const wrap = document.querySelector(".gtamap-wrap");
  const canvas = wrap && wrap.querySelector(".gtamap-canvas");
  if (!wrap || !canvas) return;
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // design coordinate space — matches the SVG overlay's viewBox exactly
  const VW = 1000, VH = 680;
  const poly = [[110,600],[80,540],[98,455],[105,395],[128,335],[118,298],[175,258],[255,238],
    [330,222],[392,214],[432,258],[462,150],[545,96],[610,132],[628,232],[665,300],
    [770,332],[910,360],[884,420],[795,410],[695,430],[612,452],[556,470],[485,488],
    [400,494],[330,489],[282,479],[232,498],[182,540],[140,578]];
  function inside(x, y) {
    let c = false, n = poly.length, j = n - 1;
    for (let i = 0; i < n; i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) c = !c;
      j = i;
    }
    return c;
  }

  // home dots on a grid clipped to the GTA shape (roomy + chunky)
  const step = 27, P = [];
  for (let gy = 28; gy < VH - 8; gy += step)
    for (let gx = 18; gx < VW - 8; gx += step) {
      const x = gx + ((Math.floor(gy / step)) % 2 ? step / 2 : 0);
      if (inside(x, gy)) P.push({ x: x, y: gy });
    }

  // neighbour links, precomputed once (faint threads between nearby dots)
  const edges = [];
  const EMAX2 = (step * 1.55) * (step * 1.55);
  for (let i = 0; i < P.length; i++)
    for (let k = i + 1; k < P.length; k++) {
      const dx = P[i].x - P[k].x, dy = P[i].y - P[k].y;
      if (dx * dx + dy * dy < EMAX2) edges.push([i, k]);
    }

  let scale = 1;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  function resize() {
    const r = wrap.getBoundingClientRect();
    if (!r.width) return;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    scale = canvas.width / VW;
  }

  let mx = -9999, my = -9999;
  wrap.addEventListener("pointermove", (e) => {
    const r = wrap.getBoundingClientRect();
    mx = (e.clientX - r.left) / r.width * VW;
    my = (e.clientY - r.top) / r.height * VH;
  }, { passive: true });
  wrap.addEventListener("pointerleave", () => { mx = my = -9999; });

  const R = 150;   // cursor "light" reach — dots stay put, only glow responds

  function draw() {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, VW, VH);

    // dots never move: they sit flat on the map, only lighting up near the cursor
    ctx.lineWidth = 0.5;
    for (let e = 0; e < edges.length; e++) {
      const a = P[edges[e][0]], b = P[edges[e][1]];
      const cx = (a.x + b.x) / 2 - mx, cy = (a.y + b.y) / 2 - my;
      const near = Math.max(0, 1 - Math.sqrt(cx * cx + cy * cy) / R);
      ctx.strokeStyle = "rgba(190,198,240," + (0.04 + near * 0.42).toFixed(3) + ")";
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    for (let n = 0; n < P.length; n++) {
      const p = P[n];
      const dx = p.x - mx, dy = p.y - my;
      const near = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / R);
      const rr = 3.6;                             // constant size — no pop toward the cursor
      if (near > 0.03) {                          // lit-up dots get a real glow
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr * 3.2);
        g.addColorStop(0, "rgba(255,221,150," + (near * 0.6).toFixed(3) + ")");
        g.addColorStop(1, "rgba(255,221,150,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, rr * 3.2, 0, 6.2832); ctx.fill();
        ctx.fillStyle = "rgba(255,236,196," + (0.5 + near * 0.5).toFixed(3) + ")";
      } else {
        ctx.fillStyle = "rgba(158,176,228,0.32)";
      }
      ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 6.2832); ctx.fill();
    }

    if (!reduce) requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener("resize", () => { resize(); if (reduce) draw(); });
  requestAnimationFrame(draw);

  // the house markers + looping arc animate only while the map is on screen
  new IntersectionObserver((ents) => {
    ents.forEach((e) => wrap.classList.toggle("is-open", e.isIntersecting));
  }, { threshold: 0.25 }).observe(wrap);
})();
