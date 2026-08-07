/* The timeline stage — four waves on one stage instead of 25 screens stacked.

   The chapters (#ch1–#ch4) used to sit end to end, so reading the history
   meant scrolling nearly 19,000px past four 235vh hero grows. The content was
   never the problem; the stacking was. Here the SAME markup becomes a tab
   set: the rolling chapter index that already sat above the chapters is now
   the tablist, and only the open chapter is in the flow. Nothing is rewritten,
   nothing is dropped — every event node, every "why it matters", every quick
   check is still there, one wave at a time.

   Why a stage and not just shorter sections: a wave you CHOSE reads as a
   place you went. And because the stage knows which waves you have opened and
   which checks you passed, the section can finally end — "04 of 04 opened" is
   a finish line, which is the thing an endless page never gives you.

   Progressive enhancement, the same rule the rest of the site keeps to:
   this script sets data-stage="on" itself, and every stage style is keyed on
   that attribute. If the file never runs, the timeline is exactly the
   scrolling version it has always been, with all four chapters readable.

   Talks to: js/timeline.js (node lighting + the quick checks — it skips its
   hero choreography while the stage is on), js/thread.js (the gold thread
   re-weaves through whichever chapter is open), js/morph.js (cached section
   offsets, stale the moment the page height changes). */

(function () {
  const root = document.getElementById("timeline");
  if (!root) return;

  const chapters = [...root.querySelectorAll(".chapter")];
  const tabs = [...root.querySelectorAll(".roll__btn[data-goto]")];
  const list = root.querySelector(".roll");
  const finale = root.querySelector(".finale");
  // bail rather than half-apply: without a tab per chapter this would strand
  // content behind [hidden] with no way to reach it
  if (chapters.length < 2 || !list || tabs.length !== chapters.length) return;

  const reduce =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.hasAttribute("data-a11y");

  const opened = new Set();
  const passed = new Set();
  let current = -1;

  /* ---------- the index becomes a tablist ----------
     Roving tabindex: one stop for the whole set, arrows move between waves.
     Tabbing through four chapter buttons to reach the stage was never the
     point of the index. */
  list.setAttribute("role", "tablist");
  list.setAttribute("aria-label", "Timeline chapters");
  [...list.children].forEach((li) => li.setAttribute("role", "presentation"));

  tabs.forEach((tab, i) => {
    const panel = chapters[i];
    tab.id = "tltab-" + panel.id;
    tab.type = "button";
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", panel.id);
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", tab.id);
    panel.setAttribute("tabindex", "0");

    tab.addEventListener("click", () => show(i, { scroll: true }));
    tab.addEventListener("keydown", (e) => {
      const k = e.key;
      let to = null;
      if (k === "ArrowRight" || k === "ArrowDown") to = (i + 1) % tabs.length;
      else if (k === "ArrowLeft" || k === "ArrowUp") to = (i - 1 + tabs.length) % tabs.length;
      else if (k === "Home") to = 0;
      else if (k === "End") to = tabs.length - 1;
      if (to === null) return;
      e.preventDefault();
      show(to, { focusTab: true });
    });
  });

  /* ---------- stage footer: move between waves, and see how far in you are ---------- */
  const nav = document.createElement("div");
  nav.className = "tlnav";
  nav.innerHTML =
    '<button class="tlnav__btn" type="button" data-dir="-1">' +
      '<span aria-hidden="true">←</span> Previous wave</button>' +
    '<p class="tlnav__prog" role="status" aria-live="polite"></p>' +
    '<button class="tlnav__btn tlnav__btn--next" type="button" data-dir="1"></button>';
  if (finale) root.insertBefore(nav, finale);
  else root.appendChild(nav);

  const btnPrev = nav.querySelector('[data-dir="-1"]');
  const btnNext = nav.querySelector('[data-dir="1"]');
  const prog = nav.querySelector(".tlnav__prog");

  btnPrev.addEventListener("click", () => show(current - 1, { scroll: true }));
  btnNext.addEventListener("click", () => {
    // past the last wave the only thing left is where the thread lands
    if (current === chapters.length - 1) {
      glideTo(finale || root);
      return;
    }
    show(current + 1, { scroll: true });
  });

  /* the finish line — written once, revealed when all four have been opened */
  let doneLine = null;
  if (finale) {
    doneLine = document.createElement("p");
    doneLine.className = "finale__done";
    doneLine.setAttribute("role", "status");
    doneLine.setAttribute("aria-live", "polite");
    finale.appendChild(doneLine);
  }

  /* ---------- swapping ---------- */
  function show(i, opts) {
    opts = opts || {};
    i = (i + chapters.length) % chapters.length;
    if (i === current) {
      if (opts.scroll) glideTo(chapters[i]);
      return;
    }
    current = i;
    opened.add(i);

    chapters.forEach((c, n) => {
      const on = n === i;
      c.hidden = !on;
      c.classList.toggle("is-active", on);
    });

    tabs.forEach((t, n) => {
      const on = n === i;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      const item = t.closest(".roll__item");
      if (item) {
        item.classList.toggle("is-open", on);
        item.classList.toggle("is-seen", opened.has(n));
      }
    });

    updateNav();
    relayout();
    if (opts.focusTab) tabs[i].focus();
    if (opts.scroll) glideTo(chapters[i]);
  }

  function updateNav() {
    const n = chapters.length;
    const pad = (v) => (v < 10 ? "0" + v : "" + v);
    btnPrev.disabled = current <= 0;
    const last = current === n - 1;
    btnNext.innerHTML = last
      ? 'Where the thread lands <span aria-hidden="true">↓</span>'
      : 'Next wave <span aria-hidden="true">→</span>';

    let line = "Wave " + pad(current + 1) + " of " + pad(n) +
               " · " + pad(opened.size) + " of " + pad(n) + " opened";
    if (passed.size) {
      line += " · " + passed.size + " check" + (passed.size === 1 ? "" : "s") + " passed";
    }
    prog.textContent = line;

    if (doneLine) {
      const complete = opened.size === n;
      finale.classList.toggle("is-complete", complete);
      const want = complete
        ? "All four waves opened" +
          (passed.size === n ? ", every check passed. " : ". ") +
          "178 years, and the thread is still moving."
        : "";
      if (doneLine.textContent !== want) doneLine.textContent = want;
    }
  }

  /* Hiding three quarters of the section changes the page height, which
     invalidates every cached offset on the page. Re-measure after layout has
     settled rather than during the swap. */
  function relayout() {
    requestAnimationFrame(() => {
      if (window.__timeline && window.__timeline.measure) window.__timeline.measure();
      if (window.__morph && window.__morph.measure) window.__morph.measure();
      if (window.__thread && window.__thread.relayout) window.__thread.relayout();
    });
  }

  function glideTo(el) {
    if (!el) return;
    const l = window.__lenis;
    if (l && !reduce) l.scrollTo(el, { offset: -70 });
    else el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  /* ---------- the quick checks feed the progress line ----------
     js/timeline.js owns the answer logic and marks the card .correct; this
     only reads the result, so there is one source of truth for what counts as
     right. CAPTURE phase on purpose: timeline.js calls stopPropagation() on
     these clicks (so answering doesn't also toggle the card behind it), which
     means a bubble-phase listener here would never hear them at all. Capture
     runs on the way down, before that. The rAF then reads the class it set. */
  root.addEventListener("click", (e) => {
    const opt = e.target.closest(".check__opt");
    if (!opt) return;
    const card = opt.closest(".check__card");
    if (!card) return;
    const at = current;
    requestAnimationFrame(() => {
      if (card.classList.contains("correct") && !passed.has(at)) {
        passed.add(at);
        updateNav();
      }
    });
  }, true);

  /* ---------- go ---------- */
  root.dataset.stage = "on";

  // a deep link (learn.html#ch3, or the index's own data-goto targets) should
  // open that wave rather than land on a hidden element
  let start = 0;
  const hash = window.location.hash.replace("#", "");
  if (hash) {
    const idx = chapters.findIndex((c) => c.id === hash);
    if (idx > -1) start = idx;
  }
  show(start);
  if (hash && start > 0) window.addEventListener("load", () => glideTo(chapters[start]));
})();
