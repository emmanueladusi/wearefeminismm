/* The year machine (voice.html) — the visitor types their age and is SENT
   BACK: a full-screen takeover where the year itself ticks from 2026 down to
   1912, landing on "It's 1912. You're 16." Then the takeover lifts and the
   milestones unroll, each stamped with how old they'd be when the right
   actually arrived in Canada. Ends at the wall: say something to the girls
   still waiting.

   Everything runs on-page: the age is never stored or sent anywhere.

   The gut punch is the "line": a girl of that generation who reached
   adulthood could expect to live to about 68, so every milestone after that
   renders ghosted. 68 is life expectancy AT AGE 20, not at birth (that was
   far lower, dragged down by infant deaths) — the visitor is already 16 here,
   so the conditional figure is the honest one. Period life tables also freeze
   that year's death rates, so real women often outlived it: the copy hedges
   with "most likely" rather than claiming she never saw it. Sources for every
   date are on receipts.html#sources — update both together. */
(function () {
  var BASE = 1912;
  var LIFESPAN = 68;
  var THIS_YEAR = 2026;
  var TRAVEL_MS = 2400;   // the 2026 -> 1912 tick
  var HOLD_MS = 1700;     // how long "It's 1912. You're 16." hangs alone

  var EVENTS = [
    { y: 1918, t: "Most women can vote federally for the first time. “Most”: Asian and Indigenous women are told to keep waiting.", dark: true },
    { y: 1929, t: "Women count as “persons” who can be appointed to the Senate. Five women had to fight all the way to London to get that answer." },
    { y: 1947, t: "Chinese and South Asian Canadians win back the federal vote after British Columbia drops its race bar.", dark: true },
    { y: 1948, t: "Parliament strikes race out of the federal election law, and Japanese Canadians get the vote back. The first ballots are cast in 1949.", dark: true },
    { y: 1960, t: "Indigenous women (and men) can vote federally without being forced to give up their status.", dark: true },
    { y: 1964, t: "In Quebec, a married woman can finally open a bank account or sign a contract without her husband’s signature." },
    { y: 1965, t: "Ontario’s last segregated Black school closes, a year after the law allowing it was struck down. Nova Scotia ended segregation on paper in 1954, but its last Black school stays open until 1983.", dark: true },
    { y: 1969, t: "Parliament takes birth control out of the Criminal Code. Until now it was a crime to sell or advertise contraception in Canada." },
    { y: 1971, t: "Ottawa starts paying maternity benefits: 15 weeks of income if you had worked enough weeks. Keeping your actual job was still up to your province." },
    { y: 1983, t: "Sexual assault inside a marriage becomes a crime. Until now the law defined rape so that a wife did not count." },
    { y: 1985, t: "Charter equality rights come into force, and Indigenous women who lost status by marrying begin to win it back.", dark: true },
    { y: 1993, t: "Canada swears in its first female Prime Minister. She is still the only one." }
  ];

  var input = document.getElementById("ymAge");
  var go = document.getElementById("ymGo");
  var list = document.getElementById("ymList");
  var foot = document.getElementById("ymFoot");
  var travel = document.getElementById("ymTravel");
  var travelYear = document.getElementById("ymTravelYear");
  var travelScene = document.getElementById("ymTravelScene");
  if (!input || !go || !list) return;

  /* Accessible mode is the site's own control and must carry the same
     weight as the OS setting. Without the data-a11y half, a visitor who
     deliberately turned motion down still got the full-screen takeover. */
  function reduced() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
           document.documentElement.hasAttribute("data-a11y");
  }
  var running = false;

  document.querySelectorAll(".ym__step").forEach(function (b) {
    b.addEventListener("click", function () {
      input.value = clampAge(parseInt(input.value, 10) + parseInt(b.getAttribute("data-d"), 10));
    });
  });

  function clampAge(v) {
    if (isNaN(v)) return 16;
    return Math.min(25, Math.max(10, v));
  }

  function item(cls, html) {
    var li = document.createElement("li");
    li.className = "ym__item " + (cls || "");
    li.innerHTML = html;
    return li;
  }

  function buildRows(age) {
    var born = BASE - age;
    var rows = [];
    rows.push(item("ym__item--open", '<p class="ym__scene">It’s ' + BASE + ". You’re " + age + ". You were born in " + born + ".</p>"));
    var crossed = false;
    EVENTS.forEach(function (e) {
      var at = age + (e.y - BASE);
      if (!crossed && at > LIFESPAN) {
        crossed = true;
        rows.push(item("ym__item--line", '<p class="ym__scene">A girl born in ' + born + " who made it to adulthood could expect to live to about " + LIFESPAN + ". Everything below this line most likely arrived after you were gone. Most likely: some women did see it.</p>"));
      }
      var gone = at > LIFESPAN;
      rows.push(item(
        (e.dark ? "ym__item--dark " : "") + (gone ? "ym__item--gone" : ""),
        '<span class="ym__year">' + e.y + '</span><span class="ym__at">' + (gone ? "you’d have been " : "you’re ") + at + "</span><p>" + e.t + "</p>"
      ));
    });
    /* no age on this row: "you'd have been 129" reads as a glitch and steals
       the closing fact */
    rows.push(item("ym__item--gone ym__item--now",
      '<span class="ym__year">' + THIS_YEAR + '</span><span class="ym__at">today</span><p>The gap is still open: women in Canada earn about 89 cents an hour for every dollar a man earns, and racialized women about 78 cents. Some waits aren’t over.</p>'));
    return rows;
  }

  function unroll(rows) {
    rows.forEach(function (li) { list.appendChild(li); });
    if (reduced()) {
      rows.forEach(function (li) { li.classList.add("in"); });
      foot.hidden = false;
      return;
    }
    rows.forEach(function (li, i) {
      setTimeout(function () { li.classList.add("in"); }, 300 + i * 420);
    });
    setTimeout(function () { foot.hidden = false; }, 300 + rows.length * 420);
  }

  function scrollToList() {
    var top = list.getBoundingClientRect().top + window.scrollY - 110;
    if (window.__lenis) { window.__lenis.scrollTo(top, { immediate: true }); }
    else { window.scrollTo(0, top); }
  }

  /* --- the takeover: year ticks 2026 -> 1912, scene line, then lift --- */
  var travelDone = null;   // when set, finishing early is allowed (tap to skip)

  function lockScroll(on) {
    document.body.classList.toggle("ym-lock", on);
    var lenis = window.__lenis;
    if (lenis) { on ? lenis.stop() : lenis.start(); }
  }

  function runTravel(age, after) {
    var start = null;
    var finished = false;
    var raf = null;
    var holdTimer = null;

    function finish() {
      if (finished) return;
      finished = true;
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(holdTimer);
      travel.classList.remove("on");
      travelScene.classList.remove("show");
      travel.setAttribute("aria-hidden", "true");
      lockScroll(false);
      if (document.activeElement === travel) go.focus();
      travelDone = null;
      after();
    }
    travelDone = finish;

    travel.setAttribute("aria-hidden", "false");
    travelYear.textContent = String(THIS_YEAR);
    travelScene.textContent = "It’s " + BASE + ". You’re " + age + ".";
    travel.classList.add("on");
    lockScroll(true);
    // after .on: a visibility:hidden element cannot take focus
    travel.focus();

    function ease(t) { return 1 - Math.pow(1 - t, 3); }   // fast leave, slow landing
    function tick(ts) {
      if (finished) return;
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / TRAVEL_MS);
      travelYear.textContent = String(Math.round(THIS_YEAR - (THIS_YEAR - BASE) * ease(p)));
      if (p < 1) { raf = requestAnimationFrame(tick); return; }
      travelScene.classList.add("show");
      holdTimer = setTimeout(finish, HOLD_MS);
    }
    raf = requestAnimationFrame(tick);

    // safety: never strand the visitor if rAF stalls (background tab, etc.)
    setTimeout(function () {
      if (!finished) { travelYear.textContent = String(BASE); travelScene.classList.add("show"); }
      setTimeout(finish, HOLD_MS);
    }, TRAVEL_MS + 250);
  }

  /* Dismissal: pointer, Escape, or any key. It is a full-screen overlay with
     locked scroll, so a keyboard user needs a real way out and the focus has
     to live inside it while it is up. */
  travel.addEventListener("click", function () { if (travelDone) travelDone(); });
  document.addEventListener("keydown", function (e) {
    if (!travelDone) return;
    if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      travelDone();
    }
  });

  function run() {
    if (running) return;
    running = true;
    var age = clampAge(parseInt(input.value, 10));
    input.value = age;
    list.innerHTML = "";
    foot.hidden = true;
    var rows = buildRows(age);

    if (reduced()) {
      unroll(rows);
      scrollToList();
      running = false;
      return;
    }
    runTravel(age, function () {
      scrollToList();
      unroll(rows);
      running = false;
    });
  }

  go.addEventListener("click", run);
  input.addEventListener("keydown", function (e) { if (e.key === "Enter") run(); });
})();
