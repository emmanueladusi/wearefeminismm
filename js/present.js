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
    { p: "index.html", t: "#brandmark", say: "The presentation video", video: true, prep: showVideo },
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
    { p: "learn.html", t: "#gallery", say: "The gallery opens · scroll through it, into Waves, to Wave Four", gal: true, walk: true, prep: enterGallery },
    { p: "learn.html", t: "#gallery", say: "Scholars · Dr. Munroe's profile expands", gal: true, url: "room=scholars", prep: goScholars },
    { p: "play.html", t: "#theword", say: "Learning gets tested · the daily word", prep: openWord },
    { p: "community.html", t: "#directory", say: "Organizations girls can actually reach", prep: spotlightOrg },
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

  /* The presentation-video beat: a full-viewport crossfade in, over the
     video, crossfade back out — never a hard cut either way. Built once
     and reused, same pattern as js/slides.js's overlay.

     Returns -1 (this prep already handled everything the beat needs; land()
     must not also run its own scrollTo, which would be pointless anyway
     under an opaque full-screen layer). */
  var videoOverlay = null, videoEl = null;

  function buildVideoOverlay() {
    videoOverlay = document.createElement("div");
    videoOverlay.className = "pm-video";
    videoOverlay.setAttribute("aria-hidden", "true");
    videoEl = document.createElement("video");
    videoEl.src = "video/presentation-video.mp4";
    videoEl.poster = "video/presentation-video-poster.jpg";
    videoEl.playsInline = true;
    videoEl.preload = "auto";
    videoOverlay.appendChild(videoEl);
    document.body.appendChild(videoOverlay);
  }

  function showVideo() {
    if (!videoOverlay) buildVideoOverlay();
    videoEl.currentTime = 0;
    videoOverlay.classList.add("is-on");
    // Play is called synchronously inside the keydown handler that reached
    // this beat, which is what lets Chrome/Safari allow audio to autoplay
    // at all. A rejected promise here (e.g. a cold ?present&beat= load with
    // no real keypress behind it) is swallowed rather than thrown: the
    // poster frame still shows, and a normal advance-by-keypress arrival
    // works either way.
    var p = videoEl.play();
    if (p && p.catch) p.catch(function () {});
    return -1;
  }

  // Fades the video out and stops it — called on every beat that is not
  // this one (see land()), the same unconditional-cleanup shape as
  // stopGalleryWalk(), so stepping away either direction always leaves it
  // silent and reset for the next arrival.
  function hideVideoOverlay() {
    if (!videoOverlay) return;
    videoOverlay.classList.remove("is-on");
    var el = videoEl;
    setTimeout(function () {
      if (el) { el.pause(); el.currentTime = 0; }
    }, 800);
  }

  /* Lands at the section's natural top first — eyebrow, title and lead read
     in order, the way any other beat's plain scrollTo() would leave it —
     THEN moves on its own toward the photo, rather than jumping straight to
     the photo on arrival. That second half is the part inkpiece.js cares
     about: its dither-reveal resolves purely off how CENTRED the tile is in
     the viewport, and lands here at 32% down rather than true centre so
     there is room below it once it resolves.

     Returns -1, the same sentinel hardNav() uses for "this prep already did
     the navigating" — here it means "this prep already did the scrolling",
     so land() must not also run its own generic scrollTo(b.t) afterward. */
  function centerPiece() {
    scrollTo("#popculture");

    var thisBeat = idx;
    setTimeout(function () {
      // Guarded against a beat change in the meantime: if he has already
      // pressed on by the time this fires, `idx` has moved past the value
      // it was called for, and pulling the page down here would fight
      // whatever beat he is actually on.
      if (idx !== thisBeat) return;
      var host = document.querySelector(".piece__photo[data-ink]");
      if (!host) return;
      var r = host.getBoundingClientRect();
      var targetY = Math.max(0, window.scrollY + r.top - (innerHeight - r.height) * 0.32);
      if (window.__lenis) window.__lenis.scrollTo(targetY, { offset: 0 });
      else window.scrollTo({ top: targetY, behavior: "smooth" });
    }, 2200);

    return -1;
  }

  function enterGallery() {
    // No portal-grow reveal to wait out: Gallery.html's openGallery() skips
    // that ~900ms animation entirely whenever ?present is in the URL, so
    // the gallery is simply already there once this click resolves.
    if (!isGalleryOpen()) {
      var btn = document.getElementById("enterBtn");
      if (btn) btn.click();
    } else if (typeof window.setChapter === "function") {
      // Already open means we arrived BACKWARD from the scholars room. Put
      // the gallery back on its directory reel before the walkthrough runs,
      // or it starts from wherever the gallery happened to be left.
      window.setChapter("directory");
    }
    runGalleryWalkthrough();
    return 200;
  }

  /* A scripted walkthrough that drives the gallery's OWN input handlers —
     real wheel events and a real Enter keydown dispatched at #reel — rather
     than reaching into its internals (setChapter, activateReelItem, etc.)
     directly. He asked to see it "like a normal person would," scrolling
     back and forth through the real transitions the gallery was built with,
     not a jump between disconnected states. Dispatching the actual events
     the site already listens for is what guarantees that: every animation
     Gallery.html's own wireReelInput()/openCollection() choreograph plays
     exactly as it would for a real visitor, because it IS that same code
     path, not a re-implementation of it.

     The route: scroll through the three top-level covers forward then back
     (so every reel-to-reel transition is seen going both directions), land
     back on Waves, press Enter to open that collection (the full portal
     transition), scroll down through its four covers, then press Enter on
     Wave Four to open the room itself. */
  var galleryWalkGen = 0;

  function stopGalleryWalk() {
    galleryWalkGen++; // invalidates every step still scheduled below
  }

  function galleryWheel(dy) {
    var reel = document.getElementById("reel");
    if (reel) reel.dispatchEvent(new WheelEvent("wheel", { deltaY: dy, bubbles: true, cancelable: true }));
  }
  function galleryEnter() {
    var reel = document.getElementById("reel");
    if (reel) reel.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  }

  function runGalleryWalkthrough() {
    stopGalleryWalk();
    var myGen = galleryWalkGen;

    // [delay before this step runs, the step itself]. Delays are spaced
    // wider than the reel's own transition durations (roughly 500-1050ms
    // for these moves) so no step is ever dispatched onto a reel Gallery.html
    // still has marked REEL.busy, which would just be dropped.
    //
    // The reel opens already focused on Waves (the middle of the three
    // covers, whatever S.deckPos last left it on), so the first five moves
    // read as forward/back/back/forward/forward from there rather than a
    // clean lenses->waves->scholars sweep — what matters is that all three
    // covers are visited in both directions before landing back on Waves,
    // which the sequence below does regardless of the exact starting index.
    var SCRIPT = [
      [900,  function () { galleryWheel(120); }],   // forward
      [900,  function () { galleryWheel(120); }],   // forward again
      [900,  function () { galleryWheel(-120); }],  // back
      [900,  function () { galleryWheel(-120); }],  // back again
      [900,  function () { galleryWheel(120); }],   // forward, settle on Waves
      [700,  galleryEnter],                          // open the Waves collection
      [1300, function () { galleryWheel(120); }],   // (portal settled) wave 1 -> 2
      [900,  function () { galleryWheel(120); }],   // wave 2 -> 3
      [900,  function () { galleryWheel(120); }],   // wave 3 -> 4
      [900,  galleryEnter]                           // open Wave Four's room
    ];

    var t = 0;
    SCRIPT.forEach(function (step) {
      t += step[0];
      setTimeout(function () {
        // Presenter moved on (or back into this beat again) before this
        // step fired — stopGalleryWalk() bumped the generation, so a step
        // from a walkthrough nobody is looking at anymore never runs.
        if (galleryWalkGen !== myGen) return;
        step[1]();
      }, t);
    });
  }

  // Moves to the scholars room, Dr. Munroe's card (gold ring, "Featured"
  // tag) visible as it resolves, then clicks her card itself to open her
  // expanded profile — the same #detail panel a visitor gets from clicking
  // her portrait (Gallery.html's wireOpen/detailScholar).
  function goScholars() {
    if (typeof window.openGallery === "function") {
      window.openGallery("scholars");
      var card = document.querySelector('.piece--scholar[data-pid="s3"]');
      if (card) card.click();
      return 200;
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

  /* One tile on the org wall — Black Women's Institute for Health, flagged
     with `spotlight: true` on its entry in js/directory.js's ORGS array
     (the wall is JS-rendered from that data, never static HTML, so the flag
     has to live there and directory.js's card() emits `data-spotlight` when
     it's set). Swapping which org gets highlighted is a one-line edit there.
     Every arrival at this beat is a fresh page load (the adjacent beats are
     on different pages), so there is no stray state to clear on the way out.

     Centres the tile itself, not just the section: at 1.35x it needs real
     room to read clearly, and the generic scrollTo(b.t) this beat would
     otherwise fall through to only brings the section's TOP into view,
     which could leave an expanded tile lower in the grid clipped. */
  function spotlightOrg() {
    var tile = document.querySelector(".orgtile[data-spotlight]");
    if (!tile) return 0;
    tile.classList.add("is-spotlit");
    var r = tile.getBoundingClientRect();
    var targetY = Math.max(0, window.scrollY + r.top - (innerHeight - r.height) / 2);
    if (window.__lenis) window.__lenis.scrollTo(targetY, { offset: 0 });
    else window.scrollTo({ top: targetY, behavior: "smooth" });
    return -1;
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

    // The walkthrough only belongs to its own beat. Cleared unconditionally
    // here rather than only on exit, since the scholars beat right after it
    // stays on the same page (no reload to reset scheduled steps) and a
    // late wheel/Enter dispatch firing there would fight the auto-expand.
    if (!b.walk) stopGalleryWalk();

    // Same shape for the video: unconditional, so it can never keep playing
    // (silently, off-screen but still audible) into a later beat.
    if (!b.video) hideVideoOverlay();

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
