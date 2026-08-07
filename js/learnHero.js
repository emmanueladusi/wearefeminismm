/* Learn hero — the collage arrives, and stays.
   ---------------------------------------------------------------------------
   Landing on Learn is the whole cue. It plays itself:

     1. the artwork fills the screen and assembles itself out of cut shards
     2. it pulls back into a hung print
     3. "Learn through experience." lands under it, as a wall label

   And then it stays. Two earlier versions of this were wrong in opposite
   directions. The first drove the pull-back from scroll position, which cost
   the reader two and a half screens to see the hero happen at all and ran
   backwards if they scrolled up. The second added an exit that shrank the
   picture away as you carried on: the artwork is the best thing on the page
   and there was no reason to take it back.

   Classes are prefixed lh- because this stylesheet is shared by every page and
   #wfgallery's own rules land on the same document. */

(function () {
  var stage = document.querySelector(".lh-stage");
  var plate = document.querySelector(".lh-plate");
  if (!stage || !plate) return;

  var layer = plate.querySelector(".lh-tiles");
  var img   = plate.querySelector(".lh-img");
  var cap   = stage.querySelector(".lh-cap");
  var cue   = stage.querySelector(".lh-cue");

  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- the cut ---------------------------------------------------- */

  // Fixed pseudo-random. Math.random() would give the entrance a different
  // shape on every load, which makes it impossible to art-direct.
  function rand(i) {
    var a = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
    return a - Math.floor(a);
  }

  // An irregular lattice: interior points move, edge points do not. The pieces
  // get the uneven quadrilateral edges of something cut with scissors, the
  // print keeps its straight edges, and because neighbours share their corners
  // no gap can ever open between two shards.
  var COLS = 4, ROWS = 3, JITTER = 0.55;

  function cells() {
    var pts = [], r, c;
    for (r = 0; r <= ROWS; r++) {
      pts[r] = [];
      for (c = 0; c <= COLS; c++) {
        var x = c / COLS, y = r / ROWS;
        if (c > 0 && c < COLS) x += (rand(r * 31 + c) - 0.5) * (1 / COLS) * JITTER;
        if (r > 0 && r < ROWS) y += (rand(c * 17 + r + 99) - 0.5) * (1 / ROWS) * JITTER;
        pts[r][c] = [x, y];
      }
    }
    var out = [];
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        var poly = [pts[r][c], pts[r][c + 1], pts[r + 1][c + 1], pts[r + 1][c]];
        var sx = 0, sy = 0;
        poly.forEach(function (p) { sx += p[0]; sy += p[1]; });
        out.push({ poly: poly, cx: sx / 4, cy: sy / 4, i: r * COLS + c });
      }
    }
    return out;
  }

  // The sunflower, in plate space. The assembly is ordered by distance from
  // here, running outside-in, so it is the last piece placed.
  var FOCUS = [0.48, 0.55];
  function focusDist(t) { return Math.hypot(t.cx - FOCUS[0], t.cy - FOCUS[1]); }

  var tiles = [];

  function build() {
    layer.innerHTML = "";
    tiles = cells().map(function (cell) {
      var el = document.createElement("div");
      el.className = "lh-tile";
      el.style.backgroundImage = 'url("' + img.getAttribute("src") + '")';
      layer.appendChild(el);
      cell.el = el;
      return cell;
    });
  }

  // Cells live in 0..1 and are scaled here, so a resize re-cuts the same
  // pieces rather than re-rolling the jitter.
  function place() {
    var w = plate.clientWidth, h = plate.clientHeight;
    tiles.forEach(function (t) {
      var css = "polygon(" + t.poly.map(function (p) {
        return (p[0] * w).toFixed(2) + "px " + (p[1] * h).toFixed(2) + "px";
      }).join(",") + ")";
      var s = t.el.style;
      s.backgroundSize = w + "px " + h + "px";
      s.clipPath = css;
      s.webkitClipPath = css;
      // Turn around the piece itself. The default origin is the centre of the
      // full-plate box every tile shares, which would swing a corner shard
      // clear across the frame instead of rotating it in place.
      s.transformOrigin = (t.cx * w).toFixed(1) + "px " + (t.cy * h).toFixed(1) + "px";
    });
  }

  /* ---------- 1. the assembly -------------------------------------------- */

  function arm() {
    // The picture is whole; now it pulls back to become a print.
    if (vw) pullBack(); else settle();
  }

  function assemble() {
    var w = plate.clientWidth, h = plate.clientHeight;
    var span = Math.min(w, h);
    var max = 0;
    tiles.forEach(function (t) { max = Math.max(max, focusDist(t)); });

    var left = tiles.length, fired = false, end = 0;
    function finish() {
      if (fired) return;
      fired = true;
      // Steady state is a single flat image again. A dozen full-plate
      // composited layers left alive cost real GPU memory for nothing, and on
      // a school laptop that is what turns into dropped frames later.
      plate.classList.remove("is-tiled");
      layer.innerHTML = "";
      arm();
    }

    tiles.forEach(function (t) {
      var a = rand(t.i * 11 + 2), b = rand(t.i * 13 + 7), c = rand(t.i * 17 + 3);

      // Each shard starts well behind the picture plane and turned off-axis on
      // all three axes, then swings forward and flattens into register: a
      // piece carried in and laid down, not a tile sliding into a slot. The
      // approach is biased to the piece's own side of the frame so shards do
      // not cross over each other on the way in.
      var ang  = Math.atan2(t.cy - 0.5, t.cx - 0.5) + (a - 0.5) * 1.5;
      var out  = span * (0.06 + b * 0.16);
      var lift = span * (0.03 + c * 0.07);
      var z    = -(260 + c * 520);

      var from =
        "translate3d(" + (Math.cos(ang) * out).toFixed(1) + "px," +
        (Math.sin(ang) * out - lift).toFixed(1) + "px," + z.toFixed(0) + "px)" +
        " rotateX(" + ((b - 0.5) * 46).toFixed(1) + "deg)" +
        " rotateY(" + ((a - 0.5) * 52).toFixed(1) + "deg)" +
        " rotateZ(" + ((c - 0.5) * 20).toFixed(1) + "deg)";

      // Nothing here is uniform. Identical durations were what made an earlier
      // version of this feel machined.
      var dur = 700 + b * 420;
      var del = 40 + (1 - focusDist(t) / max) * 540 + c * 150;
      end = Math.max(end, dur + del);

      var anim = t.el.animate([
        { transform: from, opacity: 0 },
        // Opaque early: a shard still translucent while it is turning reads as
        // a ghost rather than as paper.
        { opacity: 1, offset: 0.28 },
        { transform: "none", opacity: 1 }
      ], { duration: dur, delay: del, easing: "cubic-bezier(0.22, 1.12, 0.36, 1)", fill: "both" });

      anim.onfinish = function () { if (--left === 0) finish(); };
    });

    // A deadline as well as a count: onfinish does not fire for an animation
    // cancelled mid-flight, and without this the tiles would never be torn
    // down and the sequence would never arm.
    setTimeout(finish, end + 150);
  }

  /* ---------- 2-3. it pulls back, and stays ------------------------------ */

  var vw = 0, vh = 0, pw = 0, ph = 0, restX = 0, restY = 0, cover = 1;

  // offsetLeft/offsetTop are layout values and a transform cannot move them,
  // so the resting centre stays knowable while the plate is mid-zoom.
  function measure() {
    vw = innerWidth; vh = innerHeight;
    pw = plate.offsetWidth; ph = plate.offsetHeight;
    restX = plate.offsetLeft + pw / 2;
    restY = plate.offsetTop + ph / 2;
    cover = Math.max(vw / pw, vh / ph);
  }

  function fullBleed() {
    return "translate(" + (vw / 2 - restX).toFixed(2) + "px," +
           (vh / 2 - restY).toFixed(2) + "px) scale(" + cover.toFixed(4) + ")";
  }

  // The pull-back runs on its own clock rather than on scroll. Driving it by
  // scroll meant the reader had to spend two and a half screens to see the
  // hero happen, and it ran backwards if they scrolled up. Arriving at Learn
  // is the cue; nothing is asked of them.
  function pullBack() {
    measure();
    var a = plate.animate(
      [{ transform: fullBleed() }, { transform: "none" }],
      { duration: 1500, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "both" }
    );
    a.onfinish = settle;
    setTimeout(settle, 1800);          // onfinish does not fire if it is cancelled

    // The label lands as the picture finishes arriving, not after it.
    cap.animate(
      [{ opacity: 0, transform: "translateY(22px)" }, { opacity: 0, transform: "translateY(22px)", offset: 0.45 },
       { opacity: 1, transform: "none" }],
      { duration: 1900, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "both" }
    );
  }

  var settled = false;
  function settle() {
    if (settled) return;
    settled = true;
    plate.style.transform = "none";    // hand back to layout, so a resize is free
    plate.classList.add("is-framed");
    cap.style.opacity = 1;
    cap.style.transform = "none";
    stage.classList.add("is-done");    // the scroll cue appears here
  }

  // A resize once it has settled needs nothing: the plate is back on layout.
  addEventListener("resize", function () { measure(); place(); });

  /* ---------- start ------------------------------------------------------ */

  // Reduced motion gets the finished picture and its label, straight away.
  if (reduce) {
    plate.classList.add("is-framed");
    stage.classList.add("is-static", "is-done");
    cap.style.opacity = 1;
    return;
  }

  measure();
  plate.style.transform = fullBleed();  // start filling the screen

  // Same idiom as heroReveal.js: this hero opens the page, so it must not play
  // behind the preloader curtain or you catch only the tail of it. Safety-fires
  // past the preloader's own maximum so it cannot get stuck.
  function whenReady(cb) {
    if (!document.body.classList.contains("is-loading")) { cb(); return; }
    var t;
    var mo = new MutationObserver(function () {
      if (!document.body.classList.contains("is-loading")) { mo.disconnect(); clearTimeout(t); cb(); }
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    t = setTimeout(function () { mo.disconnect(); cb(); }, 6500);
  }

  function start() {
    build();
    place();
    plate.classList.add("is-tiled");
    assemble();
  }

  whenReady(function () {
    if (img.complete) start();
    else img.addEventListener("load", start, { once: true });
    // A broken or blocked image must not leave the sequence disarmed, which
    // would pin the page on a full-bleed frame with nothing in it.
    img.addEventListener("error", arm, { once: true });
  });
})();
