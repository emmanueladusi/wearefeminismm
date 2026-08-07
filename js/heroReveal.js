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
    var isHero = section.hasAttribute("data-hero"); // opening hero: full sequence plays on load

    /* data-hero-rig · the rig does not fully dissolve.
       Every letter here is drawn from its real vector anchor points, and
       that whole apparatus used to evaporate at 3.25s — the hero spent all
       of its craft in the opening two seconds and then had nothing at rest.
       This leaves a deliberate residue of it instead: the blueprint grid as
       a whisper, a sparse scatter of amber anchor nodes still sitting on
       the curves, and the two hero construction circles.

       Sparse is the whole point. Every node left up reads as an unfinished
       render; one in five reads as a drafting mark. Opacity only — no
       geometry, no colour and no motion is added, so this costs nothing at
       rest and the wordmark stays the loudest thing on the page. */
    var wantsRig = section.hasAttribute("data-hero-rig");
    /* keepEvery was 5 before the drafting sheet existed, when the nodes were
       the only residue and had to carry it alone. The sheet now carries the
       construction idea across the whole section, so the nodes step back to
       being a detail you find rather than a texture that competes with it. */
    var RIG = { grid: 0.55, node: 0.55, circ: 0.2, keepEvery: 9 };
    // Hero opens the page: don't start until the preloader curtain lifts (body
    // loses .is-loading), or the reveal plays behind it and you catch only the
    // tail. Safety-fires after the preloader's own max so it can't get stuck.
    function whenReady(cb) {
      if (!document.body.classList.contains("is-loading")) { cb(); return; }
      var t;
      var mo = new MutationObserver(function () {
        if (!document.body.classList.contains("is-loading")) { mo.disconnect(); clearTimeout(t); cb(); }
      });
      mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
      t = setTimeout(function () { mo.disconnect(); cb(); }, 6500);
    }

    var gsap = window.gsap;
    var ST = window.ScrollTrigger;
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var narrow = window.matchMedia("(max-width: 860px)").matches;
    /* The residue needs size to read. On a phone the wordmark is small
       enough that an anchor node lands on roughly a pixel, and a scatter of
       amber specks along the letter edges reads as fringing or a bad
       render, not as construction. Same call as the lede re-centring at
       this width: the idea is right, the scale is not. */
    var keepRig = wantsRig && !narrow;

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
    grad.appendChild(make("stop", { offset: "0", "stop-color": "#4e362d" }));
    grad.appendChild(make("stop", { offset: "1", "stop-color": "#2f1f1a" }));
    defs.appendChild(grad);
    svg.appendChild(defs);

    // blueprint grid
    var gridG = make("g", { class: "bmc-grid" });
    if (keepRig) {
      /* ---- the drafting sheet ----
         The 8x4 grid below is sized to the viewBox, so it only ever existed
         BEHIND the word and vanished with it — the hero had no surface, just
         flat paper. With residue on, the same idea is built as an actual
         drawing sheet: it extends far past the SVG box (.bmc-svg is
         overflow:visible) and .brandmark's own overflow:hidden crops it to
         the section, so it bleeds edge to edge without ever causing scroll.

         Two things stop this being wallpaper. The module is the wordmark's
         own: the minor step is half the baked font size and the major is a
         full one, so the squares are the letterforms' measure rather than
         an arbitrary pixel grid. And it is generated outward from 0, which
         puts a grid line exactly on the baseline.

         Then the metric rules — baseline, x-height, ascender — read off the
         real glyph bounding boxes, full width. They are what makes this a
         type drawing and not graph paper: the wordmark visibly SITS on its
         baseline instead of floating in cream. */
      var tops = DATA.glyphs.map(function (g) { return g.bbox[1]; });
      var bots = DATA.glyphs.map(function (g) { return g.bbox[3]; });
      var baseline = Math.min.apply(null, bots);          // flat letters; round ones overshoot below
      var xheight  = Math.max.apply(null, tops);          // flat x-height; round ones overshoot above
      var ascender = Math.min.apply(null, tops);          // the f

      var minor = FS / 2, major = FS;
      var x0 = vb[0] - vb[2] * 3, x1 = vb[0] + vb[2] * 4;
      var y0 = vb[1] - vb[3] * 3, y1 = vb[1] + vb[3] * 4;

      var minorG = make("g", { class: "bmc-sheet" });
      var majorG = make("g", { class: "bmc-sheet bmc-sheet--major" });
      var k, v;
      for (k = Math.ceil(x0 / minor); k * minor <= x1; k++) {
        v = k * minor;
        (v % major === 0 ? majorG : minorG).appendChild(
          make("line", { x1: v, y1: y0, x2: v, y2: y1 }));
      }
      for (k = Math.ceil(y0 / minor); k * minor <= y1; k++) {
        v = k * minor;
        (v % major === 0 ? majorG : minorG).appendChild(
          make("line", { x1: x0, y1: v, x2: x1, y2: v }));
      }
      gridG.appendChild(minorG);
      gridG.appendChild(majorG);

      var metricG = make("g", { class: "bmc-metric" });
      [baseline, xheight, ascender].forEach(function (y) {
        metricG.appendChild(make("line", { x1: x0, y1: y, x2: x1, y2: y }));
      });
      gridG.appendChild(metricG);
    } else {
      var cols = 8, rows = 4;
      for (var i = 0; i <= cols; i++) {
        var x = vb[0] + (vb[2] * i) / cols;
        gridG.appendChild(make("line", { x1: x, y1: vb[1], x2: x, y2: vb[1] + vb[3] }));
      }
      for (var j = 0; j <= rows; j++) {
        var y = vb[1] + (vb[3] * j) / rows;
        gridG.appendChild(make("line", { x1: vb[0], y1: y, x2: vb[0] + vb[2], y2: y }));
      }
    }
    svg.appendChild(gridG);

    // which round letters are "heroes" (keep their circles longest)
    var roundIdx = [];
    DATA.glyphs.forEach(function (g, k) { if (g.round) roundIdx.push(k); });
    var heroSet = {};
    if (roundIdx.length) { heroSet[roundIdx[0]] = 1; heroSet[roundIdx[roundIdx.length - 1]] = 1; }

    var glyphGs = [], offsets = [], fills = [], strokes = [], nodeGs = [], handleGs = [],
        boxes = [], heroCircles = [], nonHeroCircles = [], allNodes = [];

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
        var nr = make("rect", { x: n[0] - nodeS / 2, y: n[1] - nodeS / 2, width: nodeS, height: nodeS, class: "bmc-node" });
        ng.appendChild(nr);
        allNodes.push(nr);   // flat list so the residue can be spread across the WORD, not per letter
      });
      ng.style.opacity = 0;
      gg.appendChild(ng); nodeGs.push(ng);
      /* With residue, the anchor nodes go BEHIND the ink. Painted on top
         they read as damage — chunky amber squares breaking the letter
         edges like bad anti-aliasing. Behind, the finished ink occludes
         them and only the part of each square that overhangs the real
         contour survives, which is exactly what an anchor point looks
         like on a drawing that is still showing its construction. It also
         means the residue can never hurt legibility.
         During the reveal the fill is still transparent, so the rig reads
         exactly as it always did. */
      if (keepRig) gg.insertBefore(ng, gg.firstChild);

      svg.appendChild(gg);
      glyphGs.push(gg);
      offsets.push({ x: (wcx - gcx) * 0.6, y: (wcy - gcy) * 0.6, cx: gcx, cy: gcy });
    });

    host.innerHTML = "";
    host.appendChild(svg);

    /* Which anchor nodes survive. Taken off the flat, word-wide list so the
       survivors scatter across the whole wordmark instead of clumping into
       whichever letters happen to carry the most points. */
    var keptNodes = [], droppedNodes = [];
    allNodes.forEach(function (n, k) {
      (keepRig && k % RIG.keepEvery === 0 ? keptNodes : droppedNodes).push(n);
    });

    /* The resting state of the rig. Reused by all three render paths so a
       reduced-motion visitor and a narrow one land on the same hero as
       everyone else — they just do not watch it get there. */
    function restRig() {
      gridG.style.opacity = keepRig ? RIG.grid : 0;
      heroCircles.forEach(function (c) { c.style.opacity = keepRig ? RIG.circ : 0; });
      keptNodes.forEach(function (n) { n.style.opacity = RIG.node; });
      droppedNodes.forEach(function (n) { n.style.opacity = 0; });
      // the node GROUPS stay up when there is residue; the per-node opacity
      // above is what actually decides which marks are left standing
      nodeGs.forEach(function (r) { r.style.opacity = keepRig ? 1 : 0; });
    }

    /* ---- static fallback: just the finished wordmark ---- */
    function renderStatic() {
      strokes.forEach(function (s) { s.style.opacity = 0; });
      boxes.forEach(function (b) { b.style.opacity = 0; });
      handleGs.forEach(function (r) { r.style.opacity = 0; });
      nonHeroCircles.forEach(function (c) { c.style.opacity = 0; });
      fills.forEach(function (f) { f.style.opacity = 1; });
      restRig();
    }

    if (reduce || !gsap || !ST) {
      try { console.log("[wordcycle] reveal path = STATIC (reduce=" + reduce + " gsap=" + !!gsap + " ST=" + !!ST + ") — NO reveal, NO cycle"); } catch (e) {}
      renderStatic(); return;
    }
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
      try { console.log("[wordcycle] reveal path = NARROW (width<=860) — plain fade, NO word-cycle. Widen the window."); } catch (e) {}
      strokes.forEach(function (s) { s.style.opacity = 0; });
      boxes.forEach(function (b) { b.style.opacity = 0; });
      handleGs.forEach(function (r) { r.style.opacity = 0; });
      nonHeroCircles.forEach(function (c) { c.style.opacity = 0; });
      restRig();
      var tlN = gsap.timeline({ paused: true });
      tlN.fromTo(fills, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.7, ease: "power2.out", stagger: { each: 0.03, from: "center" } });
      ST.create({
        trigger: section, start: "top 80%", end: "bottom 20%",
        onEnter: isHero ? function () {} : function () { tlN.restart(); },
        onEnterBack: isHero ? function () {} : function () { tlN.restart(); },
        onLeave: isHero ? function () {} : function () { tlN.pause(0); },
        onLeaveBack: isHero ? function () {} : function () { tlN.pause(0); },
      });
      ST.refresh();
      if (isHero) whenReady(function () { tlN.restart(); }); // opening fade plays on load
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
    tl.to(strokes, { opacity: 0, duration: 0.55, stagger: 0.015 }, 2.55);
    tl.to(boxes, { opacity: 0, duration: 0.45 }, 2.45);
    tl.to(nonHeroCircles, { opacity: 0, duration: 0.55, stagger: 0.03 }, 2.55);

    if (keepRig) {
      /* The rig settles instead of leaving. Same beats, same order — the
         marks that stay simply stop at their resting value rather than 0,
         so the ending reads as the drawing being FINISHED rather than the
         scaffolding being taken away. The survivors ease down last and
         slowest, which is what makes them look chosen rather than left. */
      tl.to(droppedNodes, { opacity: 0, duration: 0.55, stagger: 0.004 }, 2.5);
      tl.to(gridG, { opacity: RIG.grid, duration: 0.7 }, 2.7);
      tl.to(keptNodes, { opacity: RIG.node, duration: 0.9, ease: "power2.inOut", stagger: 0.012 }, 2.95);
      tl.to(heroCircles, { opacity: RIG.circ, duration: 1.0, ease: "power2.inOut" }, 3.25);
    } else {
      tl.to(nodeGs, { opacity: 0, duration: 0.55, stagger: 0.015 }, 2.5);
      tl.to(gridG, { opacity: 0, duration: 0.7 }, 2.7);
      tl.to(heroCircles, { opacity: 0, duration: 1.0, ease: "power2.inOut" }, 3.25); // linger, fade last
    }

    /* ---- hard scroll-lock while the reveal plays ----
       Pinning alone only holds the section in place — a fast scroll still
       blows through the pin range before the animation finishes. So when you
       arrive from above we LOCK scrolling outright (Lenis stop + we swallow
       wheel / touch / scroll-keys) and release the instant the timeline
       completes. A safety cap unlocks no matter what, so no one is ever stuck.
       We lock only on downward entry — scrolling back up past it must never
       trap you. */
    var lenis = function () { return window.__lenis; };
    var SCROLL_KEYS = { " ": 1, "Spacebar": 1, "PageDown": 1, "PageUp": 1,
                        "ArrowDown": 1, "ArrowUp": 1, "Home": 1, "End": 1 };
    var swallow = function (e) { e.preventDefault(); };
    var swallowKey = function (e) { if (SCROLL_KEYS[e.key]) e.preventDefault(); };
    var locked = false, lockTimer = null;

    function lockScroll() {
      if (locked) return;
      locked = true;
      var l = lenis(); if (l) l.stop();
      window.addEventListener("wheel", swallow, { passive: false });
      window.addEventListener("touchmove", swallow, { passive: false });
      window.addEventListener("keydown", swallowKey, { passive: false });
    }
    function unlockScroll() {
      if (!locked) return;
      locked = false;
      clearTimeout(lockTimer);
      var l = lenis(); if (l) l.start();
      window.removeEventListener("wheel", swallow, { passive: false });
      window.removeEventListener("touchmove", swallow, { passive: false });
      window.removeEventListener("keydown", swallowKey, { passive: false });
    }
    // brandmarkCycle.js releases the lock when ITS gold sweep finishes, so the
    // page stays locked through the whole title sequence (reveal + word-cycle +
    // sweep), not just the reveal. Expose the unlock for it to call.
    window.__brandmarkUnlock = unlockScroll;

    // when the reveal finishes, hand off to the word-cycle (which unlocks when
    // done); if the cycle module isn't present, unlock right away.
    tl.eventCallback("onComplete", function () {
      try { console.log("[wordcycle] reveal onComplete fired; cycle module present = " + !!window.__brandmarkCycle); } catch (e) {}
      // hand off to the word-cycle (weare → iam → youare + gold sweep); it
      // unlocks when its sweep finishes. No cycle module → unlock now.
      if (window.__brandmarkCycle) window.__brandmarkCycle.start();
      else unlockScroll();
    });

    var playLocked = function () {
      try { console.log("[wordcycle] reveal path = FULL — reveal playing now, cycle will follow on completion"); } catch (e) {}
      if (window.__brandmarkCycle) window.__brandmarkCycle.reset();
      tl.restart();
      lockScroll();
      clearTimeout(lockTimer);
      // safety cap covers reveal + cycle + sweep (~9s) so no one is ever stuck
      lockTimer = setTimeout(unlockScroll, tl.duration() * 1000 + 9000);
    };
    var play = function () {                            // replay without locking (coming back up)
      if (window.__brandmarkCycle) window.__brandmarkCycle.reset();
      tl.restart();
    };
    var resetTl = function () {
      tl.pause(0);
      if (window.__brandmarkCycle) window.__brandmarkCycle.reset();
      unlockScroll();
    };

    // The hero plays its full sequence ONCE (on load, below) and then STAYS on
    // the finished wordmark — no reset on leave, no rebuild on return — so it
    // never blanks out while you scroll. (Mid-page use keeps the replay logic.)
    var noop = function () {};
    // Mid-page uses pin the section and lock scroll while it plays. The hero
    // does NOT pin or lock — it plays once on load and lets you scroll freely
    // through the intro (no held frame stuck to the screen).
    ST.create({
      trigger: section, start: "top top", end: "+=120%",
      pin: !isHero, pinType: "fixed", pinSpacing: !isHero, anticipatePin: 1, invalidateOnRefresh: true,
      onEnter: isHero ? noop : playLocked,
      onEnterBack: isHero ? noop : play,
      onLeave: isHero ? noop : resetTl,
      onLeaveBack: isHero ? noop : resetTl,
    });
    ST.refresh();
    // The hero opens the page: once the preloader lifts, play the full
    // sequence (reveal → word-cycle → gold sweep) WITHOUT locking scroll.
    if (isHero) whenReady(play);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.HeroReveal = { init: init };
})();
