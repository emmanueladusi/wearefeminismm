/* Myth or Real? — a swipe-to-judge card game.
   ------------------------------------------------------------------
   A stack of statements about feminism. Swipe (or drag) each card LEFT
   if it's a myth, RIGHT if it's real — or use the two buttons / the
   arrow keys. A stamp fades in as you drag so you can feel your choice
   before you commit. Correct calls earn a palette confetti burst
   (js/celebrate.js) and build a 🔥 streak; the truth is revealed after
   every card, and again in the end-screen review.

   Non-punitive by design (minors' site): a wrong swipe gently reveals
   the truth and teaches — never an alarm-red X.

   Input is fully accessible: pointer/touch drag, the two buttons, AND
   ArrowLeft/ArrowRight. The fling + snap-back use CSS transitions (not
   requestAnimationFrame), and advancement is timer-driven, so the game
   stays smooth and can't soft-lock even if rAF is throttled.

   Content lives in js/mythCards.js (window.MYTH_CARDS). */

(function () {
  const section = document.getElementById("myth");
  const stage = document.getElementById("mythStage");
  const cards = (window.MYTH_CARDS || []).slice();
  if (!section || !stage || !cards.length) return;

  /* ===== tunables ===== */
  const ROUND_SIZE = Math.min(10, cards.length);
  const THRESHOLD = 92;      // px of drag needed to commit a decision
  const FEEDBACK_MS = 1600;  // how long the truth shows before the next card

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cheer = (x, y, o) => { if (window.Celebrate) window.Celebrate.burst(x, y, o); };

  /* ===== state ===== */
  let deck = [], pos = 0, score = 0, streak = 0, bestStreak = 0, results = [];
  let deciding = false, advanceTid = 0;
  let drag = null; // { id, x0, y0, dx, dy } while a pointer drag is active

  const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  const pop = (el, cls) => { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

  /* ---------- start screen ---------- */
  function renderStart() {
    teardown();
    stage.innerHTML =
      '<div class="myth__start">' +
        '<button class="btn" type="button" id="mythBegin" data-magnetic>Deal me in &rarr;</button>' +
        '<p class="myth__hint">Swipe or drag &middot; <b>&larr;</b> myth &middot; <b>&rarr;</b> real &middot; or use the buttons</p>' +
      "</div>";
    document.getElementById("mythBegin").addEventListener("click", startRound);
  }

  function startRound() {
    teardown();
    deck = shuffle(cards.slice()).slice(0, ROUND_SIZE);
    pos = 0; score = 0; streak = 0; bestStreak = 0; results = [];
    showCard();
  }

  /* ---------- one card ---------- */
  function showCard() {
    deciding = false;
    const card = deck[pos];
    const progress = ((pos / deck.length) * 100).toFixed(1);
    stage.innerHTML =
      '<div class="myth__play">' +
        '<div class="myth__hud">' +
          '<span class="myth__count">' + (pos + 1) + " / " + deck.length + "</span>" +
          '<span class="myth__meta">' +
            '<span class="myth__streak" id="mythStreak"' + (streak >= 2 ? "" : " hidden") + '>&#128293; <b>' + streak + "</b></span>" +
            '<span class="myth__score">Score <b id="mythScoreN">' + score + "</b></span>" +
          "</span>" +
        "</div>" +
        '<div class="myth__momentum" aria-hidden="true"><span id="mythMomentum" style="width:' + progress + '%"></span></div>' +
        '<div class="myth__deck">' +
          '<div class="myth-card myth-card--peek" aria-hidden="true"></div>' +
          '<div class="myth-card" id="mythCard" tabindex="0" role="group" aria-label="Statement — decide myth or real">' +
            '<span class="myth-card__stamp myth-card__stamp--myth" aria-hidden="true">Myth</span>' +
            '<span class="myth-card__stamp myth-card__stamp--real" aria-hidden="true">Real</span>' +
            '<span class="myth-card__kind">' + esc(card.kind || "Myth or real?") + "</span>" +
            '<p class="myth-card__text">' + esc(card.text) + "</p>" +
          "</div>" +
        "</div>" +
        '<p class="myth-card__truth" id="mythTruth" role="status" aria-live="polite"></p>' +
        '<div class="myth__actions">' +
          '<button class="myth__btn myth__btn--myth" type="button" id="mythMythBtn">&larr; Myth</button>' +
          '<button class="myth__btn myth__btn--real" type="button" id="mythRealBtn">Real &rarr;</button>' +
        "</div>" +
      "</div>";

    document.getElementById("mythMythBtn").addEventListener("click", () => flingAndDecide(false));
    document.getElementById("mythRealBtn").addEventListener("click", () => flingAndDecide(true));

    const cardEl = document.getElementById("mythCard");
    cardEl.addEventListener("pointerdown", onPointerDown);
    cardEl.focus({ preventScroll: true });
  }

  /* ---------- pointer drag ---------- */
  function onPointerDown(e) {
    if (deciding) return;
    const cardEl = e.currentTarget;
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 };
    cardEl.classList.add("is-dragging");
    try { cardEl.setPointerCapture(e.pointerId); } catch (_) {}
    cardEl.addEventListener("pointermove", onPointerMove);
    cardEl.addEventListener("pointerup", onPointerUp);
    cardEl.addEventListener("pointercancel", onPointerUp);
  }

  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    drag.dx = e.clientX - drag.x0;
    drag.dy = e.clientY - drag.y0;
    const cardEl = e.currentTarget;
    cardEl.style.transform =
      "translate(" + drag.dx + "px," + drag.dy * 0.4 + "px) rotate(" + drag.dx * 0.05 + "deg)";
    setStamp(cardEl, drag.dx);
  }

  function onPointerUp(e) {
    if (!drag) return;
    const cardEl = e.currentTarget;
    const dx = drag.dx;
    cardEl.removeEventListener("pointermove", onPointerMove);
    cardEl.removeEventListener("pointerup", onPointerUp);
    cardEl.removeEventListener("pointercancel", onPointerUp);
    cardEl.classList.remove("is-dragging");
    drag = null;
    if (Math.abs(dx) > THRESHOLD) {
      commit(cardEl, dx > 0);          // right = real, left = myth
    } else {
      cardEl.style.transform = "";      // snap back (CSS transition)
      setStamp(cardEl, 0);
    }
  }

  // stamp opacity tracks how far you've dragged toward a side
  function setStamp(cardEl, dx) {
    const myth = cardEl.querySelector(".myth-card__stamp--myth");
    const real = cardEl.querySelector(".myth-card__stamp--real");
    const t = Math.min(1, Math.abs(dx) / THRESHOLD);
    if (myth) myth.style.opacity = dx < 0 ? t : 0;
    if (real) real.style.opacity = dx > 0 ? t : 0;
  }

  // button / keyboard entry point: animate a fling, then decide
  function flingAndDecide(saidReal) {
    if (deciding) return;
    const cardEl = document.getElementById("mythCard");
    if (cardEl) setStamp(cardEl, saidReal ? THRESHOLD : -THRESHOLD);
    commit(cardEl, saidReal);
  }

  /* ---------- commit a decision ---------- */
  function commit(cardEl, saidReal) {
    if (deciding) return;
    deciding = true;

    const card = deck[pos];
    const correct = saidReal === !card.isMyth; // "real" is correct when it's NOT a myth
    if (correct) { score++; streak++; bestStreak = Math.max(bestStreak, streak); }
    else { streak = 0; }
    results.push({ card: card, correct: correct });

    // fling the card off in the chosen direction (CSS transition — no rAF)
    if (cardEl) {
      cardEl.classList.add(saidReal ? "is-flung-real" : "is-flung-myth");
      if (correct) {
        cardEl.classList.add("is-correct");
        const r = cardEl.getBoundingClientRect();
        cheer(r.left + r.width / 2, r.top + r.height / 2, { count: streak >= 3 ? 70 : 40, power: streak >= 3 ? 11 : 8 });
      } else {
        cardEl.classList.add("is-soft");
      }
    }

    // HUD updates
    const sn = document.getElementById("mythScoreN");
    if (sn) { sn.textContent = String(score); if (correct) pop(sn, "is-bump"); }
    const st = document.getElementById("mythStreak");
    if (st) {
      st.querySelector("b").textContent = String(streak);
      st.hidden = streak < 2;
      if (streak >= 2) pop(st, "is-bump");
    }
    const mo = document.getElementById("mythMomentum");
    if (mo) mo.style.width = (((pos + 1) / deck.length) * 100).toFixed(1) + "%";

    const truth = document.getElementById("mythTruth");
    if (truth) {
      truth.innerHTML = '<b class="myth-fb__lead ' + (correct ? "is-good" : "is-soft") + '">' +
        (correct ? "Nice call." : "Gotcha —") + "</b> " + esc(card.truth);
      truth.classList.add("is-shown");
    }

    clearTimeout(advanceTid);
    advanceTid = setTimeout(next, FEEDBACK_MS);
  }

  function next() {
    pos++;
    if (pos >= deck.length) { renderEnd(); return; }
    showCard();
  }

  /* ---------- end screen ---------- */
  function renderEnd() {
    teardown();
    const total = deck.length;
    const pct = Math.round((score / total) * 100);
    const rank = rankFor(pct);
    const rows = results
      .map((r) => {
        const tag = r.card.isMyth ? "Myth" : "Real";
        return (
          '<li class="myth-review ' + (r.correct ? "is-good" : "is-miss") + '">' +
            '<div class="myth-review__top">' +
              '<span class="myth-review__mark" aria-hidden="true">' + (r.correct ? "&#10003;" : "&bull;") + "</span>" +
              "<span>" + tag + "</span>" +
            "</div>" +
            '<p class="myth-review__text">' + esc(r.card.text) + "</p>" +
            '<p class="myth-review__why">' + esc(r.card.truth) + "</p>" +
          "</li>"
        );
      })
      .join("");

    const streakLine = bestStreak >= 3 ? " Best streak: " + bestStreak + " in a row." : "";
    stage.innerHTML =
      '<div class="myth__end">' +
        '<div class="myth__rank">' +
          '<span class="myth__rank-emoji" aria-hidden="true">' + rank.emoji + "</span>" +
          '<p class="myth__rank-title">' + rank.title + "</p>" +
        "</div>" +
        '<p class="myth__score-big"><b id="mythFinalN">0</b><span>/ ' + total + "</span></p>" +
        '<p class="myth__end-line">' + rank.note + streakLine + "</p>" +
        '<ul class="myth-reviews">' + rows + "</ul>" +
        '<button class="btn" type="button" id="mythAgain" data-magnetic>Play again &rarr;</button>' +
      "</div>";
    document.getElementById("mythAgain").addEventListener("click", startRound);
    countUp(document.getElementById("mythFinalN"), score);
    if (pct >= 78) {
      const r = section.getBoundingClientRect();
      setTimeout(() => cheer(window.innerWidth / 2, Math.max(130, r.top + 150), {
        count: pct === 100 ? 120 : 80, power: 12,
      }), 200);
    }
  }

  function rankFor(pct) {
    if (pct >= 100) return { emoji: "🏆", title: "Myth-buster supreme", note: "You saw through every one." };
    if (pct >= 78) return { emoji: "🌟", title: "Sharp eye", note: "Hard to fool — you know the difference." };
    if (pct >= 55) return { emoji: "🌱", title: "Getting there", note: "Good instincts — the reviews below fill in the rest." };
    return { emoji: "✨", title: "Just warming up", note: "Myths are sneaky. Read the truths below and run it back." };
  }

  function countUp(el, to) {
    if (!el) return;
    if (reduceMotion || to === 0) { el.textContent = String(to); return; }
    let n = 0;
    const step = Math.max(1, Math.round(to / 12));
    const iv = setInterval(() => {
      n = Math.min(to, n + step);
      el.textContent = String(n);
      if (n >= to) clearInterval(iv);
    }, 60);
  }

  /* ---------- housekeeping ---------- */
  function teardown() {
    clearTimeout(advanceTid);
    deciding = false;
    drag = null;
  }

  // Keyboard — ArrowLeft = myth, ArrowRight = real, while a card is live.
  document.addEventListener("keydown", (e) => {
    if (!stage.querySelector(".myth__play") || deciding) return;
    const t = e.target;
    if (t && (/^(input|textarea|select)$/i.test(t.tagName) || t.isContentEditable)) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); flingAndDecide(false); }
    else if (e.key === "ArrowRight") { e.preventDefault(); flingAndDecide(true); }
  });

  renderStart();
})();
