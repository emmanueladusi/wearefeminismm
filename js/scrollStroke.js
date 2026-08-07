/* The thread — one line drawn down the whole page by the scroll.
   ---------------------------------------------------------------------------
   Ported off a React/framer-motion component. framer's <motion.path
   pathLength> is a wrapper over SVG stroke dashing, so the effect needs no
   library: measure the path, set stroke-dasharray to its length, and drive
   stroke-dashoffset from scroll position.

   The path is generated rather than pasted. The one the component shipped with
   was a fixed 1278x2319 scribble, which cannot follow a page whose height
   depends on the viewport, the theme and how the copy wraps. This builds a
   smooth serpentine through waypoints in real pixels, so it always spans the
   document exactly and re-cuts itself on resize. */
(function () {
  var svg  = document.getElementById("ssThread");
  var path = document.getElementById("ssPath");
  if (!svg || !path) return;

  // Accessible mode counts the same as the OS setting, the way every other
  // module on this site treats it. Without the data-a11y half, a visitor who
  // turns accessible mode on still gets a line animating down the page.
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches ||
               document.documentElement.hasAttribute("data-a11y");
  var len = 0, docH = 0, vh = 0, startY = 0, ticking = false;

  /* ---------- the path ---------------------------------------------------- */

  // A true circle, as four cubic quarter-arcs. Feeding a ring of points through
  // the spline instead looked like the obvious move and was wrong: the spline
  // also has to enter and leave the ring, and those tangents drag it out of
  // round, so every loop came out a lopsided teardrop. 0.5522847 is the control
  // -point ratio that makes a cubic match a quarter circle.
  var K = 0.5522847498;

  // One turn of a circle whose centre slides along the direction of travel
  // while it turns. The slide is the whole point: a circle that closes exactly
  // where it opened is tangent to the line, so it hangs off it like a balloon
  // on a string and never actually crosses. Ending one step further on makes
  // the curve pass its own start exactly once, which is what a written loop
  // does. The slide is small next to the radius, so it still reads as a circle.
  function loop(cx, cy, r, a0, dir, dx, dy) {
    var d = "";
    for (var q = 0; q < 4; q++) {
      var a = a0 + dir * (Math.PI / 2) * q;
      var b = a + dir * (Math.PI / 2);
      // Each quarter starts and ends on its own centre, and quarter q's end
      // centre is quarter q+1's start centre, so the curve stays joined.
      var ox = cx + (dx * q) / 4,       oy = cy + (dy * q) / 4;
      var nx = cx + (dx * (q + 1)) / 4, ny = cy + (dy * (q + 1)) / 4;
      var ax = ox + Math.cos(a) * r, ay = oy + Math.sin(a) * r;
      var bx = nx + Math.cos(b) * r, by = ny + Math.sin(b) * r;
      var c1x = ax - dir * Math.sin(a) * r * K, c1y = ay + dir * Math.cos(a) * r * K;
      var c2x = bx + dir * Math.sin(b) * r * K, c2y = by - dir * Math.cos(b) * r * K;
      d += "C" + c1x.toFixed(1) + " " + c1y.toFixed(1) + "," +
                 c2x.toFixed(1) + " " + c2y.toFixed(1) + "," +
                 bx.toFixed(1) + " " + by.toFixed(1);
    }
    return d;
  }

  // The serpentine, with a circle dropped in at the marked waypoints. The
  // circle starts and ends on the waypoint itself, so the line runs into it,
  // goes round once, and carries on without a join.
  function draw_path(pts, loops, w) {
    var d = "M" + pts[0][0].toFixed(1) + " " + pts[0][1].toFixed(1);
    var shift = [0, 0];   // a loop leaves the line a step further on than it entered

    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += "C" + (c1x + shift[0]).toFixed(1) + " " + (c1y + shift[1]).toFixed(1) + "," +
                 c2x.toFixed(1) + " " + c2y.toFixed(1) + "," +
                 p2[0].toFixed(1) + " " + p2[1].toFixed(1);
      shift = [0, 0];

      var lp = loops[i + 1];
      if (!lp) continue;

      var pn = pts[i + 2] || p2;
      var tx = pn[0] - p1[0], ty = pn[1] - p1[1];
      var tl = Math.hypot(tx, ty) || 1;
      tx /= tl; ty /= tl;

      // Perpendicular to travel, opening away from the middle of the page.
      // Inward is where the content column is: a loop wide enough to be worth
      // making was mostly hidden behind the cards, and only the slivers either
      // side of them showed. Curling outward puts it in the margin.
      var nx = -ty, ny = tx, dir = 1;
      if ((p2[0] > w / 2) !== (nx > 0)) { nx = -nx; ny = -ny; dir = -1; }

      // The winding is not a free choice: with the centre on one side, only one
      // direction leaves the entry point travelling the way the line was already
      // going. Setting it independently made half the loops start backwards, so
      // they kinked instead of crossing. It still alternates on its own, because
      // the inboard side flips every time the serpentine changes direction.

      // Keep the whole loop on screen by shrinking it, never by moving it.
      // Sliding the centre instead was the obvious fix and a real bug: the
      // entry point stops lying on the circle, the loop detaches from the line
      // and crosses it twice on the way past instead of once.
      var pad = 20;
      var r = lp.r;
      if (1 - nx > 0.001) r = Math.min(r, (p2[0] - pad) / (1 - nx));
      if (1 + nx > 0.001) r = Math.min(r, (w - pad - p2[0]) / (1 + nx));

      // Below this it is a blob rather than a loop, and no loop beats a bad
      // one. The line simply carries on.
      if (r < 60) continue;

      var cx = p2[0] + nx * r, cy = p2[1] + ny * r;

      // How far the loop travels while it turns: enough that the crossing is
      // unmistakable, small enough that the shape still reads as a circle.
      var dx = tx * r * 0.6, dy = ty * r * 0.6;

      d += loop(cx, cy, r, Math.atan2(p2[1] - cy, p2[0] - cx), dir, dx, dy);
      shift = [dx, dy];
    }
    return d;
  }

  function build() {
    var w = document.documentElement.clientWidth;
    docH = document.documentElement.scrollHeight;
    vh = innerHeight;

    // The line begins at the pathways, not at the top of the document: the
    // hero builds its own wordmark and does not want a second thing drawing
    // over it. Marked in the markup with data-thread-start.
    var startEl = document.querySelector("[data-thread-start]");
    startY = startEl ? startEl.getBoundingClientRect().top + scrollY : 0;

    // The line stops where the tip can actually get to. Because the tip rides
    // partway up the screen, the furthest down the page it is ever asked for
    // is the last scroll position plus that offset -- short of the very bottom.
    // Running the line all the way to the foot of the document meant the last
    // fifth of it could never be drawn, and it simply stopped mid-footer.
    var endY = docH - vh * (1 - TIP);
    // The serpentine stops short of that and the exit covers the last stretch,
    // so the line is still descending as it leaves. Ending the turns exactly at
    // endY left the exit dead level, and a run with no downward travel cannot
    // be drawn at all by a tip that is positioned by height: the last sixth of
    // the line simply never appeared.
    var run = Math.max(endY - vh * 0.3 - startY, 1);

    // Turn about once a screen, not every two-thirds of one. This is what sets
    // how fast the drawing tip appears to move: the line is drawn at a constant
    // rate along its own length, so the further it wanders sideways between
    // turns, the further the tip travels per pixel scrolled. Tight turns and a
    // wide swing gave a path 2.7x longer than the page is tall, and the tip
    // spent the whole scroll below the fold with the line already finished
    // above it. Fewer, shallower turns keep it close to 1:1.
    var steps = Math.max(3, Math.round(run / (vh * 1.05)));
    // Sizes are drawn from a fixed list rather than at random, so no two loops
    // on the page are the same and the sequence is the same for everyone. The
    // list is walked with a stride that is coprime with its length, so a page
    // long enough to want six loops still gets six different ones.
    // The floor matters as much as the spread: at 16px of stroke a loop much
    // under 70px of radius closes up into a blob, and the crossing that makes
    // it read as a loop rather than a bulge disappears into the line weight.
    // Two big ones, and not the same size as each other. Indexed straight off
    // the count now rather than strided through a longer list: with only two
    // loops left, a stride was picking whichever entries happened to land.
    // Smaller one first. The bigger a loop is the longer the line pauses on it,
    // and the further the tip rides up the screen while it forms; leading with
    // the largest took it off the top of the viewport.
    var SIZES = [1.15, 1.6];
    var base = Math.min(w * 0.09, 140);
    var seen = 0;

    // It enters from off the page rather than beginning somewhere in the middle
    // of the paper. A stroke that starts in open space starts with a visible
    // round cap sitting in the margin, which reads as a stray mark until it
    // moves. Off-canvas, the first thing anyone sees is a line already arriving.
    var lead = base * 1.8;
    var pts = [[w + lead, startY - vh * 0.55]];
    var loops = {};

    for (var i = 1; i <= steps; i++) {
      var side = i % 2 ? 0.74 : 0.26;   // a narrower swing, for the same reason
      // The amplitude breathes instead of repeating exactly; a perfect
      // alternation looks generated, which is the one thing it must not.
      var drift = Math.sin(i * 1.7) * 0.07;
      var prev = pts[pts.length - 1];
      var cur = [w * (side + drift), startY + (run * i) / steps];

      // Every segment gets a midpoint, and loops go on midpoints rather than
      // on the turns. On a turn the line doubles straight back across the
      // loop's own bulge and crosses it a second time on the way out; halfway
      // along a run it is going one way, so it enters, goes round, crosses
      // itself once and carries on.
      // A midpoint on every run, purely to keep the curve smooth.
      pts.push([(prev[0] + cur[0]) / 2, (prev[1] + cur[1]) / 2]);

      pts.push(cur);

      // On the turn, not halfway along the run. The turns are the only places
      // the line reaches the outer edge of the page, which is the only room
      // there is for a loop to sit clear of the content column. It works here
      // for the same reason it failed before: a loop on a turn opening inward
      // gets crossed a second time by the line doubling back through it, but
      // one opening outward is left behind as the line turns away.
      //
      // One early, one late. Both in the top half meant the bottom half had no
      // loop to spend its surplus scroll on, and the tip ran away downwards.
      if (i === 1 || i === steps - 1) {
        loops[pts.length - 1] = { r: base * SIZES[seen % SIZES.length] };
        seen++;
      }
    }

    // And it leaves the same way. The last waypoint sat at the very bottom of
    // the document, which put a round cap on the footer's edge; this carries
    // it off the side instead, so the line runs out of the page rather than
    // stopping on it.
    // Out the side it is already on. Reversed, the line crossed the full width
    // of the page to leave, which is 1200px of travel going nowhere down.
    pts.push([(steps % 2 ? w + lead : -lead), endY]);

    var d = draw_path(pts, loops, w);
    path.setAttribute("d", d);
    svg.setAttribute("viewBox", "0 0 " + w + " " + docH);   // 1:1, so no stroke distortion
    svg.style.height = docH + "px";

    len = path.getTotalLength();
    path.style.strokeDasharray = len;

    table();
    slices(d, w);
    draw();
  }


  /* ---------- how far along, for a given place on the page ----------------
     Drawing at a constant rate along the path does not track the reader: the
     line is longer than the page is tall, and that length is not spread evenly
     down it, so wherever the line runs sideways the tip races and wherever it
     turns it stalls. It ended up below the fold for most of the page, with the
     line already finished everywhere you were looking.

     So the tip is driven by height instead. This walks the path once and
     records how far along it is at each height, which the draw step then reads
     backwards: give it a y, it returns the length to draw.

     Loops are the wrinkle -- a loop occupies one band of the page while the
     line inside it goes up as well as down, so height alone cannot order it.
     The walk keeps a floor that always creeps forward, so a loop gets a small
     budget of scroll of its own and draws over it rather than snapping in. */
  // CREEP is how much scroll a loop is worth. Inside a loop the line goes up
  // as well as down, so height alone cannot order it; the floor creeps forward
  // at this fraction of the line's own length instead. Higher means the loop
  // occupies more of your scrolling and therefore draws more slowly. At 0.25 a
  // loop went by in about 170px of scroll, which is a flick of the wheel.
  // CREEP is what a loop is worth in scroll: the loop's own length times this.
  // It is a balance, not a free dial. Everything a loop borrows has to be paid
  // back by the rest of the page drawing faster, or the line would not reach
  // the footer -- and past about a sixth of the page's height that repayment
  // is quick enough to carry the tip off the bottom of the screen between
  // loops. At 0.30 the big loop takes about 380px of scrolling to form.
  var TY = null, TS = null, CREEP = 0.30, TIP = 0.55, REPAY = 0.62;

  function table() {
    var M = 1000;
    TY = new Float64Array(M + 1);
    TS = new Float64Array(M + 1);
    var prevS = 0, prevY = null, virt = 0, low = -Infinity;
    for (var j = 0; j <= M; j++) {
      var sj = (len * j) / M;
      var y = path.getPointAtLength(sj).y;
      var ds = sj - prevS;

      if (prevY === null) {
        virt = y;
        low = y;
      } else if (y < low) {
        // Inside a loop: the page is not moving down here, so the scale
        // advances on the line's own length instead. This is the borrowing.
        virt += ds * CREEP;
      } else {
        // Back on the way down, and paying off whatever the last loop ran up.
        // The debt is measured as the gap between the scale and the page, not
        // accumulated separately: a loop climbs as well as falls, and counting
        // only the climb left part of it permanently unpaid, so the line never
        // caught back up and finished the page 30% short.
        var dy = y - prevY;
        if (dy < 0) dy = 0;
        var owed = virt - y;
        virt += dy - (owed > 0 ? Math.min(owed, dy * REPAY) : 0);
        low = y;
      }

      TS[j] = sj;
      TY[j] = virt;
      prevY = y;
      prevS = sj;
    }
  }

  // Length to draw so the tip sits at height `y`.
  function lengthAt(y) {
    if (!TY) return 0;
    var lo = 0, hi = TY.length - 1;

    // No global rescale any more. Squeezing the whole page to pay the loops
    // back is what carried the tip off the bottom of the screen between them:
    // the debt is settled locally now, in the stretch right after each loop.

    if (y <= TY[0]) return 0;
    if (y >= TY[hi]) return len;
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if (TY[mid] <= y) lo = mid; else hi = mid;
    }
    var span = TY[hi] - TY[lo];
    var f = span > 0 ? (y - TY[lo]) / span : 0;
    return TS[lo] + (TS[hi] - TS[lo]) * f;
  }

  /* ---------- sections that would hide it --------------------------------- */

  // The thread runs under everything, so any section painting an opaque
  // background swallows it whole. Those are marked data-thread-through and get
  // their own copy of the identical path, drawn over their background and
  // under their content. The copy's viewBox is offset to that section's place
  // in the document, so it is the same line continuing, not a second one, and
  // the SVG viewport clips it to the section's own band.
  var sliceEls = [];

  function slices(d, w) {
    sliceEls = [];
    [].forEach.call(document.querySelectorAll("[data-thread-through]"), function (host) {
      var box = host.getBoundingClientRect();
      var top = box.top + scrollY;
      var h = host.offsetHeight;

      var wrap = host.querySelector(".ss-slice");
      if (!wrap) {
        wrap = document.createElement("div");
        wrap.className = "ss-slice";
        wrap.setAttribute("aria-hidden", "true");
        wrap.innerHTML = '<svg preserveAspectRatio="none" fill="none" ' +
                         'xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path /></svg>';
        host.insertBefore(wrap, host.firstChild);
      }

      var sv = wrap.firstChild, pa = sv.firstChild;
      sv.setAttribute("viewBox", "0 " + top.toFixed(1) + " " + w + " " + h);
      sv.setAttribute("width", w);
      sv.setAttribute("height", h);
      pa.setAttribute("d", d);
      pa.setAttribute("class", "ss-thread-line");
      pa.style.strokeDasharray = len;
      sliceEls.push({ host: host, svg: sv, path: pa, w: w, h: h });
    });
  }

  /* ---------- the draw ---------------------------------------------------- */

  function draw() {
    ticking = false;
    if (!len) return;
    var off;
    if (reduce) {
      off = 0;                                   // simply complete
    } else {
      // Measured to the bottom of the viewport, not the top, so the drawing
      // tip runs just ahead of what you are reading rather than trailing it.
      // Across the line's own run, not the whole document: it no longer
      // starts at the top of the page, so dividing by docH would have it
      // already part drawn before it begins.
      // The tip sits inside the viewport, not on its bottom edge. At the lip of
      // the screen it is the same as never seeing it draw at all. It rides a
      // little above centre so it has room to fall back at a loop and run on
      // afterwards without leaving the screen either way.
      off = +(len - lengthAt(scrollY + vh * TIP)).toFixed(2);
    }
    path.style.strokeDashoffset = off;

    for (var i = 0; i < sliceEls.length; i++) {
      var sl = sliceEls[i];
      sl.path.style.strokeDashoffset = off;
      // .popculture is sticky: while it is pinned it paints somewhere other
      // than where it sits in the document, so a viewBox fixed at build time
      // would let its piece of the line slide out of register with the rest.
      // Re-aim it at where the section is actually being painted.
      var y = sl.host.getBoundingClientRect().top + scrollY;
      sl.svg.setAttribute("viewBox", "0 " + y.toFixed(1) + " " + sl.w + " " + sl.h);
    }
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(draw);
  }

  build();
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", build);

  // The page grows as images decode and as the reveal observer releases
  // sections, and a thread measured against the old height stops short of the
  // footer. Rebuild whenever the document actually changes size.
  if (window.ResizeObserver) {
    var last = 0;
    new ResizeObserver(function () {
      var h = document.documentElement.scrollHeight;
      if (Math.abs(h - last) < 4) return;
      last = h;
      build();
    }).observe(document.body);
  }
})();
