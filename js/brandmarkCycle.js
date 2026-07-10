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
    layer.innerHTML =
      '<div class="bwc-composed"><span class="bwc-slot"><span class="bwc-reel"></span></span><span class="bwc-suffix">feminismm</span></div>' +
      '<div class="bwc-final">wearefeminismm</div>' +
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

  // Only the FONT-SIZE is measured (to match the SVG word's width); centring is
  // done by CSS (the layer fills the section and the word is transform-centred,
  // exactly like the SVG), so there is no fragile left/top math.
  function fit() {
    var wr = wordRect();
    var ruler = document.createElement("span");
    ruler.style.cssText = "position:absolute;left:-9999px;top:0;white-space:nowrap;visibility:hidden;font-family:'Poppins',sans-serif;font-weight:600;letter-spacing:0;font-size:100px;";
    ruler.textContent = "wearefeminismm";
    document.body.appendChild(ruler);
    var w100 = ruler.getBoundingClientRect().width || 1;
    // match the SVG word width if we could measure it; otherwise fall back to a
    // sensible size relative to the section so the word is never invisible.
    var targetW = (wr && wr.width) ? wr.width : Math.min(section.clientWidth * 0.82, 1180);
    var fs = 100 * targetW / w100;
    ruler.style.fontSize = fs + "px";
    widths = order.map(function (w) { ruler.textContent = w; return ruler.getBoundingClientRect().width; });
    ruler.remove();
    layer.style.fontSize = fs + "px";

    // align the live word's CENTRE to the SVG word's centre (relative to the
    // section, so it holds whether or not the section is pinned). Centre-only
    // measurement is stable; if it fails we fall back to the section centre.
    if (wr && wr.width) {
      var sr = section.getBoundingClientRect();
      layer.style.setProperty("--wcx", ((wr.left + wr.width / 2) - sr.left) + "px");
      layer.style.setProperty("--wcy", ((wr.top + wr.height / 2) - sr.top) + "px");
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
        host.style.transition = "opacity .3s ease";
        host.style.opacity = "0";                         // hand off: SVG out, live text in
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
