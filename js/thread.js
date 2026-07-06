/* The thread — the "common factor" that ties the site together.

   One continuous SVG line runs the full height of the page, weaving
   left and right to arrive at the top of every section — introducing
   each part before you reach it. It draws itself as you scroll, the
   glowing head staying about two-thirds of a viewport ahead of you,
   with a small gold bead riding the tip.

   Built from live layout: a waypoint is measured at each section's
   top (alternating sides), a smooth cubic path is threaded through
   them, and the whole thing is rebuilt on resize and whenever
   ScrollTrigger refreshes (pin spacers change the geography).

   Reduced motion: the full line renders statically, no drawing. */

(function () {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const SECTIONS = ["paths", "grounding", "ask", "whatis", "pillars", "mission", "wall", "pulse"];
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
  const bead = document.createElementNS(NS, "circle");
  bead.setAttribute("class", "thread__bead");
  bead.setAttribute("r", "5");
  svg.appendChild(glow);
  svg.appendChild(path);
  svg.appendChild(bead);
  document.body.appendChild(svg);

  let L = 0;

  function docHeight() {
    return Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
  }

  function build() {
    const W = document.documentElement.clientWidth;
    const H = docHeight();
    svg.setAttribute("width", W);
    svg.setAttribute("height", H);
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

    // waypoints: start at a point at the very top of the page,
    // then weave to each section's top
    const pts = [{ x: W * 0.5, y: 0 }];
    let side = 0; // alternate 12% / 88%
    SECTIONS.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const y = el.offsetTop + Math.min(140, el.offsetHeight * 0.2);
      const x = W * (side % 2 === 0 ? 0.12 : 0.88);
      side++;
      pts.push({ x, y });
    });
    pts.push({ x: W * 0.5, y: H - 140 }); // settle center at the footer

    // smooth cubic through the waypoints (vertical-leaning controls)
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const cy = (b.y - a.y) * 0.55;
      d += ` C ${a.x.toFixed(1)} ${(a.y + cy).toFixed(1)}, ${b.x.toFixed(1)} ${(b.y - cy).toFixed(1)}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
    }
    path.setAttribute("d", d);
    glow.setAttribute("d", d);

    L = path.getTotalLength();
    [path, glow].forEach((p) => {
      p.style.strokeDasharray = L;
    });
    update(true);
  }

  function progress() {
    // pure scroll ratio: 0 at the very top, 1 at the bottom —
    // the line advances only as far as the reader has scrolled
    const max = docHeight() - window.innerHeight;
    if (max <= 0) return 0;
    return Math.max(0, Math.min(1, window.scrollY / max));
  }

  let queued = false;
  function update(force) {
    if (queued && !force) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      const p = reduceMotion ? 1 : progress();
      const off = L * (1 - p);
      path.style.strokeDashoffset = off;
      glow.style.strokeDashoffset = off;

      // fade the whole thread out over the last 12% so it's gone at the bottom
      const fade = p > 0.88 ? Math.max(0, 1 - (p - 0.88) / 0.12) : 1;
      svg.style.opacity = fade.toFixed(3);

      if (p > 0.001 && p < 0.999) {
        const pt = path.getPointAtLength(L * p);
        bead.setAttribute("cx", pt.x);
        bead.setAttribute("cy", pt.y);
        bead.style.opacity = 1;
      } else {
        bead.style.opacity = 0;
      }
    });
  }

  window.addEventListener("scroll", () => update(false), { passive: true });

  let rt;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(build, 200);
  });

  // pin spacers change page geography after ScrollTrigger lays out
  if (typeof ScrollTrigger !== "undefined") {
    ScrollTrigger.addEventListener("refresh", build);
  }

  // fonts/images can shift layout after load
  window.addEventListener("load", () => setTimeout(build, 50));
  build();
})();
