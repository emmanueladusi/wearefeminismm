/* Brandmark construction reveal — "wearefeminismm".
   ------------------------------------------------------------------
   An Oryzo-style "designed in front of you" reveal: every letter is built
   from its real vector anchor points. Amber square NODES land on true
   on-curve points, amber DOTS on bézier handles (with dashed handle lines),
   dashed construction CIRCLES wrap the round letters, and a faint blueprint
   GRID sits behind. The letters are born overlapping at the centre, the
   outlines draw themselves on, the glyphs slide out to their kerned places,
   then the solid ink wordmark materialises as the whole rig dissolves.

   Themed for LIGHT PAPER (ink + amber on cream) so it sits inside the site.
   Geometry is pre-baked in js/brandmarkData.js (window.BRANDMARK_GLYPHS) —
   no font parser and no font download ship to the client.

   Driven by a paused GSAP timeline + ScrollTrigger: plays on enter, REPLAYS
   on scroll back up, pinned while it plays on wide screens (config mirrors
   pin.js so journey.js/morph stay honest — #brandmark is not data-scene).
   Narrow screens do a light fade (no pin, no rig churn). Reduced motion / no
   GSAP / no data → the finished wordmark renders statically. */

(function () {
  var NS = "http://www.w3.org/2000/svg";

  function make(tag, attrs) {
    var el = document.createElementNS(NS, tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  function init() {
    var section = document.getElementById("brandmark");
    var host = document.getElementById("brandmarkWord");
    var DATA = window.BRANDMARK_GLYPHS;
    if (!section || !host || host.__built) return;

    // No baked geometry → leave a plain readable wordmark, bail.
    if (!DATA || !DATA.glyphs || !DATA.glyphs.length) {
      host.textContent = (DATA && DATA.word) || "wearefeminismm";
      host.classList.add("brandmark__word--plain");
      host.__built = true;
      return;
    }
    host.__built = true;

    var gsap = window.gsap;
    var ST = window.ScrollTrigger;
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var narrow = window.matchMedia("(max-width: 860px)").matches;

    var FS = DATA.fontSize || 280;
    var vb = DATA.viewBox;
    var wcx = DATA.wordCenter[0], wcy = DATA.wordCenter[1];

    // decoration sizes, relative to the baked font size
    var nodeS = FS * 0.055, dotR = FS * 0.022;
    var strokeW = FS * 0.011, boxW = FS * 0.007, handleW = FS * 0.0055, circW = FS * 0.008;

    /* ---- build the SVG ---- */
    var svg = make("svg", {
      class: "bmc-svg", viewBox: vb.join(" "),
      preserveAspectRatio: "xMidYMid meet", "aria-hidden": "true",
    });

    var defs = make("defs", {});
    var grad = make("linearGradient", { id: "bmcFill", x1: "0", y1: "0", x2: "0", y2: "1" });
    grad.appendChild(make("stop", { offset: "0", "stop-color": "#3a2c52" }));
    grad.appendChild(make("stop", { offset: "1", "stop-color": "#241830" }));
    defs.appendChild(grad);
    svg.appendChild(defs);

    // blueprint grid
    var gridG = make("g", { class: "bmc-grid" });
    var cols = 8, rows = 4;
    for (var i = 0; i <= cols; i++) {
      var x = vb[0] + (vb[2] * i) / cols;
      gridG.appendChild(make("line", { x1: x, y1: vb[1], x2: x, y2: vb[1] + vb[3] }));
    }
    for (var j = 0; j <= rows; j++) {
      var y = vb[1] + (vb[3] * j) / rows;
      gridG.appendChild(make("line", { x1: vb[0], y1: y, x2: vb[0] + vb[2], y2: y }));
    }
    svg.appendChild(gridG);

    // which round letters are "heroes" (keep their circles longest)
    var roundIdx = [];
    DATA.glyphs.forEach(function (g, k) { if (g.round) roundIdx.push(k); });
    var heroSet = {};
    if (roundIdx.length) { heroSet[roundIdx[0]] = 1; heroSet[roundIdx[roundIdx.length - 1]] = 1; }

    var glyphGs = [], offsets = [], fills = [], strokes = [], nodeGs = [], handleGs = [],
        boxes = [], heroCircles = [], nonHeroCircles = [];

    DATA.glyphs.forEach(function (g, idx) {
      var gcx = g.center[0], gcy = g.center[1];
      var gg = make("g", { class: "bmc-glyph" });

      var fill = make("path", { d: g.d, class: "bmc-fill", fill: "url(#bmcFill)" });
      fill.style.opacity = 0;
      gg.appendChild(fill); fills.push(fill);

      var stroke = make("path", { d: g.d, class: "bmc-stroke", "stroke-width": strokeW });
      gg.appendChild(stroke); strokes.push(stroke);

      var box = make("rect", {
        x: g.bbox[0], y: g.bbox[1], width: g.bbox[2] - g.bbox[0], height: g.bbox[3] - g.bbox[1],
        class: "bmc-box", "stroke-width": boxW,
      });
      box.style.opacity = 0;
      gg.appendChild(box); boxes.push(box);

      if (g.round) {
        var rx = (g.bbox[2] - g.bbox[0]) / 2, ry = (g.bbox[3] - g.bbox[1]) / 2;
        var hero = !!heroSet[idx];
        var c1 = make("ellipse", { cx: gcx, cy: gcy, rx: rx, ry: ry, class: "bmc-circ", "stroke-width": circW });
        c1.style.opacity = 0;
        gg.appendChild(c1);
        (hero ? heroCircles : nonHeroCircles).push(c1);
        if (hero) {
          var c2 = make("ellipse", { cx: gcx, cy: gcy, rx: rx * 1.22, ry: ry * 1.22, class: "bmc-circ", "stroke-width": circW });
          c2.style.opacity = 0;
          gg.appendChild(c2); heroCircles.push(c2);
        }
      }

      // rig: handles + control dots (behind), then square nodes (front)
      var hg = make("g", { class: "bmc-handles" });
      g.handles.forEach(function (h) {
        hg.appendChild(make("line", { x1: h[0], y1: h[1], x2: h[2], y2: h[3], class: "bmc-handle", "stroke-width": handleW }));
      });
      g.ctrls.forEach(function (c) {
        hg.appendChild(make("circle", { cx: c[0], cy: c[1], r: dotR, class: "bmc-dot" }));
      });
      hg.style.opacity = 0;
      gg.appendChild(hg); handleGs.push(hg);

      var ng = make("g", { class: "bmc-nodes" });
      g.nodes.forEach(function (n) {
        ng.appendChild(make("rect", { x: n[0] - nodeS / 2, y: n[1] - nodeS / 2, width: nodeS, height: nodeS, class: "bmc-node" }));
      });
      ng.style.opacity = 0;
      gg.appendChild(ng); nodeGs.push(ng);

      svg.appendChild(gg);
      glyphGs.push(gg);
      offsets.push({ x: (wcx - gcx) * 0.6, y: (wcy - gcy) * 0.6, cx: gcx, cy: gcy });
    });

    host.innerHTML = "";
    host.appendChild(svg);

    /* ---- static fallback: just the finished wordmark ---- */
    function renderStatic() {
      gridG.style.opacity = 0;
      strokes.forEach(function (s) { s.style.opacity = 0; });
      boxes.forEach(function (b) { b.style.opacity = 0; });
      handleGs.concat(nodeGs).forEach(function (r) { r.style.opacity = 0; });
      heroCircles.concat(nonHeroCircles).forEach(function (c) { c.style.opacity = 0; });
      fills.forEach(function (f) { f.style.opacity = 1; });
    }

    if (reduce || !gsap || !ST) { renderStatic(); return; }
    gsap.registerPlugin(ST);

    // prep the draw-on lengths now the paths are in the DOM
    strokes.forEach(function (s) {
      var len = s.getTotalLength();
      s.style.strokeDasharray = len;
      s.style.strokeDashoffset = len;
    });
    glyphGs.forEach(function (gg, k) { gsap.set(gg, { svgOrigin: offsets[k].cx + " " + offsets[k].cy }); });

    /* ---- narrow: light fade of the finished wordmark, no pin, no rig ---- */
    if (narrow) {
      gridG.style.opacity = 0;
      strokes.forEach(function (s) { s.style.opacity = 0; });
      boxes.forEach(function (b) { b.style.opacity = 0; });
      handleGs.concat(nodeGs).forEach(function (r) { r.style.opacity = 0; });
      heroCircles.concat(nonHeroCircles).forEach(function (c) { c.style.opacity = 0; });
      var tlN = gsap.timeline({ paused: true });
      tlN.fromTo(fills, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.7, ease: "power2.out", stagger: { each: 0.03, from: "center" } });
      ST.create({
        trigger: section, start: "top 80%", end: "bottom 20%",
        onEnter: function () { tlN.restart(); }, onEnterBack: function () { tlN.restart(); },
        onLeave: function () { tlN.pause(0); }, onLeaveBack: function () { tlN.pause(0); },
      });
      ST.refresh();
      return;
    }

    /* ---- full choreography ---- */
    var allCirc = nonHeroCircles.concat(heroCircles);
    gsap.set(svg, { transformOrigin: "50% 60%" });

    var tl = gsap.timeline({ paused: true, defaults: { ease: "power2.out" } });

    // camera dolly: from the coalesced pile back out to the whole word
    tl.fromTo(svg, { scale: 1.42 }, { scale: 1, duration: 2.5, ease: "power2.inOut" }, 0);
    // letters born overlapped at centre → spread to their places
    tl.fromTo(glyphGs,
      { opacity: 0, scale: 1.45, x: function (k) { return offsets[k].x; }, y: function (k) { return offsets[k].y; } },
      { opacity: 1, scale: 1, x: 0, y: 0, duration: 1.75, ease: "power3.inOut", stagger: { each: 0.045, from: "center" } }, 0.15);
    // grid + rig fade in
    tl.fromTo(gridG, { opacity: 0 }, { opacity: 1, duration: 0.6 }, 0);
    tl.to(handleGs, { opacity: 1, duration: 0.4, stagger: { each: 0.045, from: "center" } }, 0.25);
    tl.to(nodeGs, { opacity: 1, duration: 0.4, stagger: { each: 0.045, from: "center" } }, 0.25);
    tl.to(boxes, { opacity: 1, duration: 0.4, stagger: { each: 0.045, from: "center" } }, 0.3);
    // outlines draw themselves on
    tl.to(strokes, { strokeDashoffset: 0, duration: 1.1, ease: "power1.inOut", stagger: { each: 0.045, from: "center" } }, 0.4);
    // construction circles sweep in
    tl.to(allCirc, { opacity: 1, duration: 0.55, stagger: { each: 0.05, from: "center" } }, 0.6);

    // ---- resolve ----
    tl.to(handleGs, { opacity: 0, duration: 0.5, stagger: 0.015 }, 2.15);      // handles commit first
    tl.to(fills, { opacity: 1, duration: 0.9, stagger: { each: 0.035, from: "center" } }, 2.35); // ink materialises
    tl.to(nodeGs, { opacity: 0, duration: 0.55, stagger: 0.015 }, 2.5);
    tl.to(strokes, { opacity: 0, duration: 0.55, stagger: 0.015 }, 2.55);
    tl.to(boxes, { opacity: 0, duration: 0.45 }, 2.45);
    tl.to(nonHeroCircles, { opacity: 0, duration: 0.55, stagger: 0.03 }, 2.55);
    tl.to(gridG, { opacity: 0, duration: 0.7 }, 2.7);
    tl.to(heroCircles, { opacity: 0, duration: 1.0, ease: "power2.inOut" }, 3.25); // linger, fade last

    var play = function () { tl.restart(); };
    var resetTl = function () { tl.pause(0); };

    ST.create({
      trigger: section, start: "top top", end: "+=120%",
      pin: true, pinType: "fixed", pinSpacing: true, anticipatePin: 1, invalidateOnRefresh: true,
      onEnter: play, onEnterBack: play, onLeave: resetTl, onLeaveBack: resetTl,
    });
    ST.refresh();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.HeroReveal = { init: init };
})();
