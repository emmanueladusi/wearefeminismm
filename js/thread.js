/* The thread — the "common factor" that ties the site together.

   One continuous SVG line runs the full height of the page, weaving
   left and right to arrive at the top of every section — introducing
   each part before you reach it. It draws itself as you scroll, the
   glowing head staying about two-thirds of a viewport ahead of you,
   with a small gold bead riding the tip.

   THE SPARKLINE HAND-OFF (Learn page): the thread's line IS the pen.
   Where it reaches the pulse card it stops weaving and traces the
   actual chart curve as part of its one continuous stroke — no separate
   animation. As the thread's own tip passes through that stretch (driven
   by your scroll), a poll-coloured overlay (e.g. red) is revealed in
   lock-step with the tip, so the graph turns red exactly under the
   moving head, then the thread carries on down. spark.js owns the data
   and feeds the shape/colour here via window.__thread.syncSpark().

   Reduced motion: the full line renders statically, no drawing. */

(function () {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const SECTIONS = ["paths", "ask", "whatis", "pillars", "wall", "pulse"];
  const CHART_ID = "sparkSvg"; // the pulse chart the thread traces (Learn only)
  const NS = "http://www.w3.org/2000/svg";

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "thread");
  svg.setAttribute("aria-hidden", "true");

  const defs = document.createElementNS(NS, "defs");
  defs.innerHTML =
    '<linearGradient id="threadGrad" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#d9a13f"/>' +
    '<stop offset="0.35" stop-color="#8a63d2"/>' +
    '<stop offset="0.7" stop-color="#c76a9e"/>' +
    '<stop offset="1" stop-color="#d9a13f"/>' +
    "</linearGradient>";
  svg.appendChild(defs);

  const glow = document.createElementNS(NS, "path");
  glow.setAttribute("class", "thread__glow");
  const path = document.createElementNS(NS, "path");
  path.setAttribute("class", "thread__path");
  // the poll-coloured overlay revealed in lock-step with the thread's tip
  const spark = document.createElementNS(NS, "path");
  spark.setAttribute("class", "thread__spark");
  const sparkDot = document.createElementNS(NS, "circle");
  sparkDot.setAttribute("class", "thread__spark-dot");
  sparkDot.setAttribute("r", "5");
  const bead = document.createElementNS(NS, "circle");
  bead.setAttribute("class", "thread__bead");
  bead.setAttribute("r", "5");
  // invisible measuring path (used only for getTotalLength up to the chart).
  // MUST be fill:none/stroke:none or an unstyled path paints as solid black.
  const measure = document.createElementNS(NS, "path");
  measure.setAttribute("fill", "none");
  measure.setAttribute("stroke", "none");
  measure.style.pointerEvents = "none";
  svg.appendChild(glow);
  svg.appendChild(path);
  svg.appendChild(spark);
  svg.appendChild(sparkDot);
  svg.appendChild(bead);
  svg.appendChild(measure);
  document.body.appendChild(svg);

  let L = 0;
  let sparkLen = 0;   // length of the sparkline stretch
  let sparkStart = 0; // length along the main path at which the sparkline begins
  let sparkEndPt = null;
  const sparkState = { dLocal: null, color: "#ef4444" };

  function docHeight() {
    return Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
  }

  // map the chart's local viewBox (0..500 × 0..120) into page coordinates
  function chartMap() {
    const chart = document.getElementById(CHART_ID);
    if (!chart || !sparkState.dLocal) return null;
    const r = chart.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const left = r.left + window.scrollX, top = r.top + window.scrollY;
    return {
      toX: (x) => left + (x / 500) * r.width,
      toY: (y) => top + (y / 120) * r.height,
    };
  }

  // rewrite a local path's coordinate pairs into page space (M/C, all absolute)
  function mapD(dLocal, m) {
    const toks = dLocal.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
    let out = "", buf = [];
    for (const t of toks) {
      if (/[a-zA-Z]/.test(t)) out += (out ? " " : "") + t;
      else {
        buf.push(parseFloat(t));
        if (buf.length === 2) { out += ` ${m.toX(buf[0]).toFixed(1)} ${m.toY(buf[1]).toFixed(1)}`; buf = []; }
      }
    }
    return out;
  }

  function firstLast(dLocal, m) {
    const nums = (dLocal.match(/-?\d*\.?\d+/g) || []).map(Number);
    if (nums.length < 4) return null;
    return {
      start: { x: m.toX(nums[0]), y: m.toY(nums[1]) },
      end: { x: m.toX(nums[nums.length - 2]), y: m.toY(nums[nums.length - 1]) },
    };
  }

  function cubicTo(a, b) {
    // control ys kept in order (0.42 then 0.58) so the descent is always smooth
    // and monotonic — no vertical wobble, no sharp bounce at the waypoints
    const dy = b.y - a.y;
    return ` C ${a.x.toFixed(1)} ${(a.y + dy * 0.42).toFixed(1)}, ${b.x.toFixed(1)} ${(a.y + dy * 0.58).toFixed(1)}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  }

  // build a valid rgba() from either "rgb(r, g, b)" or "#hex" (appending a hex
  // alpha onto an rgb() string is invalid CSS and silently kills the filter)
  function rgba(color, a) {
    const n = (color || "").match(/\d+(\.\d+)?/g);
    if (n && n.length >= 3) return `rgba(${n[0]}, ${n[1]}, ${n[2]}, ${a})`;
    const h = /^#?([0-9a-f]{6})$/i.exec(color || "");
    if (h) {
      const v = parseInt(h[1], 16);
      return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${a})`;
    }
    return color;
  }

  function layout() {
    const W = document.documentElement.clientWidth;
    const H = docHeight();
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

    const pts = [{ x: W * 0.5, y: 0 }];
    // collect each section's y, then sort top-to-bottom so the line only ever
    // flows DOWN — never jumping back up the page (that was the sharp bounce)
    const stops = [];
    SECTIONS.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      stops.push(el.offsetTop + Math.min(140, el.offsetHeight * 0.2));
    });
    stops.sort((a, b) => a - b);
    // a gentle weave (30% / 70%) rather than a wide 12% / 88% swing — softer turns
    stops.forEach((y, i) => {
      pts.push({ x: W * (i % 2 === 0 ? 0.30 : 0.70), y });
    });
    pts.push({ x: W * 0.5, y: H - 140 }); // settle center at the footer

    // ---- weave the sparkline INTO the single continuous stroke ----
    const m = chartMap();
    const fl = m ? firstLast(sparkState.dLocal, m) : null;
    let sparkMappedD = null;
    if (m && fl) {
      sparkMappedD = mapD(sparkState.dLocal, m); // "M sx sy C ... C ..."
      // its curve commands only (drop the leading moveto; the thread routes there)
      const cmds = sparkMappedD.replace(/^M\s*-?[\d.]+\s+-?[\d.]+\s*/, "");
      let idx = pts.findIndex((p) => p.y >= fl.start.y);
      if (idx < 1) idx = pts.length - 1;
      pts.splice(idx, 0, { spark: true, start: fl.start, end: fl.end, cmds: cmds });
      sparkEndPt = fl.end;
    } else {
      sparkEndPt = null;
    }

    // build the main path; where the spark marker sits, route to its start then
    // append the chart curve, so the line flows straight through the graph.
    // The junctions use horizontal handles so the thread enters/leaves the
    // chart moving sideways (matching the sparkline's own tangent) — no kink.
    const hh = fl ? Math.max(48, (fl.end.x - fl.start.x) * 0.22) : 0;
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    let prev = pts[0];
    let prefixD = d;
    let exitHoriz = false;
    for (let i = 1; i < pts.length; i++) {
      const b = pts[i];
      if (b.spark) {
        const s = b.start;
        const c1y = (prev.y + (s.y - prev.y) * 0.55).toFixed(1);
        // ease down from prev, then flatten to horizontal arriving at the chart
        d += ` C ${prev.x.toFixed(1)} ${c1y}, ${(s.x - hh).toFixed(1)} ${s.y.toFixed(1)}, ${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
        prefixD = d;              // main-path length up to the chart start
        d += " " + b.cmds;        // the sparkline curve, start → end
        prev = b.end;
        exitHoriz = true;
      } else if (exitHoriz) {
        const c2y = (b.y - (b.y - prev.y) * 0.55).toFixed(1);
        // leave the chart moving horizontally, then ease back down to the waypoint
        d += ` C ${(prev.x + hh).toFixed(1)} ${prev.y.toFixed(1)}, ${b.x.toFixed(1)} ${c2y}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
        prev = b;
        exitHoriz = false;
      } else {
        d += cubicTo(prev, b);
        prev = b;
      }
    }
    path.setAttribute("d", d);
    glow.setAttribute("d", d);
    L = path.getTotalLength();
    [path, glow].forEach((p) => (p.style.strokeDasharray = L));

    if (sparkMappedD) {
      spark.setAttribute("d", sparkMappedD);
      spark.style.stroke = sparkState.color;
      // layered glow — bright tight core + wider halo — for a vibrant, neon feel
      spark.style.filter =
        `drop-shadow(0 0 2px ${rgba(sparkState.color, 1)}) ` +
        `drop-shadow(0 0 7px ${rgba(sparkState.color, 0.95)}) ` +
        `drop-shadow(0 0 16px ${rgba(sparkState.color, 0.7)})`;
      sparkLen = spark.getTotalLength();
      // the red overlay is full-strength but drawn only up to a point trailing
      // the tip (see update): each part turns full red just after the line
      // passes it, while the leading edge stays the thread's own purple
      spark.style.strokeDasharray = sparkLen;
      spark.style.strokeDashoffset = sparkLen;
      spark.style.opacity = "0";
      spark.style.display = "";
      sparkDot.setAttribute("cx", fl.end.x);
      sparkDot.setAttribute("cy", fl.end.y);
      sparkDot.style.fill = sparkState.color;
      sparkDot.style.display = "";
      measure.setAttribute("d", prefixD);
      sparkStart = measure.getTotalLength(); // tip length at which the chart begins
    } else {
      spark.style.display = "none";
      sparkDot.style.display = "none";
      sparkLen = 0;
      sparkStart = 0;
    }
  }

  function build() {
    layout();
    update(true);
  }

  // rebuild the geometry from the chart's LIVE position, so the sparkline stays
  // glued to the pulse card even while the card is held (sticky) in view
  let lastChartKey = null;
  function resyncSpark() {
    const chart = document.getElementById(CHART_ID);
    if (!chart || !sparkState.dLocal) return;
    const r = chart.getBoundingClientRect();
    if (r.bottom < -300 || r.top > window.innerHeight + 300) return; // off-screen
    const key = Math.round((r.top + window.scrollY) * 4);
    if (key === lastChartKey) return; // card hasn't moved — keep cached geometry
    lastChartKey = key;
    layout();
  }

  function progress() {
    const max = docHeight() - window.innerHeight;
    if (max <= 0) return 0;
    return Math.max(0, Math.min(1, window.scrollY / max));
  }

  // draw the thread up to progress p (0..1) and place the head/overlay there
  function render(p) {
    const tip = L * p;
    path.style.strokeDashoffset = L - tip;
    glow.style.strokeDashoffset = L - tip;

    const fade = p > 0.88 ? Math.max(0, 1 - (p - 0.88) / 0.12) : 1;
    svg.style.opacity = fade.toFixed(3);

    // reveal the poll colour in lock-step with the tip: the graph turns
    // colour exactly under the moving head as it traces the sparkline
    if (sparkLen) {
      const raw = tip - sparkStart;
      const lag = sparkLen * 0.02;             // red follows right behind the tip (barely any purple)
      const redReveal = Math.max(0, Math.min(sparkLen, raw - lag));
      spark.style.strokeDashoffset = (sparkLen - redReveal).toFixed(1);
      spark.style.opacity = redReveal > 0.5 ? "1" : "0";
      sparkDot.style.opacity = redReveal >= sparkLen - 0.5 ? 1 : 0;
    }

    // the bead rides the tip — including along the sparkline it's drawing
    if (p > 0.001 && p < 0.999) {
      const pt = path.getPointAtLength(tip);
      bead.setAttribute("cx", pt.x);
      bead.setAttribute("cy", pt.y);
      bead.style.opacity = 1;
    } else {
      bead.style.opacity = 0;
    }
  }

  // The head EASES toward the scroll position instead of snapping to it. Each
  // frame the drawn progress moves a fraction of the remaining distance to the
  // scroll target — an exponential ease-out — so the line glides and trails
  // gently rather than tracking the scrollbar 1:1. The loop idles once settled.
  const EASE = 0.085;
  let pCurrent = reduceMotion ? 1 : 0;
  let rafId = null;

  function tick() {
    resyncSpark(); // keep the sparkline locked to the (sticky) card
    const target = reduceMotion ? 1 : progress();
    const gap = target - pCurrent;
    if (Math.abs(gap) < 0.0002) {   // arrived — settle exactly and stop
      pCurrent = target;
      render(pCurrent);
      rafId = null;
      return;
    }
    pCurrent += gap * EASE;
    render(pCurrent);
    rafId = requestAnimationFrame(tick);
  }

  function update(force) {
    if (force) {                    // build/resize: snap into place, no glide
      pCurrent = reduceMotion ? 1 : progress();
      render(pCurrent);
      return;
    }
    if (rafId == null) rafId = requestAnimationFrame(tick);
  }

  // spark.js calls this after it computes a new shape/colour
  function syncSpark() {
    const sp = document.getElementById("sparkPath");
    if (!sp) return;
    const d = sp.getAttribute("d");
    const color = sp.style.stroke || getComputedStyle(sp).stroke || "#ef4444";
    if (d && (d !== sparkState.dLocal || color !== sparkState.color)) {
      sparkState.dLocal = d;
      sparkState.color = color;
      build();
    }
  }

  window.__thread = {
    syncSpark: syncSpark,
  };

  window.addEventListener("scroll", () => update(false), { passive: true });

  let rt;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(build, 200);
  });

  if (typeof ScrollTrigger !== "undefined") {
    ScrollTrigger.addEventListener("refresh", build);
  }

  window.addEventListener("load", () => setTimeout(build, 50));
  build();
})();
