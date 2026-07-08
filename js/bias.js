/* Spot the Bias — a timed feed game.
   ------------------------------------------------------------------
   A short feed of social-media-style posts scrolls past on a timer. Some
   carry bias/stereotyping, some are fair. Flag the biased ones before the
   card advances; let the fair ones pass. Correct flags AND correct passes
   score; missed bias and false flags don't. The tone is non-punitive
   (this is a minors' site): correct gets a soft green pulse + the site's
   conic glow, incorrect gets a gentle neutral tone — never an alarm-red X.

   Content lives in js/biasCards.js (window.BIAS_CARDS) so it can be swapped
   without touching this file. Everything is client-side — no stored data,
   no network calls. Fully keyboard-operable, with a "take your time" toggle
   and a per-card pause for anyone the reflex timing would stress.

   ── TUNE THE TIMER HERE ─────────────────────────────────────────
   CARD_DURATION_MS below is the visible window per card (default 6000 =
   6 seconds). ROUND_SIZE is how many cards a round pulls.
   ─────────────────────────────────────────────────────────────── */

(function () {
  const section = document.getElementById("bias");
  const stage = document.getElementById("biasStage");
  const cards = (window.BIAS_CARDS || []).slice();
  if (!section || !stage || !cards.length) return;

  /* ===== tunable constants ===== */
  const CARD_DURATION_MS = 6000;                  // ← per-card window (TUNE ME)
  const ROUND_SIZE = Math.min(10, cards.length);  // cards per round (auto-scales)
  const FEEDBACK_MS = 1050;                        // pause on the correct/incorrect beat

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGSAP = typeof window.gsap !== "undefined" && !reduceMotion;

  /* ===== state ===== */
  let deck = [], pos = 0, score = 0, results = [];
  let relax = false;        // "take your time" — timer off
  let paused = false;       // manual pause
  let autoPaused = false;   // paused because the section scrolled off-screen
  let inView = true;
  let resolving = false;    // guards against double-resolve on one card
  let rafId = 0, advanceTid = 0, cardStart = 0, remaining = CARD_DURATION_MS;
  let glow = null;          // active AppleIntelligenceGlow handle (correct flag)

  const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const kindOf = (c) => c.kind || "Post";
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  /* ---------- start screen ---------- */
  function renderStart() {
    teardown();
    stage.innerHTML =
      '<div class="bias__start">' +
        '<div class="bias__startrow">' +
          '<button class="btn" type="button" id="biasBegin" data-magnetic>Start the feed &rarr;</button>' +
          '<button class="bias__toggle' + (relax ? " is-on" : "") + '" type="button" id="biasRelax" aria-pressed="' + relax + '">' +
            '<span class="bias__toggle-ico" aria-hidden="true">&#9201;</span><span>Take your time</span>' +
          "</button>" +
        "</div>" +
        '<p class="bias__hint">Keyboard: <b>F</b> flag &middot; <b>N</b> looks fair &middot; <b>P</b> pause</p>' +
      "</div>";
    document.getElementById("biasBegin").addEventListener("click", startRound);
    const rt = document.getElementById("biasRelax");
    rt.addEventListener("click", () => {
      relax = !relax;
      rt.setAttribute("aria-pressed", String(relax));
      rt.classList.toggle("is-on", relax);
    });
  }

  function startRound() {
    teardown();
    deck = shuffle(cards.slice()).slice(0, ROUND_SIZE);
    pos = 0; score = 0; results = [];
    showCard();
  }

  /* ---------- one card ---------- */
  function showCard() {
    resolving = false;
    const card = deck[pos];
    stage.innerHTML =
      '<div class="bias__feed">' +
        '<div class="bias__hud">' +
          '<span class="bias__count">' + (pos + 1) + " / " + deck.length + "</span>" +
          '<span class="bias__score">Score <b>' + score + "</b></span>" +
          '<button class="bias__pause" type="button" id="biasPause" aria-pressed="' + (relax) + '" ' +
            'aria-label="' + (relax ? "Timer off" : "Pause timer") + '">' + (relax ? "&#9201; off" : "&#9208;") + "</button>" +
        "</div>" +
        '<div class="bias-card" id="biasCard" tabindex="-1">' +
          '<div class="bias-card__head">' +
            '<span class="bias-card__avatar" aria-hidden="true"></span>' +
            '<span class="bias-card__kind">' + esc(kindOf(card)) + "</span>" +
          "</div>" +
          '<p class="bias-card__text">' + esc(card.text) + "</p>" +
          '<div class="bias-card__bar" aria-hidden="true"><span class="bias-card__fill" id="biasFill"></span></div>' +
          '<p class="bias-card__feedback" id="biasFeedback" role="status" aria-live="polite"></p>' +
        "</div>" +
        '<div class="bias__actions">' +
          '<button class="bias__btn bias__btn--flag" type="button" id="biasFlag">&#128681; Flag as biased</button>' +
          '<button class="bias__btn bias__btn--fair" type="button" id="biasFair">Looks fair</button>' +
        "</div>" +
      "</div>";

    document.getElementById("biasFlag").addEventListener("click", () => resolve(true));
    document.getElementById("biasFair").addEventListener("click", () => resolve(false));
    document.getElementById("biasPause").addEventListener("click", togglePause);

    const cardEl = document.getElementById("biasCard");
    if (hasGSAP) {
      window.gsap.fromTo(
        cardEl,
        { y: 46, opacity: 0, scale: 0.965 },
        { y: 0, opacity: 1, scale: 1, duration: 0.55, ease: "power3.out" }
      );
    }
    cardEl.focus({ preventScroll: true });

    remaining = CARD_DURATION_MS;
    paused = false; autoPaused = false;
    if (relax) {
      document.getElementById("biasFill").style.width = "100%"; // static — no countdown
    } else if (inView) {
      startTimer();
    } else {
      autoPaused = true; // will resume when it scrolls back into view
    }
  }

  function startTimer() {
    cancelAnimationFrame(rafId);
    cardStart = performance.now();
    const fill = document.getElementById("biasFill");
    const tick = (now) => {
      if (paused || autoPaused || relax || resolving) return;
      const left = Math.max(0, remaining - (now - cardStart));
      if (fill) fill.style.width = ((left / CARD_DURATION_MS) * 100).toFixed(1) + "%";
      if (left <= 0) { resolve(false); return; } // time up with no action = "looks fair" vote
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  function freezeTimer() {
    remaining = Math.max(0, remaining - (performance.now() - cardStart));
    cancelAnimationFrame(rafId);
  }

  function togglePause() {
    if (relax || resolving) return;
    const btn = document.getElementById("biasPause");
    if (!btn) return;
    paused = !paused;
    if (paused) {
      freezeTimer();
      btn.innerHTML = "&#9654;"; // ▶
      btn.setAttribute("aria-pressed", "true");
      btn.setAttribute("aria-label", "Resume timer");
    } else {
      btn.innerHTML = "&#9208;"; // ⏸
      btn.setAttribute("aria-pressed", "false");
      btn.setAttribute("aria-label", "Pause timer");
      if (inView) startTimer();
    }
  }

  /* ---------- resolve a card ---------- */
  function resolve(flagged) {
    if (resolving) return;
    resolving = true;
    cancelAnimationFrame(rafId);

    const card = deck[pos];
    const correct = flagged === card.isBiased;
    if (correct) score++;
    results.push({ card: card, flagged: flagged, correct: correct });

    const cardEl = document.getElementById("biasCard");
    const fb = document.getElementById("biasFeedback");
    const fill = document.getElementById("biasFill");
    if (fill) fill.style.width = "0%";
    if (cardEl) cardEl.classList.add(correct ? "is-correct" : "is-soft");
    if (fb) fb.textContent = feedbackText(flagged, card.isBiased);

    const sc = stage.querySelector(".bias__score b");
    if (sc) sc.textContent = String(score);

    // correctly FLAGGING a biased card earns the site's conic-glow treatment
    if (correct && flagged && cardEl && window.AppleIntelligenceGlow) {
      glow = window.AppleIntelligenceGlow.attach(cardEl, { radius: 20, duration: 6, active: true });
    }

    const hold = FEEDBACK_MS + (correct && flagged ? 350 : 0);
    advanceTid = setTimeout(() => {
      if (glow) { glow.destroy(); glow = null; }
      pos++;
      if (pos >= deck.length) { renderEnd(); return; }
      if (hasGSAP && cardEl) {
        window.gsap.to(cardEl, {
          y: -38, opacity: 0, scale: 0.97, duration: 0.4, ease: "power2.in", onComplete: showCard,
        });
      } else {
        showCard();
      }
    }, hold);
  }

  function feedbackText(flagged, isBiased) {
    if (flagged && isBiased) return "Good catch — that one carried bias.";
    if (!flagged && !isBiased) return "Fair call — that one was okay.";
    if (!flagged && isBiased) return "That one slipped by — it had bias in it.";
    return "That one was actually fair.";
  }

  /* ---------- end screen ---------- */
  function renderEnd() {
    teardown();
    const pct = Math.round((score / deck.length) * 100);
    const rows = results
      .map((r) => {
        const tag = r.card.isBiased ? "Biased" : "Fair";
        return (
          '<li class="bias-review ' + (r.correct ? "is-good" : "is-miss") + '">' +
            '<div class="bias-review__top">' +
              '<span class="bias-review__mark" aria-hidden="true">' + (r.correct ? "&#10003;" : "&bull;") + "</span>" +
              '<span class="bias-review__kind">' + esc(kindOf(r.card)) + " &middot; " + tag + "</span>" +
            "</div>" +
            '<p class="bias-review__text">' + esc(r.card.text) + "</p>" +
            '<p class="bias-review__why">' + esc(r.card.explanation) + "</p>" +
          "</li>"
        );
      })
      .join("");
    stage.innerHTML =
      '<div class="bias__end">' +
        '<p class="bias__score-big"><b>' + score + "</b><span>/ " + deck.length + "</span></p>" +
        '<p class="bias__end-line">' + endLine(pct) + "</p>" +
        '<ul class="bias-reviews">' + rows + "</ul>" +
        '<button class="btn" type="button" id="biasAgain" data-magnetic>Play again &rarr;</button>' +
      "</div>";
    document.getElementById("biasAgain").addEventListener("click", startRound);
    if (hasGSAP) {
      window.gsap.fromTo(
        ".bias__end > *",
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: "power3.out" }
      );
    }
  }

  function endLine(pct) {
    if (pct >= 80) return "Sharp eye. You caught the quiet stuff most people scroll right past.";
    if (pct >= 50) return "Good start — bias is slippery, and you spotted a lot of it.";
    return "Bias often hides in wording that sounds normal. Here's what to look for next time.";
  }

  /* ---------- housekeeping ---------- */
  function teardown() {
    cancelAnimationFrame(rafId);
    clearTimeout(advanceTid);
    if (glow) { glow.destroy(); glow = null; }
    paused = false; autoPaused = false; resolving = false;
  }

  // Pause the timer when the section scrolls off-screen so cards aren't
  // burned while you're not looking; resume when it's back.
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      ([e]) => {
        inView = e.isIntersecting;
        const feedLive = !!stage.querySelector(".bias__feed") && !relax && !resolving;
        if (!inView && feedLive && !paused && !autoPaused) {
          autoPaused = true;
          freezeTimer();
        } else if (inView && autoPaused && !paused) {
          autoPaused = false;
          startTimer();
        }
      },
      { threshold: 0.25 }
    ).observe(section);
  }

  // Keyboard shortcuts — only while a card is live, in view, and not typing.
  document.addEventListener("keydown", (e) => {
    if (!stage.querySelector(".bias__feed") || resolving || !inView) return;
    const t = e.target;
    if (t && (/^(input|textarea|select)$/i.test(t.tagName) || t.isContentEditable)) return;
    const k = e.key.toLowerCase();
    if (k === "f") { e.preventDefault(); resolve(true); }
    else if (k === "n") { e.preventDefault(); resolve(false); }
    else if (k === "p") { e.preventDefault(); togglePause(); }
  });

  renderStart();
})();
