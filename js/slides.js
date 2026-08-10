/* The research slides — the opening of the talk, on screen.
   ---------------------------------------------------------------------------
   Emmanuel spends the first two or three minutes of the presentation on the
   STUDY: the question, the findings, the MYSP pillars, the solution. None of
   that is site content (the site teaches feminism; this is about the research
   behind it), so until now the screen showed only the wordmark while he talked.
   These slides fill that stretch, then get out of the way and hand over to the
   site itself.

   THREE THINGS THAT MAKE THIS SAFE TO LEAVE IN THE REPO AFTER THE TALK:

   1. It renders ONLY under `?present`. A normal visitor cannot reach these
      slides, cannot see them in the DOM, and never downloads their markup:
      nothing is built until the first show(). So there is nothing to "remove
      after the presentation" unless he wants the files gone.

   2. Removing it for real is deleting this file, css/slides.css and their two
      tags. js/present.js needs NO edit, because it reads the beats from
      window.PRESENT_SLIDES and simply finds none.

   3. It is loaded on EVERY page, not just Home, even though the slides only
      ever render on Home. present.js splices these into its BEATS array, so if
      this file were missing on one page that page's beat numbering would shift
      and every cross-page jump would land on the wrong beat. Same list
      everywhere, same indices everywhere.

   ---------------------------------------------------------------------------
   THE MOTION, AND WHY IT IS THE MOTION IT IS

   Three layers, each carrying an idea rather than decorating a slide:

     · THE WAVES. Four of them, drifting slowly at different speeds. The site
       tells feminism's history in four waves (The Ballot, The March, The Many,
       The Feed), so the background of the research talk is the history the
       research sits inside. They are the only thing here that loops, they are
       far from the text, and they are faint.

     · THE THREAD. The site's own signature is a gold thread (js/thread.js)
       that weaves through the Learn timeline and draws the pulse chart. Here
       it runs along the foot of the slide and GROWS as the talk advances, one
       mark per beat. It doubles as a progress cue only he can read.

     · THE BLOOM. On the last slide, where he says the community started from
       him, the thread's points bloom outward into many. One became a lot.
       That is the argument of the whole talk, made once, visually.

   SAFETY RULE THIS FILE KEEPS: motion lives in the decoration layer, never in
   the text layer. The words are painted by nothing but CSS resting state, so a
   stalled animation clock can cost a wave or a dot but can never cost a slide.
   --------------------------------------------------------------------------- */

(function () {
  var QS = new URLSearchParams(location.search);
  if (!QS.has("present")) return;

  /* ---------------------------------------------------------------------
     The slides. One idea each, at his request: the room should read a line
     in two seconds and look back at him, not sit reading ahead.

     `k` eyebrow, `t` the one idea, `s` optional support line, `c` citation,
     `u` the address line, `long` for a line that cannot be cut down and needs
     the smaller size, `kind` big/poster, `draw` the marks for its accented
     runs, `bloom` for the two lines about one becoming many, and `enter` which
     of the five entrances the headline arrives on (no two slides in a row
     share one). `say` is what the presenter's own peek card shows.
     --------------------------------------------------------------------- */

  var OPENING = [
    { k: "Action research 2026",
      t: "Emmanuel Adusi",
      enter: "zoom",
      lay: "portrait",
      img: "img/emmanuel-portrait.jpg",
      s: "Heading to the University of Waterloo this fall for Honours Mathematics.",
      kind: "big",
      say: "Good morning, who I am" },

    { k: "Why me",
      t: "I do not face what *they* face.",
      lay: "left",
      enter: "rise",
      s: "17 years old. 1.5 generation Nigerian-Canadian. I research this because I can be part of the solution.",
      say: "Positionality, why I took this on" },

    { k: "The research question",
      t: "How does the *understanding of feminism* affect the experiences of young girls within the TDSB, ages 13 to 19?",
      lay: "bottom",
      enter: "slide",
      long: true,
      say: "The research question" },

    { k: "Finding one",
      t: "It was not talked about *at home.*",
      lay: "left",
      enter: "fall",
      s: "Especially in African households. My own father told me that in his homeland, Nigeria, they do not believe in it.",
      c: "Salami, 2020, p. 59",
      say: "Finding one, not talked about at home" },

    { k: "Finding two",
      t: "It is *misunderstood.*",
      lay: "fill",
      invert: true,
      enter: "flip",
      draw: ["tangle"],
      s: "Feminism gets misinterpreted, so it gets dismissed before anyone looks at it properly.",
      c: "Brand, 2018, p. 12",
      say: "Finding two, misunderstood" },

    { k: "Connected to the MYSP",
      t: "Belong. *Thrive.*",
      lay: "centre",
      enter: "rise",
      draw: ["rise"],
      s: "The two pillars this work sits under.",
      kind: "big",
      say: "MYSP, Belong and Thrive" },

    { k: "The solution",
      t: "Let students *lead.*",
      lay: "bottom",
      enter: "slide",
      draw: ["arrow"],
      s: "Give them the chance to get involved, and make teacher involvement mandatory.",
      kind: "big",
      say: "The solution" },

    { k: "Key message",
      t: "The wearefeminismm community started *from me.*",
      lay: "centre",
      invert: true,
      enter: "zoom",
      s: "Last year I said change needs to start somewhere, and that it was me. This year it is a community.",
      bloom: true,
      say: "Key message, then the site takes over" }
  ];

  /* PROCESS — three beats in the middle of the site tour that have no visual,
     because they are about the prototypes that do NOT exist. He talks through
     the wave, the timeline and the game he scratched, then his brother's
     answer, then why art is the right method. Sits between the 44% card and
     the moment the gallery opens, so the gallery lands as the payoff to an
     argument the room has just been walked through rather than as a reveal
     with the reasoning narrated over the top of it. */
  var PROCESS = [
    { k: "Building the product",
      t: "A *wave.* A *timeline.* A *game.*",
      lay: "left",
      enter: "fall",
      draw: ["wave", "tick", "dash"],
      s: "Three prototypes. I scratched all three, because none of them taught this the way I wanted it taught.",
      say: "The prototypes I scratched" },

    { k: "What action research taught me",
      t: "So I *asked* someone.",
      lay: "centre",
      enter: "flip",
      s: "The best way to get an idea is to ask another person for one. I asked my brother. He said: use art.",
      kind: "big",
      say: "Asking my brother, and it clicked" },

    { k: "Why art",
      t: "Art locates African people as *subjects,* not objects.",
      lay: "split",
      invert: true,
      enter: "slide",
      s: "Art is central to Afrocentricity. That is the method this gallery is built on.",
      c: "Asante, 1980",
      long: true,
      say: "Asante, the Afrocentric method" }
  ];

  /* CLOSING — the whole ending. Next steps, the reflection, the feedback and
     the last line were a single beat sitting on the wordmark for about ninety
     seconds, which was the longest stretch of the talk with nothing on screen.
     The last slide is built to be LEFT UP: it holds through applause and
     questions and carries the address, so anyone in the room can go find it. */
  var CLOSING = [
    { k: "Next steps",
      t: "A resource *every school* can use.",
      lay: "left",
      enter: "rise",
      s: "Not just mine to show. Something classrooms across the TDSB can pick up and teach with.",
      say: "Next steps, a resource for schools" },

    { k: "Next steps",
      t: "*Workshops,* with this as the main attraction.",
      lay: "bottom",
      enter: "fall",
      s: "Somewhere people stay engaged, because there is something in front of them to actually use.",
      say: "Workshops" },

    { k: "The process",
      t: "An emotional roller *coaster.*",
      lay: "centre",
      enter: "slide",
      draw: ["coaster"],
      s: "Some days the ideas would not stop coming. Other days I had the best one I have ever had and lost it a second later.",
      say: "Reflection on the process" },

    { k: "What I would do differently",
      t: "I would have run a *workshop.*",
      lay: "left",
      enter: "flip",
      s: "A survey is faster to send out. A workshop is where people actually say what they mean.",
      say: "What I would do differently" },

    // The peak. Centred and oversized, the one slide in the talk that breaks
    // the left-aligned rhythm, because it is the line the whole thing was
    // building towards and it should not look like the four before it.
    { t: "I am. You are. *We are.*",
      lay: "fill",
      invert: true,
      enter: "zoom",
      s: "wearefeminismm is a community.",
      bloom: true,
      say: "I am. You are. We are." },

    { k: "Thank you",
      t: "Emmanuel Adusi",
      enter: "rise",
      lay: "centre",
      s: "Two m's. The same as the community.",
      u: "emmanueladusi.github.io/wearefeminismm &middot; @ourfeministspacee",
      qr: "img/site-qr.png",
      kind: "big",
      say: "Thank you · leave this up for questions" }
  ];

  var DECKS = { opening: OPENING, process: PROCESS, closing: CLOSING };

  // present.js reads this to build its beat list. Defined on every page so the
  // beat indices match everywhere, even though show() only runs where a deck
  // is anchored.
  window.PRESENT_DECKS = DECKS;
  // Compatibility alias: if a cached older present.js is still asking for the
  // flat list, it gets the opening deck rather than nothing at all.
  window.PRESENT_SLIDES = OPENING;

  /* ---------------------------------------------------------------------
     The decoration layer
     --------------------------------------------------------------------- */

  var VB_W = 1440, VB_H = 300, PERIOD = 360;

  // Four waves: amplitude, baseline, seconds per drift, stroke opacity.
  // Baselines sit in the LOWER half of the viewBox on purpose. Pitched higher,
  // the topmost crest cut straight through the citation line, and a faint
  // stroke crossing type reads as a rendering artefact rather than as texture.
  var WAVES = [
    { amp: 26, y: 155, dur: 29, op: 0.20, c: "var(--violet)" },
    { amp: 34, y: 196, dur: 41, op: 0.16, c: "var(--gold)" },
    { amp: 20, y: 234, dur: 53, op: 0.13, c: "var(--violet)" },
    { amp: 30, y: 268, dur: 67, op: 0.10, c: "var(--gold)" }
  ];

  // Fixed, not random: a deterministic bloom is one I can actually verify, and
  // it looks the same in every rehearsal as it will on the day.
  var BLOOM = [
    [12, 34], [21, 58], [29, 26], [40, 66], [50, 40], [57, 80],
    [65, 30], [72, 56], [78, 86], [84, 36], [89, 64], [94, 28],
    [17, 82], [35, 92], [46, 20], [61, 96]
  ];

  function wavePath(w, amp, period, y) {
    // Relative quadratics: one full up-down cycle per `period`, so translating
    // the group by exactly one period loops with no visible seam.
    var d = "M0 " + y;
    for (var x = 0; x < w; x += period) {
      d += " q " + (period * 0.25) + " " + (-amp) + " " + (period * 0.5) + " 0";
      d += " q " + (period * 0.25) + " " + amp + " " + (period * 0.5) + " 0";
    }
    return d;
  }

  function decorMarkup() {
    var svg =
      '<svg class="sl__waves" viewBox="0 0 ' + VB_W + " " + VB_H + '" ' +
      'preserveAspectRatio="none" aria-hidden="true" focusable="false">';
    WAVES.forEach(function (w) {
      svg += '<g class="sl__wg" style="--dur:' + w.dur + 's">' +
               '<path d="' + wavePath(VB_W + PERIOD, w.amp, PERIOD, w.y) + '" ' +
               'fill="none" stroke="' + w.c + '" stroke-opacity="' + w.op + '" ' +
               'stroke-width="1.6" stroke-linecap="round" />' +
             "</g>";
    });
    svg += "</svg>";

    var bloom = "";
    BLOOM.forEach(function (p, i) {
      bloom += '<i class="sl__dot" style="left:' + p[0] + "%;bottom:" + p[1] +
               "px;--d:" + (i * 34) + 'ms"></i>';
    });

    // Grain and vignette first, so they are the ground everything else sits
    // on: the waves, the thread and the bloom all stay crisp on top of them.
    return '<div class="sl__decor" aria-hidden="true">' +
             '<i class="sl__grain"></i>' +
             '<i class="sl__vig"></i>' + svg +
             '<i class="sl__sweep"></i>' +
             '<div class="sl__wire"><i class="sl__wirefill"></i></div>' +
             '<div class="sl__marks"></div>' +
             '<div class="sl__bloom">' + bloom + "</div>" +
           "</div>";
  }

  // The marks are rebuilt per deck, not once: each deck is its own run of the
  // thread, so a three-slide deck must show three marks, not the eight the
  // opening happens to have.
  function layMarks(n) {
    var html = "";
    for (var i = 0; i < n; i++) {
      html += '<i class="sl__mark" style="left:' +
              (((i + 1) / n) * 100).toFixed(3) + '%"></i>';
    }
    root.querySelector(".sl__marks").innerHTML = html;
  }

  /* ---------------------------------------------------------------------
     The overlay. Built on first use, never on a page nobody presents from.
     --------------------------------------------------------------------- */

  var root = null, body = null, live = -1, liveDeck = null;

  function build() {
    root = document.createElement("div");
    root.className = "sl";
    root.setAttribute("aria-hidden", "true"); // presenter surface, not page content
    // Built once, here, rather than per-slide in show(): a credit mark that
    // belongs to the deck as a whole, not to any one idea in it, so it has to
    // survive every show() call untouched rather than being re-authored
    // seventeen times from slide data that has no reason to carry it.
    root.innerHTML = decorMarkup() + '<div class="sl__body"></div>' +
      '<img class="sl__partners" src="img/partner-logos.png" ' +
      'alt="Toronto District School Board and Centre of Excellence for Black Student Achievement">';
    document.body.appendChild(root);
    body = root.querySelector(".sl__body");
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ---------------------------------------------------------------------
     Drawn marks. Some words describe a shape, so the shape gets drawn under
     the word as the line lands: the wave waves, the timeline runs and ticks,
     the roller coaster dips, "lead" points, "thrive" climbs, "misunderstood"
     tangles. A slide names them in `draw`, one per accented run in order.

     Only ever attached to a SINGLE-word run. A mark under a run that wraps
     across two lines would need per-line-box geometry, and the payoff is not
     worth that; where a phrase is accented, it simply goes unmarked.

     preserveAspectRatio="none" so a mark stretches to whatever the word is
     wide, which also means `vector-effect: non-scaling-stroke` is required
     or the stroke stretches with it and reads lopsided.
     --------------------------------------------------------------------- */

  function mk() {
    var d = [].slice.call(arguments).map(function (p) {
      return '<path d="' + p + '"/>';
    }).join("");
    return '<svg class="sl__mk" viewBox="0 0 100 14" preserveAspectRatio="none" ' +
           'aria-hidden="true" focusable="false">' + d + "</svg>";
  }

  var MARKS = {
    wave:    mk("M1 8 q 12 -6 24 0 t 24 0 t 24 0 t 25 0"),
    tick:    mk("M1 9 H99", "M14 4 V13 M39 4 V13 M64 4 V13 M89 4 V13"),
    dash:    mk("M2 9 h13 M27 9 h13 M52 9 h13 M77 9 h13"),
    rise:    mk("M1 13 C 32 13, 44 4, 99 2"),
    arrow:   mk("M1 9 H93", "M85 4 L95 9 L85 14"),
    coaster: mk("M1 12 C 15 -1, 27 13, 43 5 S 71 0, 99 10"),
    tangle:  mk("M2 9 c 7 -8, 15 -1, 11 4 -4 5 -9 -1 -3 -5 8 -6 17 4 25 0 8 -4 6 -9 12 -6 7 4 2 9 8 8 9 -1 14 -6 22 -6")
  };

  /* Copy above marks its accented run with *asterisks*. Splitting on the
     delimiter rather than pattern-matching means punctuation inside the run
     ("*at home.*") needs no special case, and an unclosed marker degrades to
     an accented tail rather than printing a stray asterisk at the audience. */
  function rich(str) {
    return String(str).split("*").map(function (seg, i) {
      if (!seg) return "";
      return i % 2 ? '<em class="sl__hi">' + esc(seg) + "</em>" : esc(seg);
    }).join("");
  }

  /* The headline is emitted one word per span so the line can land word by
     word, the same kinetic entrance the site's own poster headings use.
     `step` hands out the running order index shared with the other blocks, so
     the eyebrow, the words, the support line and the citation arrive in one
     continuous sequence rather than three competing ones. */
  function words(str, step, draw) {
    var out = "", run = -1;
    String(str).split("*").forEach(function (seg, si) {
      if (!seg) return;
      var hi = si % 2 === 1;
      var ws = seg.split(/\s+/).filter(Boolean);
      if (hi) run++;
      // one word only, per the note above
      var mark = hi && ws.length === 1 ? MARKS[(draw || [])[run]] : null;
      ws.forEach(function (w) {
        out += '<span class="sl__w" style="--i:' + step() + '">' +
               (hi ? '<em class="sl__hi">' + esc(w) + (mark || "") + "</em>" : esc(w)) +
               "</span> ";
      });
    });
    return out;
  }

  function show(deckName, i) {
    var deck = DECKS[deckName];
    if (!deck) return;
    var s = deck[i];
    if (!s) return;
    if (!root) build();

    if (liveDeck !== deckName) {
      liveDeck = deckName;
      live = -1;              // force a repaint even if the index happens to match
      layMarks(deck.length);
    }

    if (live !== i) {
      live = i;

      var n = 0;
      function step() { return n++; }

      body.innerHTML =
        '<div class="sl__in' + (s.long ? " sl__in--long" : "") +
             (s.kind ? " sl__in--" + s.kind : "") +
             " sl__in--lay-" + (s.lay || "left") +
             // A mark hangs below its word, so a marked headline that wraps
             // needs the extra leading or the mark crowds the line beneath it.
             (s.draw ? " sl__in--marked" : "") +
             " sl__in--e-" + (s.enter || "rise") + '">' +
          (s.k ? '<p class="sl__k" style="--i:' + step() + '">' + rich(s.k) + "</p>" : "") +
          '<p class="sl__t">' + words(s.t, step, s.draw) + "</p>" +
          (s.s ? '<p class="sl__s" style="--i:' + step() + '">' + rich(s.s) + "</p>" : "") +
          (s.c ? '<p class="sl__c" style="--i:' + step() + '">' + rich(s.c) + "</p>" : "") +
          // `u` is the only field allowed raw markup, for the &middot; between
          // the address and the handle. It is authored here, never user input.
          (s.u ? '<p class="sl__u" style="--i:' + step() + '">' + s.u + "</p>" : "") +
          // The one image field, deliberately narrow: it exists only for the
          // closing card, to scan the site rather than type the address
          // printed right above it.
          (s.qr ? '<div class="sl__qr" style="--i:' + step() +
                  '"><img src="' + s.qr + '" alt="QR code, scan to open the site" width="410" height="410"></div>' : "") +
        "</div>";

      /* Arm, force the browser to take the armed state, then disarm. The
         armed rule carries `transition: none`, so this cannot be seen going
         in; releasing it is what animates.

         No requestAnimationFrame and no timer anywhere in here, deliberately.
         rAF never fires in a backgrounded tab and a timer can be throttled,
         either of which would strand a slide mid-entrance on the projector.
         The three statements below are synchronous, so the words are already
         on their way out of the armed state before this function returns, and
         if transitions are off entirely the text is simply there. */
      var inner = body.firstChild;
      inner.classList.add("is-armed");
      void inner.offsetWidth;
      inner.classList.remove("is-armed");

      // A soft band of light crosses the slide on every change. It sits in the
      // decoration layer behind the words and is replayed the same way, by
      // reflow rather than by a timer, so the change always has a beat to it
      // instead of one line simply being replaced by the next.
      var sweep = root.querySelector(".sl__sweep");
      if (sweep) {
        sweep.classList.remove("is-go");
        // Direction comes from the slide's own index, not from a flip-flop, so
        // a given slide always sweeps the same way and stepping backward is
        // not a different gesture than stepping forward onto it.
        sweep.classList.toggle("is-rev", i % 2 === 1);
        void sweep.offsetWidth;
        sweep.classList.add("is-go");
      }

      // The thread grows to this beat. Set imperatively so that if the CSS
      // transition never runs, the thread is still the right length.
      var fill = root.querySelector(".sl__wirefill");
      if (fill) fill.style.width = (((i + 1) / deck.length) * 100).toFixed(3) + "%";

      var marks = root.querySelectorAll(".sl__mark");
      for (var m = 0; m < marks.length; m++) {
        marks[m].classList.toggle("is-on", m <= i);
      }

      // One became many. Flagged per slide rather than fired on whichever
      // slide happens to be last, so it lands on the two lines that actually
      // say it: "started from me", and "I am. You are. We are."
      root.classList.toggle("is-bloom", !!s.bloom);

      // Layout lives on the ROOT, not on .sl__in, because two of the five
      // compositions move the whole text block within the frame rather than
      // rearranging its insides, and .sl__body is the grid item that has to
      // be re-aligned to do that.
      root.dataset.lay = s.lay || "left";

      // A few slides render on the opposite ground to the one the site is set
      // to. It swaps the tokens locally, so every colour on the slide (type,
      // accent, thread, grain, vignette) follows without being restated.
      root.classList.toggle("is-invert", !!s.invert);

      /* The portrait. Rebuilt per slide rather than hidden and shown, so a
         deck with several photos later cannot leave the wrong face on screen.
         It is a sibling of .sl__body, not a child, because it runs the full
         height of the frame and bleeds off the edge, which nothing inside a
         centred, padded text block can do.

         Armed and released the same way the words are, with its own class and
         a reflow rather than a timer, so the resting state is the visible one:
         if the transition never runs, the photo is simply there. */
      var oldPhoto = root.querySelector(".sl__photo");
      if (oldPhoto) oldPhoto.remove();
      if (s.img) {
        var fig = document.createElement("div");
        fig.className = "sl__photo";
        /* One source, deliberately no srcset. The photo is display:none below
           820px, so there is no small-screen case to serve a smaller file to,
           and the responsive version actively hurt: the browser chose the
           narrow candidate and upscaled a 372px image into a 605px box, which
           is visibly soft on a projector. One 144KB file, always crisp. */
        fig.innerHTML = '<img src="' + s.img + '" alt="" decoding="async">';
        root.appendChild(fig);
        fig.classList.add("is-armed");
        void fig.offsetWidth;
        fig.classList.remove("is-armed");
      }
    }

    root.classList.add("is-on");
    document.body.classList.add("sl-up");
  }

  function hide() {
    if (!root) return;
    root.classList.remove("is-on");
    document.body.classList.remove("sl-up");
    live = -1;
    liveDeck = null;
  }

  window.__slides = { show: show, hide: hide, decks: DECKS };
})();
