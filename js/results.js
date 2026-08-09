/* Post-survey result card — the bookend to the live pulse sparkline.
   ------------------------------------------------------------------------
   The pulse card (js/spark.js) asks students BEFORE they use the site. This
   one reports what they said after, from the same kind of aggregate-only
   endpoint: a Google Apps Script Web App bound to the form's responses sheet
   that returns nothing but tallies. No student's individual answers ever
   cross the wire. The survey is for minors and that is deliberate.

   It borrows spark.js's curve maths on purpose, so the two cards read as the
   same instrument used twice rather than as two different charts.

   TO GO LIVE: deploy the Apps Script Web App (doGet returns
   { statements: [ { statement, counts: { "Agree": n, ... } } ] }, access set
   to "Anyone") and paste its /exec URL into DATA_URL below.

   Until that URL is set, the card shows LAST_KNOWN with its date. Those
   counts were read off a bar chart image, NOT exported from the responses
   sheet, which is why the card labels them as unconfirmed. The 44% figure on
   this site was misattributed once for exactly this reason. See sources.html.

   n differs per statement because some students skipped rows, so every row
   prints its own denominator rather than the card claiming one sample size. */

(function () {
  // ↓↓↓ paste your deployed Apps Script /exec URL here to go live ↓↓↓
  const DATA_URL = "";
  const REFRESH_MS = 15000;   // this survey moves far slower than the pulse

  /* `show` decides what appears on the card. The other two statements stay in
     the file because the endpoint returns all three and they are worth keeping
     with their counts, but the card shows one number: putting three
     percentages under the gallery turned the end of the page into a report. */
  const LAST_KNOWN = {
    on: "7 August 2026",
    verified: false,          // true once checked against the response sheet
    statements: [
      {
        show: true,
        // `text` is the statement as the form worded it, read out to screen
        // readers. `label` is the few words printed beside the number: the
        // pulse card says "said Yes", not the whole question, and this card
        // sits next to it.
        text: "I no longer think learning about feminism is boring",
        label: "no longer find it boring",
        counts: { "Strongly Disagree": 0, "Disagree": 0, "Neutral": 2, "Agree": 18, "Strongly Agree": 12 },
      },
      {
        show: false,
        text: "I know about the different waves of feminism",
        label: "know the four waves",
        counts: { "Strongly Disagree": 0, "Disagree": 0, "Neutral": 6, "Agree": 14, "Strongly Agree": 10 },
      },
      {
        show: false,
        text: "Feminism should be taught more broadly in schools, the way this site teaches it",
        label: "want it taught in schools",
        counts: { "Strongly Disagree": 0, "Disagree": 0, "Neutral": 7, "Agree": 12, "Strongly Agree": 12 },
      },
    ],
  };

  const list = document.getElementById("resultsList");
  if (!list) return;

  const section = document.getElementById("after-pulse");
  const foot = document.getElementById("resultsFoot");
  const fb = document.getElementById("resultsFallback");

  // colours live in CSS (.rrow--up / --down / --tie), because they differ by theme
  const AGREEING = ["Agree", "Strongly Agree"];

  const svgW = 500, svgH = 120, padY = 16, POINTS = 8;
  const wave = [0, 0.35, -0.15, 0.5, 0.1, -0.3, 0.2, 0];

  // identical curve maths to spark.js, so the line has the same handwriting
  function pollValues(pct) {
    const lean = (pct - 50) / 50, vals = [];
    for (let i = 0; i < POINTS; i++) {
      const t = i / (POINTS - 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const w = i === 0 || i === POINTS - 1 ? 0 : wave[i] * 0.1;
      vals.push(0.5 + lean * 0.5 * eased + w);
    }
    vals[0] = 0.5;
    vals[POINTS - 1] = 0.5 + lean * 0.5;
    return vals;
  }

  function buildPath(values) {
    const min = Math.min(...values), max = Math.max(...values);
    const range = max - min || 1;
    const usable = svgH - padY * 2, stepX = svgW / (values.length - 1);
    const pts = values.map((v, i) => [i * stepX, svgH - padY - ((v - min) / range) * usable]);
    let d = "M " + pts[0][0] + " " + pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], m = (a[0] + b[0]) / 2;
      d += " C " + m + " " + a[1] + ", " + m + " " + b[1] + ", " + b[0] + " " + b[1];
    }
    return d;
  }

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  const totalOf = (counts) =>
    Object.keys(counts).reduce((n, k) => n + (+counts[k] || 0), 0);
  const agreedOf = (counts) =>
    AGREEING.reduce((n, k) => n + (+counts[k] || 0), 0);

  /* ---------------- the pen ----------------
     One green line that draws itself left to right as you scroll, a lit bead
     at its head, and the percentage counting up in step with it: the number
     and the line arrive at 94% together.

     Shaped after the pulse card, whose line is drawn by the page-wide thread
     (js/thread.js) with a bead on the tip and a glow. That thread cannot draw
     THIS card — it fades out over the last 12% of the page and this card sits
     at the very bottom, under the gallery — so the behaviour is reproduced
     locally, using the thread's own easing constant.

     Reduced motion and accessible mode get the finished line and the final
     number immediately, no drawing and no counting, which is what thread.js
     does too. */

  const EASE = 0.028;          // matches thread.js: a glide, not scroll-tracking
  let pens = [];
  let raf = null;

  const still = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.hasAttribute("data-a11y");

  function arm() {
    pens = [...list.querySelectorAll(".rrow")].map((row) => {
      const plot = row.querySelector(".rrow__plot");
      const line = row.querySelector(".rrow__path");
      const bead = row.querySelector(".rrow__bead");
      const num = row.querySelector(".rrow__pct");
      const len = line.getTotalLength();
      line.style.strokeDasharray = len;
      line.style.strokeDashoffset = len;
      return { plot, line, bead, num, len, pct: +row.dataset.pct || 0, p: 0 };
    });

    if (!pens.length) return;
    if (still()) { pens.forEach((pen) => paint(pen, 1)); return; }
    pens.forEach((pen) => paint(pen, 0));
    tick();
  }

  /* How far this row has travelled up the viewport, 0 before it starts.

     The finish line has to be REACHABLE. This card is the last thing on the
     page, so it can never climb to a fixed mark like 45% of the viewport:
     the page runs out of scroll first, and the line was stopping half-drawn
     for good. So the target is whichever comes first, that mark or the
     highest the card can physically get once the page is scrolled to the
     bottom, which makes the stroke complete exactly as you arrive at the end
     of the page. */
  function target(pen) {
    const r = pen.plot.getBoundingClientRect();
    const docTop = r.top + window.scrollY;
    const doc = document.documentElement;
    const maxScroll = Math.max(
      0,
      Math.max(doc.scrollHeight, document.body.scrollHeight) - window.innerHeight
    );
    const reachableTop = Math.max(0, docTop - maxScroll);
    const from = window.innerHeight * 0.92;
    const to = Math.min(window.innerHeight * 0.45, reachableTop);
    if (from <= to) return 1;
    return Math.max(0, Math.min(1, (from - r.top) / (from - to)));
  }

  function paint(pen, p) {
    pen.line.style.strokeDashoffset = (pen.len * (1 - p)).toFixed(2);

    /* The number climbs with the line so they land on 94% together. It is
       rounded from the same p that drives the stroke, so it can never finish
       early or lag behind the head. */
    if (pen.num) pen.num.textContent = Math.round(pen.pct * p) + "%";

    /* The bead sits at the head, and STAYS at the end of the line once it
       arrives rather than blinking out. The SVG is preserveAspectRatio="none",
       so a circle inside it would render as a squashed ellipse; positioning
       the bead in percentages of the plot box keeps it round at any size. */
    if (p > 0.002) {
      const pt = pen.line.getPointAtLength(pen.len * p);
      pen.bead.style.left = ((pt.x / svgW) * 100).toFixed(3) + "%";
      pen.bead.style.top = ((pt.y / svgH) * 100).toFixed(3) + "%";
      pen.bead.style.opacity = "1";
    } else {
      pen.bead.style.opacity = "0";
    }
  }

  function tick() {
    let moving = false;
    pens.forEach((pen) => {
      const t = target(pen);
      const gap = t - pen.p;
      if (Math.abs(gap) < 0.0002) { pen.p = t; }
      else { pen.p += gap * EASE; moving = true; }
      paint(pen, pen.p);
    });
    raf = moving ? requestAnimationFrame(tick) : null;
  }

  /* Always re-schedule rather than only starting when idle. Chaining rAF from
     inside tick() means one dropped frame ends the loop for good: `raf` is
     left holding a stale id that never fires, so a guard of "start only if
     raf is null" can never restart it, and the line stays stranded half-drawn
     with the number stuck at the wrong figure. Cancelling any pending frame
     first keeps that from being possible. */
  function wake() {
    if (still() || !pens.length) return;
    if (raf != null) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }
  addEventListener("scroll", wake, { passive: true });
  addEventListener("resize", () => { arm(); wake(); }, { passive: true });
  // a backgrounded tab suspends rAF entirely; pick the draw back up on return
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) wake();
  });

  function render(model) {
    const rows = model.statements.filter((s) => s.show && totalOf(s.counts) > 0);

    // an empty tally should collapse the card, never leave an empty frame
    if (!rows.length) { if (section) section.hidden = true; return false; }
    if (section) section.hidden = false;

    list.innerHTML = rows.map((s) => {
      const n = totalOf(s.counts), agreed = agreedOf(s.counts);
      const pct = (agreed / n) * 100;
      /* The direction is a CLASS, not an inline colour. The card is near-white
         in light mode and near-black in dark, so one hardcoded green cannot
         serve both: the bright #22c55e this used to paint inline measured
         1.91:1 on the light card, which fails even the relaxed large-text
         bar. CSS now owns two greens per theme. */
      const dir = pct > 50 ? "up" : pct < 50 ? "down" : "tie";
      const d = buildPath(pollValues(pct));
      /* The percentage is written out on every row, so the colour of the line
         is never the only thing carrying the result. */
      /* The visible number is aria-hidden because it counts up: a live region
         reading "1%… 14%… 37%" would be nonsense. The real figure is stated
         once, in text, right beside it.

         NOT .sparkline-path — that class is opacity:0 !important because
         js/thread.js draws the pulse chart with the page-wide thread itself.
         This card carries its own pen (see "the pen" above). */
      /* Number, a few words, the line, one count. The pulse card beside this
         one is this terse and it is the better card for it: an earlier
         version printed the full statement AND a long label AND a two-line
         provenance note, which read as a report next to it. The full wording
         still reaches screen readers, where length costs nothing. */
      return (
        '<li class="rrow rrow--' + dir + '" data-pct="' + Math.round(pct) + '">' +
        '<p class="rrow__head">' +
        '<span class="rrow__pct" aria-hidden="true">0%</span>' +
        '<span class="rrow__label">' +
        '<span class="visually-hidden">' + Math.round(pct) +
        " per cent agreed or strongly agreed that: " + esc(s.text) + ". </span>" +
        '<span aria-hidden="true">' + esc(s.label || "agreed") + "</span></span>" +
        "</p>" +
        '<span class="rrow__plot">' +
        '<svg class="rrow__chart" viewBox="0 0 ' + svgW + " " + svgH +
        '" preserveAspectRatio="none" aria-hidden="true">' +
        '<path class="rrow__path" d="' + d + '"></path>' +
        "</svg>" +
        '<span class="rrow__bead" aria-hidden="true"></span>' +
        "</span>" +
        '<p class="rrow__n">' + agreed + " of " + n + " students</p>" +
        "</li>"
      );
    }).join("");

    arm();

    /* One line, the way the pulse card's foot is one line. The unconfirmed
       flag is a single word rather than a sentence; it disappears entirely
       once LAST_KNOWN.verified is true. */
    if (foot) {
      foot.innerHTML =
        "Asked after using this page" +
        (model.on ? " &middot; " + esc(model.on) : "") +
        (model.verified === false ? ' &middot; <em>unconfirmed</em>' : "");
    }
    return true;
  }

  function showFallback(msg) {
    render(LAST_KNOWN);
    if (fb) {
      fb.hidden = false;
      fb.querySelector("[data-results-msg]").textContent =
        msg || ("Live count unavailable right now. Showing the last recorded totals from " +
                LAST_KNOWN.on + ".");
    }
  }

  function fetchWithTimeout(url, ms) {
    if (typeof AbortController === "undefined") return fetch(url, { cache: "no-store" });
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { cache: "no-store", signal: ctrl.signal }).finally(() => clearTimeout(t));
  }

  let live = null;

  async function loadLive() {
    try {
      const res = await fetchWithTimeout(DATA_URL, 6000);
      const data = await res.json();
      const stmts = (data && data.statements) || [];
      if (!stmts.length) throw new Error("empty tally");
      // the endpoint owns the counts; the wording of each row stays ours, so a
      // spreadsheet header edit can never rewrite the copy on the page
      const model = {
        on: data.on || "",
        verified: true,
        statements: stmts.map((s, i) => ({
          show: !!(LAST_KNOWN.statements[i] && LAST_KNOWN.statements[i].show),
          text: (LAST_KNOWN.statements[i] && LAST_KNOWN.statements[i].text) || s.statement || "",
          counts: s.counts || {},
        })),
      };
      // judge the payload on the statement we actually show, so a live tally
      // that is empty for THAT row falls back instead of hiding the card
      if (!model.statements.some((s) => s.show && totalOf(s.counts) > 0)) {
        throw new Error("no counts for the shown statement");
      }
      live = model;
      if (fb) fb.hidden = true;
      render(live);
    } catch (e) {
      console.warn("results: could not load live data", e);
      if (!live) showFallback();
    }
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-results-retry]")) return;
    const msg = document.querySelector("[data-results-msg]");
    if (msg) msg.textContent = "Checking again…";
    loadLive();
  });

  if (DATA_URL) {
    render(LAST_KNOWN);   // show something immediately, then correct it
    loadLive();
    setInterval(loadLive, REFRESH_MS);
    setTimeout(() => { if (!live) showFallback(); }, 8000);
  } else {
    // no endpoint deployed yet: the hand-read counts are all we have, and the
    // card says so rather than implying it is live
    render(LAST_KNOWN);
  }
})();
