/* The Crossword — a mini crossword built entirely from this site's own
   content: every answer is a word, name or place a reader could have met on
   Learn, Community, or the Time Machine. Puzzle data is generated (see
   tools/gen_crossword.py) into js/crosswordData.js and never hand-edited.
   ---------------------------------------------------------------------------
   Same shape as The Word and The Daily next to it: one puzzle per calendar
   day, the same puzzle for everyone, a streak that carries, and nothing
   uploaded anywhere. Unlike a full Sunday-size grid, this stays small
   (roughly a dozen answers) on purpose: it fits one phone screen without
   scrolling the grid itself, only the clue list beneath it. */

(function () {
  var root = document.getElementById("crossword");
  if (!root) return;

  var PUZZLES = window.CROSSWORDS || [];
  if (!PUZZLES.length) {
    root.innerHTML = '<p class="xw__empty">Today&rsquo;s crossword could not load.</p>';
    return;
  }

  var KEY = "wf-crossword.v1";
  var EPOCH = Date.UTC(2026, 7, 7) / 86400000;

  function today() { return Math.floor(Date.now() / 86400000 - new Date().getTimezoneOffset() / 1440); }
  function dayIndex() { return Math.max(0, today() - EPOCH); }
  function dayNumber() { return dayIndex() + 1; }

  // Same shuffle-then-deal approach as js/wordle.js: everyone gets the same
  // puzzle on a given day, and a puzzle cannot repeat until the whole set has
  // been seen once.
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var lapCache = {};
  function lapOrder(n, lap) {
    if (lapCache[lap]) return lapCache[lap];
    var i, prev = lapCache[lap - 1], r = rng(lap * 7919 + 11), a = [];
    for (i = 0; i < n; i++) a.push(i);
    for (i = n - 1; i > 0; i--) { var j = (r() * (i + 1)) | 0, t = a[i]; a[i] = a[j]; a[j] = t; }
    if (prev && n > 2 && a[0] === prev[n - 1]) { a[0] = a[1]; a[1] = prev[n - 1]; }
    lapCache[lap] = a;
    return a;
  }
  function puzzleForDay(d) {
    var n = PUZZLES.length;
    var lap = Math.floor(d / n), pos = ((d % n) + n) % n;
    return PUZZLES[lapOrder(n, lap)[pos]];
  }

  var DAY = dayIndex();
  var PZ = puzzleForDay(DAY);

  /* ---------- read / write progress -------------------------------------- */

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function write(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }

  var state = read();
  // A grid whose letters carry over from a stale day would show yesterday's
  // half-solved puzzle inside today's answers, so any day mismatch resets it.
  if (state.day !== DAY) state = { day: DAY, letters: {}, done: false, streak: state.streak || 0, lastDay: state.lastDay };

  /* ---------- build the grid lookup -------------------------------------- */

  var cellOf = {};      // "r,x" -> {solution, entries:[entry,...]}
  var numAt = {};        // "r,x" -> printed number
  PZ.entries.forEach(function (e) {
    numAt[e.r + "," + e.x] = e.n;
    var dr = e.d === "A" ? 0 : 1, dc = e.d === "A" ? 1 : 0;
    for (var i = 0; i < e.a.length; i++) {
      var r = e.r + dr * i, c = e.x + dc * i, k = r + "," + c;
      if (!cellOf[k]) cellOf[k] = { solution: e.a[i], entries: [] };
      cellOf[k].entries.push({ entry: e, index: i });
    }
  });

  /* ---------- render ------------------------------------------------------ */

  root.innerHTML =
    '<div class="xw">' +
      '<p class="xw__kicker">Crossword <b>#' + dayNumber() + '</b></p>' +
      '<div class="xw__board" role="group" aria-label="Crossword grid">' +
        '<div class="xw__grid" id="xwGrid" style="--gh:' + PZ.h + ';--gw:' + PZ.w + '"></div>' +
      '</div>' +
      '<p class="xw__active" id="xwActive" aria-live="polite"></p>' +
      '<div class="xw__hints">' +
        '<button class="xw__hintbtn" id="xwHint" type="button">Reveal a letter</button>' +
        '<span class="xw__hintnote">Stuck on one? Reveal the selected square. It still counts as solved.</span>' +
      '</div>' +
      '<div class="xw__clues" id="xwClues"></div>' +
      '<div class="xw__foot" id="xwFoot" hidden></div>' +
    '</div>';

  var gridEl = document.getElementById("xwGrid");
  var activeEl = document.getElementById("xwActive");
  var cluesEl = document.getElementById("xwClues");
  var footEl = document.getElementById("xwFoot");
  var hintEl = document.getElementById("xwHint");

  var inputs = {}; // "r,x" -> input element

  for (var r = 0; r < PZ.h; r++) {
    for (var c = 0; c < PZ.w; c++) {
      var key = r + "," + c;
      var cell = cellOf[key];
      if (!cell) {
        var blank = document.createElement("div");
        blank.className = "xw__cell xw__cell--void";
        blank.setAttribute("aria-hidden", "true");
        gridEl.appendChild(blank);
        continue;
      }
      var wrap = document.createElement("div");
      wrap.className = "xw__cell";
      if (numAt[key]) {
        var num = document.createElement("span");
        num.className = "xw__num";
        num.textContent = numAt[key];
        num.setAttribute("aria-hidden", "true");
        wrap.appendChild(num);
      }
      var inp = document.createElement("input");
      inp.className = "xw__in";
      inp.setAttribute("maxlength", "1");
      inp.setAttribute("autocomplete", "off");
      inp.setAttribute("autocapitalize", "characters");
      inp.setAttribute("inputmode", "text");
      inp.setAttribute("aria-label", "Row " + (r + 1) + ", column " + (c + 1));
      inp.dataset.r = r; inp.dataset.c = c;
      if (state.letters[key]) inp.value = state.letters[key];
      wrap.appendChild(inp);
      gridEl.appendChild(wrap);
      inputs[key] = inp;
    }
  }

  /* ---------- clue list ---------------------------------------------------- */

  var across = PZ.entries.filter(function (e) { return e.d === "A"; });
  var down = PZ.entries.filter(function (e) { return e.d === "D"; });

  function clueGroup(title, list) {
    var html = '<div class="xw__cluegroup"><h3 class="xw__cluehead">' + title + '</h3><ol class="xw__cluelist">';
    list.forEach(function (e) {
      html += '<li class="xw__clue" data-entry="' + e.r + "," + e.x + "," + e.d + '" tabindex="0">' +
                '<span class="xw__cluenum">' + e.n + '</span><span class="xw__cluetext">' + e.c + '</span>' +
              '</li>';
    });
    return html + '</ol></div>';
  }
  cluesEl.innerHTML = clueGroup("Across", across) + clueGroup("Down", down);

  /* ---------- selection state ---------------------------------------------- */

  var curEntry = PZ.entries[0];
  var curCellKey = curEntry.r + "," + curEntry.x;

  function entriesAt(key) { return (cellOf[key] || {}).entries || []; }

  function paintSelection() {
    Object.keys(inputs).forEach(function (k) { inputs[k].closest(".xw__cell").classList.remove("is-inword", "is-cursor"); });
    document.querySelectorAll(".xw__clue.is-active").forEach(function (el) { el.classList.remove("is-active"); });
    if (!curEntry) return;
    var dr = curEntry.d === "A" ? 0 : 1, dc = curEntry.d === "A" ? 1 : 0;
    for (var i = 0; i < curEntry.a.length; i++) {
      var k = (curEntry.r + dr * i) + "," + (curEntry.x + dc * i);
      var cellEl = inputs[k] && inputs[k].closest(".xw__cell");
      if (cellEl) cellEl.classList.add("is-inword");
    }
    var curCell = inputs[curCellKey] && inputs[curCellKey].closest(".xw__cell");
    if (curCell) curCell.classList.add("is-cursor");
    var clueEl = cluesEl.querySelector('[data-entry="' + curEntry.r + "," + curEntry.x + "," + curEntry.d + '"]');
    if (clueEl) {
      clueEl.classList.add("is-active");
      clueEl.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    activeEl.textContent = curEntry.n + " " + (curEntry.d === "A" ? "Across" : "Down") + ": " + curEntry.c;
  }

  function selectEntry(entry, cellKey) {
    curEntry = entry;
    curCellKey = cellKey || (entry.r + "," + entry.x);
    paintSelection();
  }

  function focusCell(key) {
    var inp = inputs[key];
    if (inp) inp.focus();
  }

  gridEl.addEventListener("click", function (e) {
    var inp = e.target.closest(".xw__in");
    if (!inp) return;
    var key = inp.dataset.r + "," + inp.dataset.c;
    var here = entriesAt(key);
    if (!here.length) return;
    // Tapping a cell that belongs to the current word just moves the cursor;
    // tapping a cell whose word has changed swaps which clue is highlighted.
    var stillInCurrent = here.some(function (h) { return h.entry === curEntry; });
    var target = stillInCurrent ? curEntry : here[0].entry;
    selectEntry(target, key);
  });

  cluesEl.addEventListener("click", function (e) {
    var li = e.target.closest(".xw__clue");
    if (!li) return;
    var parts = li.dataset.entry.split(",");
    var entry = PZ.entries.filter(function (e2) { return e2.r == parts[0] && e2.x == parts[1] && e2.d === parts[2]; })[0];
    if (entry) { selectEntry(entry); focusCell(entry.r + "," + entry.x); }
  });
  cluesEl.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var li = e.target.closest(".xw__clue");
    if (!li) return;
    e.preventDefault();
    li.click();
  });

  // Reveal a letter: fills whichever cell is currently selected with its
  // correct answer and moves on, the same path a typed letter takes. It
  // still checks completion and still counts as solved for the streak, since
  // the goal here is "not stuck", not "caught cheating".
  hintEl.addEventListener("click", function () {
    var inp = inputs[curCellKey];
    var cell = cellOf[curCellKey];
    if (!inp || !cell || inp.disabled) return;
    inp.value = cell.solution;
    inp.closest(".xw__cell").classList.add("is-hinted");
    state.letters[curCellKey] = cell.solution;
    write(state);
    checkComplete();
    advanceAfterInput(curCellKey);
  });

  function stepWithin(key, dir) {
    // dir +1/-1 along the current word's axis
    var dr = curEntry.d === "A" ? 0 : 1, dc = curEntry.d === "A" ? 1 : 0;
    var parts = key.split(",").map(Number);
    var nr = parts[0] + dr * dir, nc = parts[1] + dc * dir;
    var nk = nr + "," + nc;
    return inputs[nk] ? nk : null;
  }

  function advanceAfterInput(key) {
    var next = stepWithin(key, 1);
    if (next) focusCell(next);
  }

  function otherEntryAt(key) {
    var here = entriesAt(key);
    if (here.length < 2) return null;
    var other = here.filter(function (h) { return h.entry !== curEntry; })[0];
    return other ? other.entry : null;
  }

  root.addEventListener("keydown", function (e) {
    var inp = e.target.closest(".xw__in");
    if (!inp) return;
    var key = inp.dataset.r + "," + inp.dataset.c;

    if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      var wantAcross = e.key === "ArrowLeft" || e.key === "ArrowRight";
      var dir = (e.key === "ArrowRight" || e.key === "ArrowDown") ? 1 : -1;
      if (wantAcross !== (curEntry.d === "A")) {
        // Arrow doesn't match the current word's axis: swap to the crossing
        // word here if one exists, then move.
        var other = entriesAt(key).filter(function (h) { return (h.entry.d === "A") === wantAcross; })[0];
        if (other) selectEntry(other.entry, key);
      }
      var dr2 = wantAcross ? 0 : 1, dc2 = wantAcross ? 1 : 0;
      var parts = key.split(",").map(Number);
      var nk = (parts[0] + dr2 * dir) + "," + (parts[1] + dc2 * dir);
      if (inputs[nk]) focusCell(nk);
      return;
    }

    if (e.key === "Backspace") {
      if (inp.value) {
        // Clearing a filled cell stays put, matching how phone keyboards and
        // every other crossword app behaves; only an ALREADY-empty cell steps
        // back, or backspacing would blow through two letters per press.
        inp.value = "";
        delete state.letters[key];
        write(state);
        return;
      }
      e.preventDefault();
      var prev = stepWithin(key, -1);
      if (prev) {
        focusCell(prev);
        inputs[prev].value = "";
        delete state.letters[prev];
        write(state);
      }
      return;
    }

    if (e.key === "Tab") return; // let native focus order work

    if (/^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault();
      inp.value = e.key.toUpperCase();
      state.letters[key] = inp.value;
      write(state);
      checkComplete();
      advanceAfterInput(key);
    }
  });

  // A tap on mobile fires an input event (virtual keyboard), not a keydown
  // with a real key code, so letters typed via a phone's own keyboard need
  // their own path in besides the keydown handler above.
  gridEl.addEventListener("input", function (e) {
    var inp = e.target.closest(".xw__in");
    if (!inp) return;
    var v = (inp.value || "").replace(/[^a-zA-Z]/g, "").slice(-1).toUpperCase();
    inp.value = v;
    var key = inp.dataset.r + "," + inp.dataset.c;
    if (v) { state.letters[key] = v; write(state); checkComplete(); advanceAfterInput(key); }
    else { delete state.letters[key]; write(state); }
  });

  /* ---------- completion --------------------------------------------------- */

  function checkComplete() {
    if (state.done) return;
    var allFilled = Object.keys(cellOf).every(function (k) { return state.letters[k]; });
    if (!allFilled) return;
    var allRight = Object.keys(cellOf).every(function (k) { return state.letters[k] === cellOf[k].solution; });
    if (!allRight) return;
    finish();
  }

  function finish() {
    state.done = true;
    var isNewToday = state.lastDay !== DAY;
    state.streak = isNewToday ? (state.streak || 0) + 1 : (state.streak || 1);
    state.lastDay = DAY;
    write(state);

    Object.keys(inputs).forEach(function (k) { inputs[k].disabled = true; inputs[k].closest(".xw__cell").classList.add("is-solved"); });
    hintEl.hidden = true;

    footEl.hidden = false;
    footEl.innerHTML =
      '<p class="xw__verdict is-yes">Solved.</p>' +
      '<p class="xw__streak">Streak: <b>' + state.streak + '</b> day' + (state.streak === 1 ? "" : "s") + '</p>' +
      '<p class="xw__back">Come back tomorrow for a new grid.</p>';
  }

  /* ---------- resume a saved-but-unsolved grid ------------------------------ */

  if (state.done) {
    Object.keys(inputs).forEach(function (k) { inputs[k].disabled = true; inputs[k].closest(".xw__cell").classList.add("is-solved"); });
    hintEl.hidden = true;
    footEl.hidden = false;
    footEl.innerHTML =
      '<p class="xw__verdict is-yes">Solved.</p>' +
      '<p class="xw__streak">Streak: <b>' + (state.streak || 1) + '</b> day' + ((state.streak || 1) === 1 ? "" : "s") + '</p>' +
      '<p class="xw__back">Come back tomorrow for a new grid.</p>';
  }

  selectEntry(PZ.entries[0]);
})();
