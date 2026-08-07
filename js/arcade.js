/* Play — the picker.
   ---------------------------------------------------------------------------
   Three activities used to sit open on top of each other, so the page was one
   long wall and you scrolled past two things to reach the one you wanted. Now
   they are boxes: pick one, it opens on its own, and a back control returns
   you to the shelf.

   Everything stays on one page. The games are already in the markup and only
   ever hidden, so no game has to know it is inside a picker, and one with a
   broken script still opens to whatever it managed to render.

   Each box carries its own state (streak, played today, letters today) because
   that is the part worth seeing before you choose: a shelf that says "you are
   four days in and today is seven letters" is a reason to tap. */

(function () {
  var shelf = document.getElementById("arcade");
  if (!shelf) return;

  var cards = Array.prototype.slice.call(shelf.querySelectorAll("[data-opens]"));
  if (!cards.length) return;

  var panels = {};
  cards.forEach(function (c) {
    var id = c.getAttribute("data-opens");
    var p = document.getElementById(id);
    if (p) panels[id] = p;
  });

  var shell = document.getElementById("arcadeShell");
  var backBtn = document.getElementById("arcadeBack");
  var nowTitle = document.getElementById("arcadeNow");
  if (!shell || !backBtn || !nowTitle) return;

  var open = null;

  function show(id, push) {
    var p = panels[id];
    if (!p) return;
    Object.keys(panels).forEach(function (k) { panels[k].hidden = k !== id; });
    shelf.hidden = true;
    shell.hidden = false;
    open = id;

    var card = cards.filter(function (c) { return c.getAttribute("data-opens") === id; })[0];
    nowTitle.textContent = card ? card.getAttribute("data-title") || "" : "";

    if (push) {
      try { history.pushState({ game: id }, "", "#" + id); } catch (e) {}
    }
    // Focus the heading rather than the first control: a screen reader should
    // hear WHICH game opened before it hears a button inside it.
    nowTitle.focus();
  }

  function shelfView(push) {
    Object.keys(panels).forEach(function (k) { panels[k].hidden = true; });
    shell.hidden = true;
    shelf.hidden = false;
    if (push) {
      try { history.pushState({ game: null }, "", location.pathname + location.search); } catch (e) {}
    }
    if (open) {
      var card = cards.filter(function (c) { return c.getAttribute("data-opens") === open; })[0];
      if (card) card.focus();
    }
    open = null;
  }

  cards.forEach(function (c) {
    c.addEventListener("click", function (e) {
      e.preventDefault();
      show(c.getAttribute("data-opens"), true);
    });
  });

  backBtn.addEventListener("click", function () { shelfView(true); });

  document.addEventListener("keydown", function (e) {
    // Escape backs out, but not while someone is typing a guess into a game.
    if (e.key !== "Escape" || !open) return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    shelfView(true);
  });

  addEventListener("popstate", function () {
    var id = location.hash.replace("#", "");
    if (panels[id]) show(id, false); else shelfView(false);
  });

  /* ---------- what each box says about itself -------------------------- */

  function read(key) {
    try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { return {}; }
  }
  function todayIdx() {
    var EPOCH = Date.UTC(2026, 7, 7) / 86400000;
    return Math.max(0, Math.floor(Date.now() / 86400000 - new Date().getTimezoneOffset() / 1440) - EPOCH);
  }

  function badge(card, text, hot) {
    var b = card.querySelector("[data-badge]");
    if (!b) return;
    b.textContent = text || "";
    b.hidden = !text;
    b.classList.toggle("is-hot", !!hot);
  }

  function status() {
    var d = todayIdx();

    var w = read("wf-word.v1");
    var wordCard = document.querySelector('[data-opens="theword"]');
    if (wordCard) {
      var list = window.WORD_LIST || [];
      var sub = wordCard.querySelector("[data-sub]");
      if (sub && list.length) {
        // Same dealer the game uses, so the shelf never advertises the wrong
        // length. Reading it from the game itself would mean exposing state
        // the game has no other reason to publish.
        var len = wordLenFor(d, list);
        if (len) sub.textContent = len + " letters today";
      }
      var doneW = w.day === d && (w.guesses || []).length &&
                  ((w.guesses || []).indexOf(undefined) === -1) && w.lastDay === d;
      badge(wordCard, doneW ? "Done today" : (w.streak ? "🔥 " + w.streak + " days" : ""), !doneW && w.streak);
    }

    var y = read("wf-daily.v1");
    var dailyCard = document.querySelector('[data-opens="dailyround"]');
    if (dailyCard) {
      badge(dailyCard, y.lastDay === d ? "Done today" : (y.streak ? "🔥 " + y.streak + " days" : ""),
            y.lastDay !== d && y.streak);
    }
  }

  // A copy of the game's rotation, kept deliberately small: it only needs the
  // LENGTH of today's word, never the word.
  function wordLenFor(d, list) {
    var words = list.filter(function (e) { return e && /^[a-zA-Z]{4,8}$/.test(e.w || ""); });
    if (!words.length) return 0;
    var n = words.length;
    function rng(seed) {
      return function () {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    var laps = {}, prev = null;
    for (var L = 0; L <= Math.floor(d / n); L++) {
      var r = rng(L * 6151 + 29), a = [], i;
      for (i = 0; i < n; i++) a.push(i);
      for (i = n - 1; i > 0; i--) { var j = (r() * (i + 1)) | 0, t = a[i]; a[i] = a[j]; a[j] = t; }
      if (prev && n > 2 && a[0] === prev[n - 1]) { a[0] = a[1]; a[1] = prev[n - 1]; }
      laps[L] = prev = a;
    }
    return words[laps[Math.floor(d / n)][((d % n) + n) % n]].w.length;
  }

  status();
  // The games write their state as they are played, so the shelf refreshes
  // whenever someone comes back out to it.
  backBtn.addEventListener("click", status);

  /* ---------- arriving from somewhere else ------------------------------ */

  // A challenge link (?w=day.score) must land IN the word game, not on a shelf
  // the friend then has to read. Same for a direct #hash.
  var hash = location.hash.replace("#", "");
  if (panels[hash]) show(hash, false);
  else if (/[?&]w=/.test(location.search) && panels.theword) show("theword", false);
  else shelfView(false);
})();
