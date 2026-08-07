/* The Daily — one mixed round a day, and a streak you don't want to break.
   ---------------------------------------------------------------------------
   The site already had three finished games (js/quiz.js, js/myth.js,
   js/bias.js) and they were pulled off Your voice in 1a3ecbf because the page
   they lived on had become an endless scroll. Each one is fun for a sitting,
   but none of them gave anyone a reason to come back tomorrow: the streaks
   lasted only as long as the round did.

   This is the missing loop, not a fourth game. It reads the SAME content files
   the three games use, so writing new cards still means editing
   js/mythCards.js, js/biasCards.js and js/quizQuestions.js and nothing else.

   Three rules borrowed from the games it replaces, because they were right:
     · non-punitive   a wrong answer teaches, it never scolds. No red X.
     · plain-spoken   every card ends on the WHY, win or lose.
     · keyboard-first every interaction has a key and a real <button>.

   The round is DETERMINISTIC per calendar day: two people on the same day get
   the same five cards. Without that the shareable result means nothing, since
   nobody could compare a run against anyone else's. */

(function () {
  var root = document.getElementById("daily");
  if (!root) return;

  var PER_ROUND = 5;
  var KEY = "wf-daily.v1";
  // Day 1 is the day this shipped. Only used to print a day number on the
  // share card, so a reader can see the run is from today and not last month.
  var EPOCH = Date.UTC(2026, 7, 7) / 86400000;

  /* ---------- content ---------------------------------------------------- */

  // Tagged into one pool so a round can mix formats. If a content file has not
  // loaded we simply carry on with whatever did: a missing deck should cost
  // one card type, never the whole activity.
  function pool() {
    var out = [];
    (window.MYTH_CARDS || []).forEach(function (c, i) {
      out.push({ type: "myth", id: "m" + i, text: c.text, yes: !!c.isMyth, why: c.truth,
                 kind: c.kind || "Myth or real?", left: "Myth", right: "Real" });
    });
    (window.BIAS_CARDS || []).forEach(function (c, i) {
      out.push({ type: "bias", id: "b" + i, text: c.text, yes: !!c.isBiased, why: c.explanation,
                 kind: c.kind || "Post", left: "Biased", right: "Fair" });
    });
    (window.QUIZ_QUESTIONS || []).forEach(function (c, i) {
      out.push({ type: "quiz", id: "q" + i, text: c.q, options: c.options,
                 answer: c.answer, why: c.explanation, kind: c.topic || "Know your feminism" });
    });
    return out;
  }

  /* ---------- the day's five -------------------------------------------- */

  // Local calendar day, so the round turns over at the reader's midnight.
  function today() { return Math.floor(Date.now() / 86400000 - new Date().getTimezoneOffset() / 1440); }

  // Days since launch. The dealer counts passes from here rather than from
  // 1970: at five cards a day that is one pass per five days, so this stays a
  // few hundred passes across a decade instead of the ~4,500 an absolute day
  // number starts at. Clamped, so a device with a badly wrong clock still
  // gets a valid round rather than a negative one.
  function dayIndex() { return Math.max(0, today() - EPOCH); }
  function dayNumber() { return dayIndex() + 1; }

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffled(n, seed) {
    var a = [], r = rng(seed), i, j, t;
    for (i = 0; i < n; i++) a.push(i);
    for (i = n - 1; i > 0; i--) { j = (r() * (i + 1)) | 0; t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  function shuffleInto(arr, r) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = (r() * (i + 1)) | 0, t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // Reshuffling on every pass leaves a seam: a card can sit at the end of one
  // pass and the start of the next, putting it in front of the same reader two
  // mornings running, which is the one repeat anybody actually notices.
  //
  // So each pass is built rather than merely shuffled. The cards that closed
  // the previous pass are barred from the opening `guard` slots of this one,
  // which forces at least `guard + 1` slots between any two showings of the
  // same card. At guard = 10 that is 11 slots, or better than two clear days.
  var lapCache = {};
  function lapOrder(n, lap) {
    if (lapCache[lap]) return lapCache[lap];
    var guard = Math.min(PER_ROUND * 2, Math.floor(n / 2));

    // Built forward from the first pass, and cached, because each pass is
    // defined against the one before it. Lap numbers are counted from the
    // launch date rather than from 1970, so this stays a handful of passes
    // for years instead of thousands.
    var start = 0;
    while (lapCache[start]) start++;
    var prev = start > 0 ? lapCache[start - 1] : null;

    for (var L = start; L <= lap; L++) {
      var r = rng(L * 7919 + 13);
      var barred = {};
      if (prev) for (var i = n - guard; i < n; i++) barred[prev[i]] = 1;

      var free = [], rest = [];
      for (var c = 0; c < n; c++) (barred[c] ? rest : free).push(c);
      shuffleInto(free, r);
      shuffleInto(rest, r);

      // Opening slots come only from cards the last pass did not just show.
      var head = free.slice(0, guard);
      var body = shuffleInto(free.slice(guard).concat(rest), r);
      prev = head.concat(body);
      lapCache[L] = prev;
    }
    return lapCache[lap];
  }

  // Deal the pool out one card at a time instead of picking at random. Every
  // card in the site's decks gets an absolute slot number, and slot -> card
  // runs through a permutation that is reshuffled once per full pass, so a
  // card cannot come back until all the others have been seen.
  //
  // The obvious version of this is wrong, and was: taking a contiguous window
  // (start + i) % n out of ONE permutation makes the window wrap around into
  // the front of the same pass, which re-served cards on day four. Each slot
  // has to carry its own lap, so a round that straddles the boundary finishes
  // in the NEXT pass rather than restarting the current one.
  function roundFor(day) {
    var p = pool();
    if (!p.length) return [];
    var n = p.length;
    var out = [], used = {}, want = Math.min(PER_ROUND, n), slot = day * PER_ROUND;

    while (out.length < want) {
      var lap = Math.floor(slot / n);
      var pos = ((slot % n) + n) % n;
      var card = p[lapOrder(n, lap)[pos]];
      // A round landing exactly on a pass boundary can be offered the same
      // card twice (tail of one shuffle, head of the next). Skip it rather
      // than show a reader the same statement twice in one sitting.
      if (!used[card.id]) { used[card.id] = 1; out.push(card); }
      slot++;
    }
    return out;
  }

  /* ---------- saved state ------------------------------------------------ */

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function save(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }

  var state = load();
  var day = today();

  // A streak survives a missed day only if the miss was yesterday-adjacent;
  // any longer gap starts again at one. Kept here rather than at write time so
  // the number shown on the intro screen is already correct before a round.
  function streakIfPlayedToday() {
    if (state.lastDay === day) return state.streak || 0;
    if (state.lastDay === day - 1) return (state.streak || 0) + 1;
    return 1;
  }

  /* ---------- view ------------------------------------------------------- */

  var cards = roundFor(dayIndex());
  var idx = 0, answers = [], answered = false;

  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches ||
               document.documentElement.hasAttribute("data-a11y");

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function render(node) {
    root.innerHTML = "";
    root.appendChild(node);
  }

  /* ---------- 1. the door ------------------------------------------------ */

  function intro() {
    var done = state.lastDay === day;
    if (done) return results(state.today || [], true);

    var wrap = el("div", "dy dy--intro");
    var streak = state.lastDay === day - 1 ? (state.streak || 0) : 0;

    wrap.appendChild(el("p", "dy__kicker", "Today&rsquo;s round &middot; " + cards.length +
      " cards &middot; about a minute"));
    wrap.appendChild(el("h3", "dy__title", "The Daily"));
    wrap.appendChild(el("p", "dy__lead",
      "Five cards, mixed. Some are myths to catch, some are posts to read closely, " +
      "some are straight questions. Every one tells you why afterwards."));

    if (streak > 0) {
      wrap.appendChild(el("p", "dy__streak",
        '<span class="dy__flame" aria-hidden="true">&#128293;</span> ' +
        "You&rsquo;re on a <b>" + streak + "-day</b> streak. Play to keep it."));
    }

    var go = el("button", "btn dy__go", "Start today&rsquo;s round <span class=\"cta__arrow\" aria-hidden=\"true\">&rarr;</span>");
    go.type = "button";
    go.addEventListener("click", function () { idx = 0; answers = []; card(); });
    wrap.appendChild(go);

    if (state.best) {
      wrap.appendChild(el("p", "dy__best", "Longest streak so far: <b>" + state.best + " days</b>"));
    }
    render(wrap);
  }

  /* ---------- 2. a card -------------------------------------------------- */

  function card() {
    var c = cards[idx];
    if (!c) return finish();
    answered = false;

    var wrap = el("div", "dy dy--card");

    var head = el("div", "dy__head");
    head.appendChild(el("span", "dy__count", (idx + 1) + " / " + cards.length));
    var pips = el("span", "dy__pips");
    pips.setAttribute("aria-hidden", "true");
    for (var i = 0; i < cards.length; i++) {
      var p = el("span", "dy__pip" + (i < idx ? " is-done" : i === idx ? " is-now" : ""));
      pips.appendChild(p);
    }
    head.appendChild(pips);
    wrap.appendChild(head);

    wrap.appendChild(el("p", "dy__kind", esc(c.kind)));
    wrap.appendChild(el("p", "dy__q" + (c.type === "quiz" ? " dy__q--sm" : ""), esc(c.text)));

    var opts = el("div", "dy__opts" + (c.type === "quiz" ? " dy__opts--stack" : ""));

    if (c.type === "quiz") {
      c.options.forEach(function (o, i) {
        var b = el("button", "dy__opt", esc(o));
        b.type = "button";
        b.addEventListener("click", function () { answer(c, i === c.answer, i); });
        opts.appendChild(b);
      });
    } else {
      // myth and bias are both a binary call, so they share one control pair
      // and one pair of arrow keys.
      [[c.left, true], [c.right, false]].forEach(function (pair) {
        var b = el("button", "dy__opt dy__opt--bin", esc(pair[0]));
        b.type = "button";
        b.addEventListener("click", function () { answer(c, pair[1] === c.yes, pair[1]); });
        opts.appendChild(b);
      });
    }
    wrap.appendChild(opts);

    var hint = c.type === "quiz" ? "Press 1 to " + c.options.length : "Press &larr; or &rarr;";
    wrap.appendChild(el("p", "dy__hint", hint));

    var out = el("div", "dy__reveal");
    out.id = "dyReveal";
    out.setAttribute("role", "status");
    out.setAttribute("aria-live", "polite");
    wrap.appendChild(out);

    render(wrap);
    keys(c, opts);
  }

  function keys(c, opts) {
    function onKey(e) {
      if (answered) {
        if (e.key === "Enter" || e.key === " ") {
          var n = root.querySelector(".dy__next");
          if (n) { e.preventDefault(); n.click(); }
        }
        return;
      }
      var bs = opts.querySelectorAll("button");
      if (c.type === "quiz") {
        var n = parseInt(e.key, 10);
        if (n >= 1 && n <= bs.length) { e.preventDefault(); bs[n - 1].click(); }
      } else {
        if (e.key === "ArrowLeft") { e.preventDefault(); bs[0].click(); }
        if (e.key === "ArrowRight") { e.preventDefault(); bs[1].click(); }
      }
    }
    document.addEventListener("keydown", onKey);
    root._offKey && root._offKey();
    root._offKey = function () { document.removeEventListener("keydown", onKey); };
  }

  function answer(c, correct, choice) {
    if (answered) return;
    answered = true;
    answers.push({ id: c.id, correct: correct });

    var opts = root.querySelectorAll(".dy__opt");
    Array.prototype.forEach.call(opts, function (b, i) {
      b.disabled = true;
      var isRight = c.type === "quiz" ? i === c.answer
                                      : (i === 0 ? true : false) === c.yes;
      if (isRight) b.classList.add("is-right");
      var picked = c.type === "quiz" ? i === choice : (i === 0) === choice;
      if (picked && !correct) b.classList.add("is-picked");
    });

    // Deliberately not "Wrong". The three games this replaces all made a point
    // of never scolding a reader, and that posture matters more here than a
    // score does: this is a minors' site, and the card is about to teach.
    var out = root.querySelector("#dyReveal");
    out.innerHTML =
      '<p class="dy__verdict' + (correct ? " is-yes" : "") + '">' +
        (correct ? "Yes, that&rsquo;s it." : "Not quite &mdash; here&rsquo;s the thing.") +
      "</p>" +
      '<p class="dy__why">' + esc(c.why || "") + "</p>";

    var next = el("button", "btn dy__next",
      idx + 1 < cards.length ? "Next card <span class=\"cta__arrow\" aria-hidden=\"true\">&rarr;</span>"
                             : "See how you did <span class=\"cta__arrow\" aria-hidden=\"true\">&rarr;</span>");
    next.type = "button";
    next.addEventListener("click", function () { idx++; card(); });
    out.appendChild(next);
    if (!reduce) out.classList.add("is-in");
    next.focus();
  }

  /* ---------- 3. the result --------------------------------------------- */

  function finish() {
    root._offKey && root._offKey();
    var score = answers.filter(function (a) { return a.correct; }).length;
    var s = load();
    s.streak = streakIfPlayedToday();
    s.best = Math.max(s.best || 0, s.streak);
    s.lastDay = day;
    s.today = answers;
    s.score = score;
    save(s);
    state = s;
    results(answers, false);
  }

  // Two grids for two places. The clipboard one has to be emoji, because a
  // pasted message cannot carry CSS. The on-page one must NOT be: the white
  // emoji square glares on the dark card and the brown one nearly vanishes
  // into it, so on the page it is drawn with the site's own tokens instead.
  function grid(list) {
    return list.map(function (a) { return a.correct ? "🟫" : "⬜"; }).join("");
  }

  function gridEl(list) {
    var e = el("p", "dy__grid");
    e.setAttribute("aria-label", list.filter(function (a) { return a.correct; }).length +
                   " of " + list.length + " correct");
    list.forEach(function (a) {
      e.appendChild(el("span", "dy__sq" + (a.correct ? " is-yes" : "")));
    });
    return e;
  }

  // Never a bare score. A round that went badly is the round that taught the
  // most, and this is the same site that refuses to show a red X.
  function verdictLine(score, total) {
    if (score === total) return "Every single one.";
    if (score >= Math.ceil(total * 0.6)) return "Good round.";
    if (score > 0) return "A few landed. The rest you know now.";
    return "That is what the round is for. You know them now.";
  }

  function results(list, returning) {
    root._offKey && root._offKey();
    var score = list.filter(function (a) { return a.correct; }).length;
    var wrap = el("div", "dy dy--done");

    wrap.appendChild(el("p", "dy__kicker",
      returning ? "You&rsquo;ve already played today" : "Round complete"));
    wrap.appendChild(gridEl(list));
    wrap.appendChild(el("p", "dy__score", "<b>" + score + "</b> of " + list.length));
    wrap.appendChild(el("p", "dy__verdict-line", esc(verdictLine(score, list.length))));

    if (state.streak) {
      wrap.appendChild(el("p", "dy__streak",
        '<span class="dy__flame" aria-hidden="true">&#128293;</span> <b>' +
        state.streak + "-day</b> streak" +
        (state.best > state.streak ? " &middot; best " + state.best : "")));
    }

    var share = el("button", "btn dy__share", "Copy my result");
    share.type = "button";
    share.addEventListener("click", function () {
      // Squares only, never the cards themselves: a result you can post
      // without spoiling the round for whoever reads it.
      var txt = "wearefeminismm · The Daily #" + dayNumber() + "\n" +
                grid(list) + "  " + score + "/" + list.length +
                (state.streak ? "\n🔥 " + state.streak + "-day streak" : "") +
                "\nemmanueladusi.github.io/wearefeminismm";
      var done = function () {
        share.textContent = "Copied";
        setTimeout(function () { share.textContent = "Copy my result"; }, 2000);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(done, function () { fallback(txt, done); });
      } else fallback(txt, done);
    });
    wrap.appendChild(share);

    wrap.appendChild(el("p", "dy__back", "A new round lands tomorrow."));

    // The review: the whole point of the thing is what it taught, so the
    // cards are listed again with their answers once the round is over.
    if (!returning) {
      var rev = el("div", "dy__review");
      rev.appendChild(el("h4", "dy__review-h", "What that was about"));
      list.forEach(function (a, i) {
        var c = cards[i];
        if (!c) return;
        var row = el("div", "dy__row");
        var q = el("p", "dy__row-q");
        q.appendChild(el("span", "dy__sq dy__sq--sm" + (a.correct ? " is-yes" : "")));
        q.appendChild(document.createTextNode(" " + c.text));
        row.appendChild(q);
        row.appendChild(el("p", "dy__row-a", esc(c.why || "")));
        rev.appendChild(row);
      });
      wrap.appendChild(rev);
    }

    render(wrap);
  }

  function fallback(txt, done) {
    var t = document.createElement("textarea");
    t.value = txt;
    t.setAttribute("readonly", "");
    t.style.cssText = "position:absolute;left:-9999px";
    document.body.appendChild(t);
    t.select();
    try { document.execCommand("copy"); done(); } catch (e) {}
    document.body.removeChild(t);
  }

  /* ---------- go --------------------------------------------------------- */

  if (!cards.length) {
    root.innerHTML = '<p class="dy__empty">Today&rsquo;s round could not load.</p>';
    return;
  }
  intro();
})();
