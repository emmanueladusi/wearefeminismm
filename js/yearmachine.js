/* The year machine — the visitor types their age, lands in 1912, and the
   list shows how old they'd be when each right actually arrived in Canada.
   Everything runs on-page: the age is never stored or sent anywhere.

   The gut punch is the "line": a girl who was a teenager in 1912 could
   expect to live to about 68, so every milestone after that renders ghosted,
   because statistically she never saw it. */
(function () {
  var BASE = 1912;      // the year they land in
  var LIFESPAN = 68;    // rough life expectancy for a girl who was a teen in 1912
  var THIS_YEAR = 2026;

  var EVENTS = [
    { y: 1918, t: "Most women can vote federally for the first time. “Most”: Asian and Indigenous women are told to keep waiting.", dark: true },
    { y: 1929, t: "The law finally agrees you are a “person.” Five women had to take it all the way to court to make that true." },
    { y: 1948, t: "Canadians of Chinese and South Asian descent can finally vote federally.", dark: true },
    { y: 1960, t: "Indigenous women (and men) can vote federally without being forced to give up their status.", dark: true },
    { y: 1964, t: "In Quebec, a married woman can finally open a bank account or sign a contract without her husband’s signature." },
    { y: 1965, t: "Ontario closes its last legally segregated school. Nova Scotia keeps one open until 1983.", dark: true },
    { y: 1969, t: "Birth control stops being a criminal offence in Canada." },
    { y: 1971, t: "Federal law finally protects your job while you’re on maternity leave." },
    { y: 1983, t: "Rape within marriage becomes a crime. Until now, marriage was treated as a legal defence." },
    { y: 1985, t: "Charter equality rights come into force, and Indigenous women who lost status by marrying begin to win it back.", dark: true },
    { y: 1993, t: "Canada swears in its first female Prime Minister. She is still the only one." }
  ];

  var input = document.getElementById("ymAge");
  var go = document.getElementById("ymGo");
  var list = document.getElementById("ymList");
  var foot = document.getElementById("ymFoot");
  if (!input || !go || !list) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.querySelectorAll(".ym__step").forEach(function (b) {
    b.addEventListener("click", function () {
      var v = clampAge(parseInt(input.value, 10) + parseInt(b.getAttribute("data-d"), 10));
      input.value = v;
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

  function run() {
    var age = clampAge(parseInt(input.value, 10));
    input.value = age;
    var born = BASE - age;
    list.innerHTML = "";
    foot.hidden = true;

    var rows = [];
    rows.push(item("ym__item--open", '<p class="ym__scene">It’s ' + BASE + ". You’re " + age + ". You were born in " + born + ".</p>"));

    var crossed = false;
    EVENTS.forEach(function (e) {
      var at = age + (e.y - BASE);
      if (!crossed && at > LIFESPAN) {
        crossed = true;
        rows.push(item("ym__item--line", '<p class="ym__scene">A girl born in ' + born + " could expect about " + LIFESPAN + " years. Statistically, everything below this line arrived after you were gone.</p>"));
      }
      var gone = at > LIFESPAN;
      rows.push(item(
        (e.dark ? "ym__item--dark " : "") + (gone ? "ym__item--gone" : ""),
        '<span class="ym__year">' + e.y + '</span><span class="ym__at">' + (gone ? "you’d have been " : "you’re ") + at + "</span><p>" + e.t + "</p>"
      ));
    });

    var nowAt = age + (THIS_YEAR - BASE);
    rows.push(item("ym__item--gone ym__item--now",
      '<span class="ym__year">' + THIS_YEAR + '</span><span class="ym__at">you’d have been ' + nowAt + "</span><p>The gap is still open: women in Canada earn about 89 cents on the man’s dollar, and for Black and racialized women it’s less. Some waits aren’t over.</p>"));

    rows.forEach(function (li) { list.appendChild(li); });

    // staggered arrival, unless the visitor asked for reduced motion
    if (reduceMotion) {
      rows.forEach(function (li) { li.classList.add("in"); });
      foot.hidden = false;
    } else {
      rows.forEach(function (li, i) {
        setTimeout(function () { li.classList.add("in"); }, 350 + i * 420);
      });
      setTimeout(function () { foot.hidden = false; }, 350 + rows.length * 420);
    }

    // keep the first lines in view on phones once they start landing
    var top = list.getBoundingClientRect().top + window.scrollY - 120;
    if (window.__lenis) { window.__lenis.scrollTo(top); } else { window.scrollTo(0, top); }
  }

  go.addEventListener("click", run);
  input.addEventListener("keydown", function (e) { if (e.key === "Enter") run(); });
})();
