/* Brandmark word-cycle + gold sweep.

   The #brandmark construction reveal (js/heroReveal.js) builds the baked-SVG
   wordmark "wearefeminismm". When that timeline completes it calls
   window.__brandmarkCycle.start(), and this takes over: it hands off from the
   SVG to a live-text layer in the SAME face (Poppins SemiBold, the font the
   glyphs were baked from) sized and positioned onto the SVG word, then:

     1. rolls the prefix weare -> iam -> youare -> weare vertically, with a
        vertical motion blur on each roll (the "feminismm" stays fixed and the
        word re-centres as the prefix width changes), then
     2. sweeps a gold light across the settled "wearefeminismm".

   The live word is Poppins-identical to the SVG, so the swap is invisible and
   the scene rests on the live text. heroReveal keeps the page scroll-locked
   until this finishes (we call window.__brandmarkUnlock at the end).

   Two layers share the centred box: .bwc-composed (rolling prefix + fixed
   suffix) drives the cycle; .bwc-final (a single "wearefeminismm") drives the
   sweep, so the gold streak is continuous and exactly clipped. Skipped under
   prefers-reduced-motion. */

(function () {
  var LOG = function (m) { try { console.log("[wordcycle] " + m); } catch (e) {} };
  var section = document.getElementById("brandmark");
  var host = document.getElementById("brandmarkWord");   // the h2 holding the SVG
  if (!section || !host) { LOG("ABORT: no #brandmark/#brandmarkWord"); return; }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { LOG("ABORT: reduced-motion is ON"); return; }
  LOG("module loaded, waiting for reveal to finish");

  // one vertical-motion-blur filter for the roll
  var fsvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  fsvg.setAttribute("width", "0"); fsvg.setAttribute("height", "0");
  fsvg.style.position = "absolute";
  fsvg.innerHTML = '<filter id="bwc-ymblur"><feGaussianBlur id="bwc-ymblurNode" stdDeviation="0 0"/></filter>';
  document.body.appendChild(fsvg);
  var blurNode = document.getElementById("bwc-ymblurNode");

  var PREFIXES = ["weare", "iam", "youare"];
  var order = PREFIXES.concat(PREFIXES[0]);       // trailing weare closes the loop

  // The overlay is built LAZILY (on first start), NOT at load: heroReveal.js
  // does `host.innerHTML = ""` when it builds the SVG, which would wipe an
  // overlay added at load time. By build time (reveal complete) the SVG is
  // settled and host is safe to append into.
  var layer, reel, slot, composed, finalEl, shine;
  var widths = [];
  var token = 0;                                   // cancels a stale run on reset/replay

  function build() {
    if (layer) return;
    layer = document.createElement("div");
    layer.className = "bwc";
    layer.setAttribute("aria-hidden", "true");
    /* The FINAL m is the signature glyph. In the baked SVG it is gold
       (.bmc-glyph--sig), and the live text was painting the whole word one
       colour, so that m changed colour at the handoff and the signature was
       lost for good afterwards. Now that the two layers register exactly,
       the change showed as one letter wearing two colours mid-crossfade.
       The live text carries the same gold m, so nothing shifts.
       The shine is a solid-gold sweep copy and stays a single colour. */
    layer.innerHTML =
      '<div class="bwc-composed"><span class="bwc-slot"><span class="bwc-reel"></span></span><span class="bwc-suffix">feminism<span class="bwc-sig">m</span></span></div>' +
      '<div class="bwc-final">wearefeminism<span class="bwc-sig">m</span></div>' +
      '<div class="bwc-shine">wearefeminismm</div>';
    section.appendChild(layer);                     // to the SECTION — heroReveal clears the HOST
    reel = layer.querySelector(".bwc-reel");
    slot = layer.querySelector(".bwc-slot");
    composed = layer.querySelector(".bwc-composed");
    finalEl = layer.querySelector(".bwc-final");
    shine = layer.querySelector(".bwc-shine");
    order.forEach(function (w) { var s = document.createElement("span"); s.textContent = w; reel.appendChild(s); });
  }

  function wordRect() {
    var fills = host.querySelectorAll(".bmc-fill");
    if (fills.length) {
      var l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
      fills.forEach(function (p) {
        var rc = p.getBoundingClientRect();
        if (rc.width) { l = Math.min(l, rc.left); t = Math.min(t, rc.top); r = Math.max(r, rc.right); b = Math.max(b, rc.bottom); }
      });
      if (r > l) return { left: l, top: t, width: r - l, height: b - t };
    }
    var sv = host.querySelector("svg");
    return sv ? sv.getBoundingClientRect() : null;
  }

  /* Sizing and placing the live word so the handoff does not jump.

     The previous version compared two different things. wordRect() returns
     the SVG's INK box — the true extent of the drawn glyphs. What it was
     matched against was the text element's LAYOUT box: its advance width
     (which includes the side bearings either side of the w and the final m)
     and its line box (which is 1em tall and sits wherever the font's own
     ascent and descent put the baseline). Neither equals the ink.

     Measured on this wordmark, that was an 8.3px width error over 1050px
     and the ink sitting 4.6px high and 3.3px left of where the SVG had it.
     Small numbers, but they land as a visible snap at the exact moment the
     visitor's eye is on the word.

     So both are now measured as INK. Canvas actualBoundingBox* gives the
     text's real ink extents, and a zero-size inline-block probe gives the
     baseline inside the line box (measured rather than derived from font
     metrics, which is the part that varies by engine). The advance widths
     are still measured separately — the rolling slot animates on those. */
  var fitCV = null;
  function inkMetrics(fs) {
    if (!fitCV) {
      var c = document.createElement("canvas");
      fitCV = c.getContext && c.getContext("2d");
    }
    if (!fitCV) return null;
    fitCV.font = "600 " + fs + "px Poppins, system-ui, sans-serif";
    var m = fitCV.measureText("wearefeminismm");
    // older engines report the advance only; those fall back to the old path
    if (typeof m.actualBoundingBoxRight !== "number" ||
        typeof m.actualBoundingBoxAscent !== "number") return null;
    return {
      left: m.actualBoundingBoxLeft, right: m.actualBoundingBoxRight,
      asc: m.actualBoundingBoxAscent, desc: m.actualBoundingBoxDescent,
      adv: m.width,
      w: m.actualBoundingBoxRight + m.actualBoundingBoxLeft   // ink width
    };
  }

  function fit() {
    var wr = wordRect();
    var ruler = document.createElement("span");
    ruler.style.cssText = "position:absolute;left:-9999px;top:0;white-space:nowrap;visibility:hidden;font-family:'Poppins',sans-serif;font-weight:600;letter-spacing:0;line-height:1;font-size:100px;";
    ruler.textContent = "wearefeminismm";
    document.body.appendChild(ruler);
    var w100 = ruler.getBoundingClientRect().width || 1;      // advance at 100px

    var ink100 = inkMetrics(100);
    // match the SVG word width if we could measure it; otherwise fall back to a
    // sensible size relative to the section so the word is never invisible.
    var targetW = (wr && wr.width) ? wr.width : Math.min(section.clientWidth * 0.82, 1180);
    // scale on INK width when we have it, advance width when we do not
    var fs = 100 * targetW / ((ink100 && ink100.w) || w100);

    ruler.style.fontSize = fs + "px";
    widths = order.map(function (w) { ruler.textContent = w; return ruler.getBoundingClientRect().width; });

    /* where the ink centre sits relative to the BOX centre, at this size.
       CSS puts the box centre on --wcx/--wcy, so the offset is subtracted
       back out to land the INK centre there instead. */
    var dx = 0, dy = 0;
    var ink = ink100 ? inkMetrics(fs) : null;
    if (ink) {
      ruler.textContent = "wearefeminismm";
      var probe = document.createElement("span");
      probe.style.cssText = "display:inline-block;width:0;height:0;";
      ruler.appendChild(probe);                                // its bottom edge sits ON the baseline
      var rr = ruler.getBoundingClientRect();
      var baseline = probe.getBoundingClientRect().bottom;
      dx = (ink.right - ink.left) / 2 - rr.width / 2;
      dy = (baseline + (ink.desc - ink.asc) / 2) - (rr.top + rr.height / 2);
      probe.remove();
    }
    ruler.remove();
    layer.style.fontSize = fs + "px";

    // align the live word's INK centre to the SVG word's INK centre (relative
    // to the section, so it holds whether or not the section is pinned).
    if (wr && wr.width) {
      var sr = section.getBoundingClientRect();
      layer.style.setProperty("--wcx", ((wr.left + wr.width / 2) - sr.left - dx) + "px");
      layer.style.setProperty("--wcy", ((wr.top + wr.height / 2) - sr.top - dy) + "px");
    } else {
      layer.style.removeProperty("--wcx");
      layer.style.removeProperty("--wcy");
    }
    return true;                                    // always succeeds
  }

  function setStep(i, animate) {
    reel.style.transition = animate ? "" : "none";
    slot.style.transition = animate ? "" : "none";
    reel.style.transform = "translateY(" + (-i) + "em)";
    slot.style.width = widths[i] + "px";
  }
  function blur(on) { blurNode.setAttribute("stdDeviation", on ? "0 7" : "0 0"); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function done() { if (window.__brandmarkUnlock) window.__brandmarkUnlock(); }

  function run(mine) {
    var i = 1;
    function nextRoll() {
      if (mine !== token) return;
      if (i >= order.length) return sweep();
      wait(820).then(function () {
        if (mine !== token) return;
        blur(true); setStep(i, true);
        return wait(250).then(function () {
          blur(false);
          return wait(210);
        });
      }).then(function () {
        if (mine !== token) return;
        if (i === order.length - 1) setStep(0, false);   // snap onto real index 0 (identical)
        i++;
        nextRoll();
      });
    }
    function sweep() {
      if (mine !== token) return;
      wait(400).then(function () {
        if (mine !== token) return;
        // swap the rolling word for the solid settled word, and lay the gold
        // shine over it (the shine sweeps; the solid word stays visible under it)
        composed.style.opacity = "0";
        finalEl.classList.add("show");
        shine.classList.add("show");
        void shine.offsetWidth;                          // commit the 200% start
        return wait(40);
      }).then(function () {
        if (mine !== token) return;
        shine.classList.add("sweep");                    // gold streak 200% -> -120%
        return wait(950 + 600);
      }).then(function () {
        if (mine !== token) return;
        shine.classList.remove("sweep", "show");
        shine.style.transition = "none";
        shine.style.backgroundPosition = "200% 0";
        // rest on the solid live word and release the scroll-lock
        done();
      });
    }
    nextRoll();
  }

  window.__brandmarkCycle = {
    start: function () {
      LOG("start() called by the reveal's onComplete");
      build();
      token++;
      var mine = token;
      var begun = false;
      function begin() {
        if (begun || mine !== token) return;
        begun = true;
        if (!fit()) { LOG("start(): fit() FAILED (couldn't measure the SVG word)"); done(); return; }
        LOG("start(): running — SVG hidden, live text in, rolling weare/iam/youare");
        composed.style.opacity = "";
        finalEl.classList.remove("show");
        shine.classList.remove("show", "sweep");
        shine.style.transition = "none";
        shine.style.backgroundPosition = "200% 0";
        setStep(0, false);                                // start on "weare…" = "wearefeminismm"
        layer.classList.add("on");
        /* With data-hero-rig the SVG is no longer only the wordmark: it also
           carries the drafting sheet and the type metrics, which are the
           hero's BACKGROUND and have to outlive this handoff. Fading the
           whole host took them out about a second after they appeared, which
           is why the resting hero was still bare cream. So fade the GLYPHS
           instead and leave the sheet standing.

           The per-glyph anchor marks fade with them, which is right: once
           live text is doing the drawing, marks pinned to the baked outlines
           would no longer line up with what is on screen. */
        if (section.hasAttribute("data-hero-rig")) {
          var gl = host.querySelectorAll(".bmc-glyph");
          for (var gi = 0; gi < gl.length; gi++) {
            gl[gi].style.transition = "opacity .3s ease";
            gl[gi].style.opacity = "0";
          }
        } else {
          host.style.transition = "opacity .3s ease";
          host.style.opacity = "0";                       // hand off: SVG out, live text in
        }
        requestAnimationFrame(function () { requestAnimationFrame(function () { run(mine); }); });
      }
      // measure + render only once Poppins is ready, so the handoff matches the
      // baked glyphs (the SVG stays up meanwhile — no flash). Cap the wait so a
      // font hiccup can never strand the sequence.
      if (document.fonts && document.fonts.load) {
        document.fonts.load("600 1em Poppins").then(begin, begin);
        setTimeout(begin, 600);
      } else {
        begin();
      }
    },
    reset: function () {
      token++;                                            // cancel any in-flight run
      host.style.transition = "";
      host.style.opacity = "";                            // show the SVG again for a replay
      var rg = host.querySelectorAll(".bmc-glyph");       // and the glyphs, if they were faded instead
      for (var ri = 0; ri < rg.length; ri++) {
        rg[ri].style.transition = "";
        rg[ri].style.opacity = "";
      }
      if (!layer) return;
      layer.classList.remove("on");
      composed.style.opacity = "";
      finalEl.classList.remove("show");
      shine.classList.remove("show", "sweep");
      shine.style.transition = "none";
      shine.style.backgroundPosition = "200% 0";
      if (widths.length) setStep(0, false);
    }
  };
})();
