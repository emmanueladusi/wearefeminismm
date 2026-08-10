/* The Word — a daily guessing puzzle whose length changes every day.
   ---------------------------------------------------------------------------
   Same shape as The Daily next to it: one puzzle per calendar day, the same
   puzzle for everyone, a streak that carries, and a result you can paste
   without spoiling it. Two things make it its own game rather than a clone:

     · THE LENGTH MOVES. Four letters one morning, eight the next. It kills the
       five-letter muscle memory people build up, and it means the grid itself
       tells you what kind of day it is before you type anything.
     · THE WORD TEACHES. Answers are drawn from js/wordList.js and every one
       ends by telling you what it means, win or lose. The puzzle is the hook;
       the meaning is what you leave with.

   Guesses scale with length (letters + 1), so a long day is not punishment.

   COMPETITION WITHOUT A SERVER. This site is static and promises that nothing
   a reader does is uploaded. So a friend's score travels in the URL they send
   you, not through a database: ?w=<day>.<score>. No accounts, nothing stored
   about anybody, and nothing to moderate. See challenge() at the bottom. */

(function () {
  var root = document.getElementById("wordle");
  if (!root) return;

  var KEY = "wf-word.v1";
  var EPOCH = Date.UTC(2026, 7, 7) / 86400000;

  var WORDS = (window.WORD_LIST || []).filter(function (e) {
    return e && typeof e.w === "string" && /^[a-zA-Z]{4,8}$/.test(e.w);
  }).map(function (e) {
    return { w: e.w.toUpperCase(), m: e.m || "" };
  });

  if (!WORDS.length) {
    root.innerHTML = '<p class="wd__empty">Today&rsquo;s word could not load.</p>';
    return;
  }

  /* ---------- which word, which day ------------------------------------- */

  function today() { return Math.floor(Date.now() / 86400000 - new Date().getTimezoneOffset() / 1440); }
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

  // Deal the list out rather than picking at random, so a word cannot come
  // back while others are still unseen, and reshuffle once the list is spent.
  var lapCache = {};
  function lapOrder(n, lap) {
    if (lapCache[lap]) return lapCache[lap];
    var i, L, prev = null, start = 0;
    while (lapCache[start]) start++;
    if (start > 0) prev = lapCache[start - 1];
    for (L = start; L <= lap; L++) {
      var r = rng(L * 6151 + 29), a = [];
      for (i = 0; i < n; i++) a.push(i);
      for (i = n - 1; i > 0; i--) { var j = (r() * (i + 1)) | 0, t = a[i]; a[i] = a[j]; a[j] = t; }
      // Don't let the word that closed the last pass open the next one.
      if (prev && n > 2 && a[0] === prev[n - 1]) { a[0] = a[1]; a[1] = prev[n - 1]; }
      lapCache[L] = prev = a;
    }
    return lapCache[lap];
  }

  function wordFor(d) {
    var n = WORDS.length;
    return WORDS[lapOrder(n, Math.floor(d / n))[((d % n) + n) % n]];
  }

  /* ---------- presentation-day override -----------------------------------
     Pinned by hand for the live talk: every visitor gets WEAREFEMINISMM
     instead of whatever the normal rotation would deal, regardless of the
     real date. Deliberately bypasses WORDS and its 4-8 letter filter (line
     29) rather than being added to the pool, since this is a one-off, not a
     real day's word that should ever come up again in the rotation.
     SET TO null TO GO BACK TO NORMAL. That is the only edit this needs. */
  var FORCE_WORD = { w: "WEAREFEMINISMM", m: "The name of this site. Two m's, on purpose." };

  var day = dayIndex();
  var TARGET = FORCE_WORD ? FORCE_WORD.w : wordFor(day).w;
  var MEANING = FORCE_WORD ? FORCE_WORD.m : wordFor(day).m;
  var LEN = TARGET.length;
  var TRIES = LEN + 1;

  /* ---------- saved state ------------------------------------------------ */

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }

  var state = load();
  var guesses = (state.day === day && state.guesses) ? state.guesses.slice() : [];
  var over = guesses.indexOf(TARGET) > -1 || guesses.length >= TRIES;
  var current = "";

  /* ---------- marking ---------------------------------------------------- */

  // Two passes, and it has to be two: a single pass marks the second L in
  // SPELL yellow when the answer holds only one L. Exact hits are claimed
  // first, then near-misses draw from whatever letters are actually left.
  function mark(guess) {
    var res = new Array(LEN), left = {}, i, ch;
    for (i = 0; i < LEN; i++) {
      if (guess[i] === TARGET[i]) res[i] = "hit";
      else { ch = TARGET[i]; left[ch] = (left[ch] || 0) + 1; }
    }
    for (i = 0; i < LEN; i++) {
      if (res[i]) continue;
      ch = guess[i];
      if (left[ch] > 0) { res[i] = "near"; left[ch]--; }
      else res[i] = "off";
    }
    return res;
  }

  var LABEL = { hit: "correct", near: "in the word, wrong place", off: "not in the word" };

  /* ---------- view ------------------------------------------------------- */

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

  var gridEl, msgEl, keyEl, footEl;

  function build() {
    root.innerHTML = "";
    var wrap = el("div", "wd");

    var head = el("div", "wd__head");
    head.appendChild(el("p", "wd__kicker",
      "The Word &middot; #" + dayNumber() + " &middot; <b>" + LEN + " letters</b>, " + TRIES + " guesses"));
    wrap.appendChild(head);

    var ch = challenge();
    if (ch !== null && !over) {
      wrap.appendChild(el("p", "wd__chal",
        "Someone sent you this one. They got it in <b>" +
        (ch === 0 ? "no" : ch) + "</b>" + (ch === 1 ? " guess" : " guesses") + "."));
    }

    gridEl = el("div", "wd__grid");
    gridEl.style.setProperty("--len", LEN);
    wrap.appendChild(gridEl);

    msgEl = el("p", "wd__msg");
    msgEl.setAttribute("role", "status");
    msgEl.setAttribute("aria-live", "polite");
    wrap.appendChild(msgEl);

    keyEl = el("div", "wd__keys");
    wrap.appendChild(keyEl);

    footEl = el("div", "wd__foot");
    wrap.appendChild(footEl);

    root.appendChild(wrap);
    drawGrid();
    drawKeys();
    if (over) endScreen();
  }

  function drawGrid() {
    gridEl.innerHTML = "";
    for (var r = 0; r < TRIES; r++) {
      var row = el("div", "wd__row");
      var g = guesses[r];
      var res = g ? mark(g) : null;
      for (var c = 0; c < LEN; c++) {
        var t = el("div", "wd__t");
        if (g) {
          t.textContent = g[c];
          t.classList.add("is-" + res[c]);
          t.setAttribute("aria-label", g[c] + ", " + LABEL[res[c]]);
        } else if (r === guesses.length && c < current.length) {
          t.textContent = current[c];
          t.classList.add("is-typed");
        }
        row.appendChild(t);
      }
      gridEl.appendChild(row);
    }
  }

  var ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

  function keyState() {
    var best = {};
    var rank = { off: 0, near: 1, hit: 2 };
    guesses.forEach(function (g) {
      var res = mark(g);
      for (var i = 0; i < LEN; i++) {
        var c = g[i];
        if (best[c] === undefined || rank[res[i]] > rank[best[c]]) best[c] = res[i];
      }
    });
    return best;
  }

  function drawKeys() {
    keyEl.innerHTML = "";
    var st = keyState();
    ROWS.forEach(function (rowStr, ri) {
      var row = el("div", "wd__krow");
      if (ri === 2) row.appendChild(mkKey("↵", "enter", "Submit guess"));
      rowStr.split("").forEach(function (c) {
        var b = mkKey(c, c, null);
        if (st[c]) b.classList.add("is-" + st[c]);
        row.appendChild(b);
      });
      if (ri === 2) row.appendChild(mkKey("⌫", "back", "Delete letter"));
      keyEl.appendChild(row);
    });
  }

  function mkKey(label, val, aria) {
    var b = el("button", "wd__k" + (val === "enter" || val === "back" ? " wd__k--wide" : ""), esc(label));
    b.type = "button";
    if (aria) b.setAttribute("aria-label", aria);
    b.addEventListener("click", function () { press(val); });
    return b;
  }

  /* ---------- input ------------------------------------------------------ */

  function say(t) {
    msgEl.textContent = t;
    if (t) setTimeout(function () { if (msgEl.textContent === t) msgEl.textContent = ""; }, 2200);
  }

  function press(v) {
    if (over) return;
    if (v === "enter") return submit();
    if (v === "back") { current = current.slice(0, -1); drawGrid(); return; }
    if (!/^[A-Z]$/.test(v)) return;
    if (current.length >= LEN) return;
    current += v;
    drawGrid();
  }

  function submit() {
    if (current.length < LEN) {
      // No dictionary is shipped, so a guess is never rejected for not being
      // "a word". A 4-to-8 letter dictionary is 580KB, it would refuse plenty
      // of real words anyway, and being told your valid word is invalid is far
      // more irritating than being allowed to waste your own turn.
      say("Needs " + LEN + " letters.");
      var row = gridEl.children[guesses.length];
      if (row) { row.classList.remove("is-nudge"); void row.offsetWidth; row.classList.add("is-nudge"); }
      return;
    }
    guesses.push(current);
    var won = current === TARGET;
    current = "";
    over = won || guesses.length >= TRIES;

    var s = load();
    if (over) {
      // The streak counts days finished, won or lost: this is a teaching site,
      // and coming back is the behaviour worth rewarding.
      s.streak = (s.lastDay === day - 1) ? (s.streak || 0) + 1 : 1;
      if (s.lastDay === day) s.streak = s.streak || 1;
      s.best = Math.max(s.best || 0, s.streak);
      s.lastDay = day;
      s.wins = (s.wins || 0) + (won ? 1 : 0);
      s.played = (s.played || 0) + 1;
    }
    s.day = day;
    s.guesses = guesses;
    save(s);
    state = s;

    drawGrid();
    drawKeys();
    if (over) endScreen();
  }

  function onKey(e) {
    if (over) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Enter") { e.preventDefault(); press("enter"); }
    else if (e.key === "Backspace") { e.preventDefault(); press("back"); }
    else if (/^[a-zA-Z]$/.test(e.key)) { e.preventDefault(); press(e.key.toUpperCase()); }
  }
  document.addEventListener("keydown", onKey);

  /* ---------- the end ---------------------------------------------------- */

  function rowsEmoji() {
    return guesses.map(function (g) {
      return mark(g).map(function (m) {
        return m === "hit" ? "🟫" : m === "near" ? "🟨" : "⬜";
      }).join("");
    }).join("\n");
  }

  function score() { return guesses.indexOf(TARGET) > -1 ? guesses.length : 0; }

  function endScreen() {
    var won = guesses.indexOf(TARGET) > -1;
    footEl.innerHTML = "";

    footEl.appendChild(el("p", "wd__verdict" + (won ? " is-yes" : ""),
      won ? (guesses.length === 1 ? "First guess." : "Got it in " + guesses.length + ".")
          : "Out of guesses."));

    // Win or lose, the word and its meaning. This is the part that matters.
    footEl.appendChild(el("p", "wd__answer", esc(TARGET.toLowerCase())));
    if (MEANING) footEl.appendChild(el("p", "wd__meaning", esc(MEANING)));

    if (state.streak) {
      footEl.appendChild(el("p", "wd__streak",
        '<span aria-hidden="true">&#128293;</span> <b>' + state.streak + "-day</b> streak" +
        (state.best > state.streak ? " &middot; best " + state.best : "")));
    }

    var ch = challenge();
    if (ch !== null) {
      var mine = score(), theirs = ch;
      var line = mine === 0 ? "They got it, you did not. Rematch tomorrow."
        : theirs === 0 ? "You got it and they did not."
        : mine < theirs ? "You beat them by " + (theirs - mine) + "."
        : mine > theirs ? "They beat you by " + (mine - theirs) + "."
        : "A tie. Both in " + mine + ".";
      footEl.appendChild(el("p", "wd__versus",
        '<span class="wd__vs-row">you <b>' + (mine || "x") + "</b></span>" +
        '<span class="wd__vs-row">them <b>' + (theirs || "x") + "</b></span>" +
        '<span class="wd__vs-line">' + line + "</span>"));
    }

    var row = el("div", "wd__actions");

    var sh = el("button", "btn wd__share", "Copy my result");
    sh.type = "button";
    sh.addEventListener("click", function () {
      copy("wearefeminismm · The Word #" + dayNumber() +
           " (" + LEN + " letters)\n" +
           (won ? guesses.length : "x") + "/" + TRIES + "\n" + rowsEmoji() +
           (state.streak ? "\n🔥 " + state.streak + "-day streak" : "") +
           "\nemmanueladusi.github.io/wearefeminismm/play.html", sh, "Copy my result");
    });
    row.appendChild(sh);

    var cl = el("button", "btn btn--gold wd__chalbtn", "Challenge a friend");
    cl.type = "button";
    cl.addEventListener("click", function () {
      // Just the day and the score. Nothing about who they are, because
      // nothing about who they are is ever collected.
      var url = location.origin + location.pathname + "?w=" + day + "." + score();
      copy("Beat me on today's word: " + LEN + " letters, I got it in " +
           (score() || "no") + ".\n" + url, cl, "Challenge a friend");
    });
    row.appendChild(cl);

    footEl.appendChild(row);
    footEl.appendChild(el("p", "wd__back", "A new word lands tomorrow."));
  }

  function copy(txt, btn, label) {
    var done = function () {
      btn.textContent = "Copied";
      setTimeout(function () { btn.textContent = label; }, 2000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done, function () { fallback(txt, done); });
    } else fallback(txt, done);
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

  /* ---------- the challenge in the URL ----------------------------------- */

  // Everything here arrives from a link somebody was sent, so it is parsed
  // strictly and thrown away unless it is exactly two small integers for
  // TODAY. A stale link is worse than no link: comparing your score against a
  // different day's puzzle would be nonsense.
  var chalCache;
  function challenge() {
    if (chalCache !== undefined) return chalCache;
    chalCache = null;
    try {
      var raw = new URLSearchParams(location.search).get("w");
      if (raw && /^\d{1,7}\.\d{1,2}$/.test(raw)) {
        var parts = raw.split(".");
        var d = parseInt(parts[0], 10), sc = parseInt(parts[1], 10);
        if (d === day && sc >= 0 && sc <= 9) chalCache = sc;
      }
    } catch (e) {}
    return chalCache;
  }

  build();
})();
