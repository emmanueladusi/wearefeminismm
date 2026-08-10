/* Presenter mode — the site IS the slide deck.
   ---------------------------------------------------------------------------
   Emmanuel presents this site live. Without this, that means alt-tabbing
   between a slideshow and the website, which breaks the spell of a site whose
   whole argument is "look at this, it is not boring." So: one key moves the
   REAL site to the exact thing he is talking about, in the order of his
   speaker notes. There is no slideshow.

   INERT BY DEFAULT. Nothing below runs unless the URL carries ?present, so a
   student who finds this site can never fall into a half-finished talk.

   Beats are deliberately COARSER than sentences. Several paragraphs of the
   talk sit on one beat; he advances when he wants the site to move, not on
   every line.

   Naming note: this is `present` / `.pm-*`, never `preso` — js/preso.js is a
   different, older feature (the recap reel) and owns #preso/#presoIdx. */

(function () {
  var QS = new URLSearchParams(location.search);
  if (!QS.has("present")) return;

  var KEY = "wf-present";
  var page = location.pathname.split("/").pop() || "index.html";

  /* ---------------------------------------------------------------------
     The beats. `p` page, `t` selector to bring into view, `say` the label
     shown only in the peek card, `prep` optional reveal step, `url` extra
     query to carry when ARRIVING at this beat from another page.
     --------------------------------------------------------------------- */

  /* The slides (js/slides.js) are spliced in at three points, wherever the
     talk has nothing on the site to stand on: the research opening, the
     scratched prototypes in the middle, and the whole ending.

     They are read from a global rather than written here so that deleting
     js/slides.js after the presentation needs no edit to this file: every
     deck comes back empty and the talk runs straight through the site,
     exactly as it did before the slides existed. */
  function deck(name, p, t) {
    var list = (window.PRESENT_DECKS || {})[name] || [];
    return list.map(function (s, i) {
      // `t` still has to be a real selector on that page: a slide beat skips
      // scrolling while it is up, but the beat is also what the talk lands on
      // if the slides file is gone.
      return { p: p, t: t, deck: name, slide: i, say: s.say || name + " slide " + (i + 1) };
    });
  }

  var BEATS = [
    { p: "index.html", t: "#brandmark", say: "Opening · the double m in the wordmark" }
  ]
  .concat(deck("opening", "index.html", "#brandmark"))
  .concat([
    { p: "index.html", t: "#brandmark", say: "Here's a look · replay the reveal", prep: replayHero },
    { p: "index.html", t: "#popculture", say: "Piece of the month", prep: centerPiece },
    { p: "index.html", t: "#about", say: "About me, and why it's last" },
    // js/learnHero.js plays itself on load, unprompted, so no prep step: the
    // real navigation hardNav() does for a cross-page beat is itself the cue.
    // Landing straight on #boring-pulse (the old first beat here) meant the
    // page scrolled past the hero before anyone saw it play.
    { p: "learn.html", t: "#top", say: "The Learn page hero" },
    { p: "learn.html", t: "#boring-pulse", say: "82 surveyed · 44% said boring · and the second finding" }
  ])
  .concat(deck("process", "learn.html", "#boring-pulse"))
  .concat([
    { p: "learn.html", t: "#gallery", say: "The gallery opens · the payoff", gal: true, prep: enterGallery },
    { p: "learn.html", t: "#gallery", say: "Scholars · Dr. Munroe", gal: true, url: "room=scholars", prep: goScholars },
    { p: "learn.html", t: "#after-pulse", say: "44% became 6%" },
    { p: "play.html", t: "#theword", say: "Learning gets tested · the daily word", prep: openWord },
    { p: "community.html", t: "#directory", say: "Organizations girls can actually reach" },
    { p: "community.html", t: "#recommend", say: "Submit a group and be featured" },
    { p: "wall.html", t: "#wallf", say: "Your own wall, moderated", prep: enterWall }
  ])
  .concat(deck("closing", "index.html", "#brandmark"));

  // With no slides file at all this must still end somewhere sane rather than
  // finishing on the wall.
  if (!BEATS[BEATS.length - 1].deck) {
    BEATS.push({ p: "index.html", t: "#brandmark", say: "Next steps, reflection, I am. You are. We are." });
  }

  /* ---------------------------------------------------------------------
     Where are we
     --------------------------------------------------------------------- */

  function readIdx() {
    var fromUrl = parseInt(QS.get("beat"), 10);
    if (!isNaN(fromUrl)) return clamp(fromUrl);
    try {
      var v = parseInt(sessionStorage.getItem(KEY), 10);
      return isNaN(v) ? 0 : clamp(v);
    } catch (e) { return 0; }
  }
  function saveIdx(i) {
    // sessionStorage, not local: closing the tab must end the talk.
    try { sessionStorage.setItem(KEY, String(i)); } catch (e) {}
  }
  function clamp(i) { return Math.max(0, Math.min(BEATS.length - 1, i)); }

  var idx = readIdx();

  /* ---------------------------------------------------------------------
     Reveal steps for the beats that are gated behind a click
     --------------------------------------------------------------------- */

  function replayHero() {
    if (window.__heroReplay) window.__heroReplay();
  }

  /* js/inkpiece.js resolves the Maya Angelou photo out of dithered ink
     PURELY off scroll position: its own progress function reads 1.0 only
     once the tile's centre reaches the middle of the viewport, and the
     ordinary scrollTo() every other beat uses aligns a section's TOP to the
     viewport's top instead. That mismatch meant this beat could land with
     the photo still mid-dither, exactly what he flagged.

     The fix does not touch inkpiece.js at all: it scrolls to the position
     that makes inkpiece's OWN math read "resolved", so the same file that
     already reveals the picture on a normal visitor's scroll reveals it here
     too, at rest instead of caught mid-transition.

     Returns -1, the same sentinel hardNav() uses for "this prep already did
     the navigating" — here it means "this prep already did the scrolling",
     so land() must not also run its own generic scrollTo(b.t) afterward. */
  function centerPiece() {
    var host = document.querySelector(".piece__photo[data-ink]");
    if (!host) return 0;
    var r = host.getBoundingClientRect();
    var targetY = Math.max(0, window.scrollY + r.top - (innerHeight - r.height) / 2);
    if (window.__lenis) window.__lenis.scrollTo(targetY, { offset: 0 });
    else window.scrollTo({ top: targetY, behavior: "smooth" });
    return -1;
  }

  function enterGallery() {
    // Gallery.html checks `!e.isTrusted` and enters synchronously on a
    // synthetic click, skipping its coin-flip delay. Nothing to wait for
    // beyond the ~900ms clip-path open.
    if (!isGalleryOpen()) {
      var btn = document.getElementById("enterBtn");
      if (btn) btn.click();
      return 900;
    }
    // Already open means we arrived BACKWARD from the scholars room. Put the
    // gallery back on its opening room, or he introduces the gallery over a
    // room the talk has not reached yet.
    if (typeof window.setChapter === "function") window.setChapter("directory");
    return 300;
  }

  function goScholars() {
    if (typeof window.openGallery === "function") {
      window.openGallery("scholars");
      return 900;
    }
    // No global? Fall back to the gallery's own ?room= deep link, which does
    // exactly this on load and is a documented, already-tested path.
    if (!isGalleryOpen()) return hardNav("learn.html", idx, "room=scholars");
    return 0;
  }

  function isGalleryOpen() {
    var g = document.getElementById("gallery");
    return !!(g && g.classList.contains("open"));
  }

  function openWord() {
    var card = document.querySelector('[data-opens="theword"]');
    var panel = document.getElementById("theword");
    if (card && panel && panel.hidden) { card.click(); return 240; }
    return 0;
  }

  function enterWall() {
    var door = document.getElementById("wallfDoor");
    var go = document.querySelector('[data-wf-go="everything"]');
    // NOT offsetParent: the door is position:fixed, and a fixed element always
    // reports a null offsetParent, so that test read "hidden" while the door
    // was plainly on screen and the talk stopped at the entrance.
    if (go && door && getComputedStyle(door).display !== "none") { go.click(); return 460; }
    return 0;
  }

  /* ---------------------------------------------------------------------
     Going there
     --------------------------------------------------------------------- */

  function scrollTo(sel) {
    var el = document.querySelector(sel);
    if (!el) return;
    // While the gallery or a research slide covers the viewport, scrolling the
    // document underneath would move nothing anyone can see.
    if (isGalleryOpen()) return;
    if (document.body.classList.contains("sl-up")) return;
    if (window.__lenis) window.__lenis.scrollTo(el, { offset: 0 });
    else el.scrollIntoView({ behavior: "smooth", block: "start" });
    // The colour backdrop caches section offsets; a jump that changed page
    // height would otherwise leave it painting against stale numbers.
    if (window.__morph && window.__morph.measure) {
      setTimeout(function () { window.__morph.measure(); }, 60);
    }
  }

  function hardNav(toPage, toIdx, extra) {
    saveIdx(toIdx);
    var q = "?present&beat=" + toIdx + (extra ? "&" + extra : "");
    // js/transition.js exposes no programmatic hook and is closure-scoped, so
    // rather than re-implement its 480ms wipe (and its re-entry guard, and its
    // bfcache reset) we hand it a real anchor and let it do its own job.
    var a = document.createElement("a");
    a.href = toPage + q;
    a.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px";
    document.body.appendChild(a);
    a.click();
    return -1;
  }

  function land(i) {
    var b = BEATS[i];
    var wait = 0;

    // The research slides cover the viewport, so they follow the same rule the
    // gallery does: any beat that is not a slide beat has to put them away
    // first, or the talk narrates the site from behind them.
    if (window.__slides) {
      if (b.slide != null) window.__slides.show(b.deck, b.slide);
      else window.__slides.hide();
    }

    // #gallery is position:fixed inset:0 AND locks documentElement overflow
    // while open, so any beat that is not a gallery beat has to close it
    // first. Without this, stepping backward out of the gallery left the talk
    // narrating the 44% card from behind a full-screen gallery.
    if (isGalleryOpen() && !b.gal) {
      var x = document.getElementById("exitBtn");
      if (x) { x.click(); wait = 420; }
    }

    if (b.prep) {
      var r = b.prep();
      if (r === -1) return;          // prep navigated away; nothing left to do
      wait = Math.max(wait, r || 0);
    }
    if (wait) setTimeout(function () { scrollTo(b.t); }, wait);
    else scrollTo(b.t);
  }

  function go(i) {
    i = clamp(i);
    var b = BEATS[i];
    if (b.p !== page) { hardNav(b.p, i, b.url); return; }
    idx = i;
    saveIdx(i);
    land(i);
    peek(true);
  }

  /* ---------------------------------------------------------------------
     The peek card — the one concession to "hidden entirely". Nothing shows
     until a key is pressed, and it fades on its own.
     --------------------------------------------------------------------- */

  var card, hideTimer;
  function peek(brief) {
    if (!card) {
      card = document.createElement("div");
      card.className = "pm-peek";
      card.setAttribute("aria-hidden", "true");
      document.body.appendChild(card);
    }
    var next = BEATS[idx + 1];
    card.innerHTML =
      '<span class="pm-peek__n">' + (idx + 1) + " / " + BEATS.length + "</span>" +
      '<span class="pm-peek__now">' + BEATS[idx].say + "</span>" +
      (next ? '<span class="pm-peek__next">next &middot; ' + next.say + "</span>" : "");
    card.classList.add("is-on");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { card.classList.remove("is-on"); }, brief ? 1400 : 2600);
  }

  /* ---------------------------------------------------------------------
     Keys
     --------------------------------------------------------------------- */

  function typing(e) {
    var t = e.target;
    if (!t) return false;
    var tag = t.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable;
  }

  addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    var k = e.key;
    // PageUp/PageDown are what a presentation clicker actually sends, and a
    // clicker is a separate device in his other hand — nobody types those
    // while filling in a crossword. So they drive the talk even when focus is
    // sitting in a field, which is exactly what happens after demoing the
    // crossword or the wall composer. Without this he would have to click
    // somewhere empty mid-sentence before the talk would move again.
    var clicker = (k === "PageDown" || k === "PageUp");

    // Everything else must yield to whatever he is typing into.
    if (typing(e) && !clicker) return;

    if (k === "ArrowRight" || k === "ArrowDown" || k === " " || k === "PageDown") {
      e.preventDefault(); blurField(); go(idx + 1);
    } else if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp") {
      e.preventDefault(); blurField(); go(idx - 1);
    } else if (k === "Escape") {
      e.preventDefault(); quit();
    } else if (k === "p" || k === "P") {
      e.preventDefault(); peek(false);
    }
  });

  // Leaving a beat should also leave the field, so the NEXT press is not
  // swallowed by a game he has already moved on from.
  function blurField() {
    var a = document.activeElement;
    if (a && a !== document.body && a.blur) a.blur();
  }

  function quit() {
    try { sessionStorage.removeItem(KEY); } catch (e) {}
    document.body.classList.remove("is-presenting");
    if (card) card.classList.remove("is-on");
    // The reload below drops the slides anyway, but not instantly: without
    // this, Escape leaves a full-screen slide on the projector for as long as
    // the navigation takes.
    if (window.__slides) window.__slides.hide();
    var clean = location.pathname + location.hash;
    try { history.replaceState({}, "", clean); } catch (e) {}
    // Reload so every script that branched on ?present goes back to normal.
    location.href = clean;
  }

  /* ---------------------------------------------------------------------
     Start
     --------------------------------------------------------------------- */

  document.body.classList.add("is-presenting");

  function begin() {
    saveIdx(idx);
    // ?room= runs its own load handler that clicks #enterBtn; give it the
    // frame it needs before deciding whether this beat still has to open
    // anything itself.
    setTimeout(function () { land(idx); peek(true); }, QS.has("room") ? 500 : 0);
  }

  if (document.readyState === "complete") begin();
  else addEventListener("load", begin);
})();
