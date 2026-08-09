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
     `long` for a line that cannot be cut down and needs the smaller size.
     `say` is what the presenter's own peek card shows for this beat.
     --------------------------------------------------------------------- */

  var OPENING = [
    { k: "Action research 2026",
      t: "Emmanuel Adusi",
      s: "Heading to the University of Waterloo this fall for Honours Mathematics.",
      kind: "big",
      say: "Good morning, who I am" },

    { k: "Why me",
      t: "I do not face what *they* face.",
      s: "17 years old. 1.5 generation Nigerian-Canadian. I research this because I can be part of the solution.",
      say: "Positionality, why I took this on" },

    { k: "The research question",
      t: "How does the *understanding of feminism* affect the experiences of young girls within the TDSB, ages 13 to 19?",
      long: true,
      say: "The research question" },

    { k: "Finding one",
      t: "It was not talked about *at home.*",
      s: "Especially in African households. My own father told me that in his homeland, Nigeria, they do not believe in it.",
      c: "Salami, 2020, p. 59",
      say: "Finding one, not talked about at home" },

    { k: "Finding two",
      t: "It is *misunderstood.*",
      s: "Feminism gets misinterpreted, so it gets dismissed before anyone looks at it properly.",
      c: "Brand, 2018, p. 12",
      kind: "big",
      say: "Finding two, misunderstood" },

    { k: "Connected to the MYSP",
      t: "Belong. Thrive.",
      s: "The two pillars this work sits under.",
      kind: "big",
      say: "MYSP, Belong and Thrive" },

    { k: "The solution",
      t: "Let students *lead.*",
      s: "Give them the chance to get involved, and make teacher involvement mandatory.",
      kind: "big",
      say: "The solution" },

    { k: "Key message",
      t: "The wearefeminismm community started *from me.*",
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
      s: "Three prototypes. I scratched all three, because none of them taught this the way I wanted it taught.",
      say: "The prototypes I scratched" },

    { k: "What action research taught me",
      t: "So I *asked* someone.",
      s: "The best way to get an idea is to ask another person for one. I asked my brother. He said: use art.",
      kind: "big",
      say: "Asking my brother, and it clicked" },

    { k: "Why art",
      t: "Art locates African people as *subjects,* not objects.",
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
      s: "Not just mine to show. Something classrooms across the TDSB can pick up and teach with.",
      say: "Next steps, a resource for schools" },

    { k: "Next steps",
      t: "*Workshops,* with this as the main attraction.",
      s: "Somewhere people stay engaged, because there is something in front of them to actually use.",
      say: "Workshops" },

    { k: "The process",
      t: "An emotional *roller coaster.*",
      s: "Some days the ideas would not stop coming. Other days I had the best one I have ever had and lost it a second later.",
      say: "Reflection on the process" },

    { k: "What I would do differently",
      t: "I would have run a *workshop.*",
      s: "A survey is faster to send out. A workshop is where people actually say what they mean.",
      say: "What I would do differently" },

    // The peak. Centred and oversized, the one slide in the talk that breaks
    // the left-aligned rhythm, because it is the line the whole thing was
    // building towards and it should not look like the four before it.
    { t: "I am. You are. *We are.*",
      s: "wearefeminismm is a community.",
      kind: "poster",
      bloom: true,
      say: "I am. You are. We are." },

    { k: "Thank you",
      t: "Emmanuel Adusi",
      s: "Two m's. The same as the community.",
      u: "emmanueladusi.github.io/wearefeminismm &middot; @ourfeministspacee",
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

    return '<div class="sl__decor" aria-hidden="true">' + svg +
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
    root.innerHTML = decorMarkup() + '<div class="sl__body"></div>';
    document.body.appendChild(root);
    body = root.querySelector(".sl__body");
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

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
  function words(str, step) {
    var out = "";
    String(str).split("*").forEach(function (seg, si) {
      if (!seg) return;
      var hi = si % 2 === 1;
      seg.split(/\s+/).forEach(function (w) {
        if (!w) return;
        out += '<span class="sl__w" style="--i:' + step() + '">' +
               (hi ? '<em class="sl__hi">' + esc(w) + "</em>" : esc(w)) +
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
             (s.kind ? " sl__in--" + s.kind : "") + '">' +
          (s.k ? '<p class="sl__k" style="--i:' + step() + '">' + rich(s.k) + "</p>" : "") +
          '<p class="sl__t">' + words(s.t, step) + "</p>" +
          (s.s ? '<p class="sl__s" style="--i:' + step() + '">' + rich(s.s) + "</p>" : "") +
          (s.c ? '<p class="sl__c" style="--i:' + step() + '">' + rich(s.c) + "</p>" : "") +
          // `u` is the only field allowed raw markup, for the &middot; between
          // the address and the handle. It is authored here, never user input.
          (s.u ? '<p class="sl__u" style="--i:' + step() + '">' + s.u + "</p>" : "") +
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
