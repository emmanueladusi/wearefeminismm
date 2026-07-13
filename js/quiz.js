/* Know Your Feminism — a multiple-choice knowledge quiz.
   ------------------------------------------------------------------
   A short set of questions about feminism (what it means, its history,
   and its core ideas). Pick an answer, see the right one revealed with a
   plain-spoken WHY, then move on. No timer — this rewards thinking, not
   reflexes.

   Game-feel (added so it doesn't feel like a worksheet):
     · streaks           — consecutive correct answers build a 🔥 streak
     · momentum bar       — fills as you move through the round
     · celebration        — a palette confetti burst on correct answers
                            (js/celebrate.js), bigger on a hot streak
     · reactive copy       — feedback reacts to your streak
     · rank + count-up     — the end screen gives you a title and animates
                            your score up, with confetti on a strong finish

   The tone stays non-punitive (this is a minors' site): a wrong pick
   gently reveals the correct answer and teaches — never an alarm-red X.

   Content lives in js/quizQuestions.js (window.QUIZ_QUESTIONS) so it can
   be swapped without touching this file. Fully keyboard-operable (1–4 to
   answer, Enter/→ to continue). Progression is timer-driven so the round
   can't soft-lock if requestAnimationFrame (and GSAP) is throttled. */

(function () {
  const section = document.getElementById("quiz");
  const stage = document.getElementById("quizStage");
  const questions = (window.QUIZ_QUESTIONS || []).slice();
  if (!section || !stage || !questions.length) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGSAP = typeof window.gsap !== "undefined" && !reduceMotion;
  const cheer = (x, y, o) => { if (window.Celebrate) window.Celebrate.burst(x, y, o); };

  /* ===== state ===== */
  let deck = [], pos = 0, score = 0, streak = 0, bestStreak = 0, results = [];
  let answered = false, advancing = false, current = null, glow = null;

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
  const letter = (i) => String.fromCharCode(65 + i); // 0→A, 1→B …
  const pop = (el, cls) => { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

  /* ---------- start screen ---------- */
  function renderStart() {
    teardown();
    stage.innerHTML =
      '<div class="quiz__start">' +
        '<button class="btn" type="button" id="quizBegin" data-magnetic>Let&rsquo;s go &rarr;</button>' +
        '<p class="quiz__hint">' + questions.length + " questions &middot; build a streak &middot; keyboard: <b>1&ndash;4</b> to answer, <b>Enter</b> to continue</p>" +
      "</div>";
    document.getElementById("quizBegin").addEventListener("click", startRound);
  }

  function startRound() {
    teardown();
    deck = questions.slice();   // authored order — a gentle learning arc
    pos = 0; score = 0; streak = 0; bestStreak = 0; results = [];
    showQuestion();
  }

  /* ---------- one question ---------- */
  function showQuestion() {
    answered = false;
    advancing = false;
    const item = deck[pos];
    const opts = shuffle(item.options.map((text, i) => ({ text, correct: i === item.answer })));
    current = { item: item, opts: opts, chosen: -1 };

    const optHTML = opts
      .map((o, i) =>
        '<button class="quiz__opt" type="button" data-i="' + i + '">' +
          '<span class="quiz__opt-key" aria-hidden="true">' + letter(i) + "</span>" +
          '<span class="quiz__opt-text">' + esc(o.text) + "</span>" +
        "</button>"
      )
      .join("");

    const lastQ = pos + 1 >= deck.length;
    const progress = ((pos / deck.length) * 100).toFixed(1);
    stage.innerHTML =
      '<div class="quiz__play">' +
        '<div class="quiz__hud">' +
          '<span class="quiz__count">' + (pos + 1) + " / " + deck.length + "</span>" +
          '<span class="quiz__meta">' +
            '<span class="quiz__streak" id="quizStreak"' + (streak >= 2 ? "" : " hidden") + '>&#128293; <b>' + streak + "</b></span>" +
            '<span class="quiz__score">Score <b id="quizScoreN">' + score + "</b></span>" +
          "</span>" +
        "</div>" +
        '<div class="quiz__momentum" aria-hidden="true"><span id="quizMomentum" style="width:' + progress + '%"></span></div>' +
        '<div class="quiz-card" id="quizCard" tabindex="-1">' +
          '<span class="quiz-card__topic">' + esc(item.topic || "Question") + "</span>" +
          '<p class="quiz-card__q">' + esc(item.q) + "</p>" +
          '<div class="quiz__opts" role="group" aria-label="Answer choices">' + optHTML + "</div>" +
          '<p class="quiz-card__feedback" id="quizFeedback" role="status" aria-live="polite"></p>' +
          '<button class="btn quiz__next" type="button" id="quizNext" hidden data-magnetic>' +
            (lastQ ? "See results" : "Next question") + " &rarr;</button>" +
        "</div>" +
      "</div>";

    stage.querySelectorAll(".quiz__opt").forEach((btn) => {
      btn.addEventListener("click", () => choose(parseInt(btn.dataset.i, 10)));
    });
    document.getElementById("quizNext").addEventListener("click", advance);

    const cardEl = document.getElementById("quizCard");
    if (hasGSAP) {
      window.gsap.fromTo(
        cardEl,
        { y: 46, opacity: 0, scale: 0.965 },
        { y: 0, opacity: 1, scale: 1, duration: 0.55, ease: "power3.out" }
      );
    }
    cardEl.focus({ preventScroll: true });
  }

  /* ---------- answer a question ---------- */
  function choose(i) {
    if (answered) return;
    answered = true;
    current.chosen = i;

    const opts = current.opts;
    const correct = !!opts[i] && opts[i].correct;
    if (correct) { score++; streak++; bestStreak = Math.max(bestStreak, streak); }
    else { streak = 0; }
    results.push({ item: current.item, correct: correct });

    const btns = stage.querySelectorAll(".quiz__opt");
    btns.forEach((b, bi) => {
      b.disabled = true;
      if (opts[bi].correct) b.classList.add("is-correct"); // always reveal the right answer
      else if (bi === i) b.classList.add("is-wrong");      // and softly mark a wrong pick
    });

    // celebration + glow on a correct pick — bigger burst on a hot streak
    const cardEl = document.getElementById("quizCard");
    if (correct) {
      const r = btns[i].getBoundingClientRect();
      const hot = streak >= 3;
      cheer(r.left + r.width / 2, r.top + r.height / 2, { count: hot ? 74 : 42, power: hot ? 11 : 8 });
      if (cardEl && window.AppleIntelligenceGlow) {
        glow = window.AppleIntelligenceGlow.attach(cardEl, { radius: 20, duration: 6, active: true });
      }
    }

    // HUD: score pop + streak badge
    const sn = document.getElementById("quizScoreN");
    if (sn) { sn.textContent = String(score); if (correct) pop(sn, "is-bump"); }
    const st = document.getElementById("quizStreak");
    if (st) {
      st.querySelector("b").textContent = String(streak);
      st.hidden = streak < 2;
      if (streak >= 2) pop(st, "is-bump");
    }
    // momentum grows as the question resolves
    const mo = document.getElementById("quizMomentum");
    if (mo) mo.style.width = (((pos + 1) / deck.length) * 100).toFixed(1) + "%";

    const fb = document.getElementById("quizFeedback");
    if (fb) {
      fb.innerHTML = flair(correct, streak) + " " + esc(current.item.explanation);
      fb.classList.add(correct ? "is-correct" : "is-soft");
    }

    const next = document.getElementById("quizNext");
    if (next) { next.hidden = false; next.focus({ preventScroll: true }); }
  }

  // streak-aware lead-in before the explanation
  function flair(correct, streak) {
    let t;
    if (!correct) t = "Not quite.";
    else if (streak >= 5) t = "Unstoppable — " + streak + " straight! 🔥";
    else if (streak >= 3) t = "On fire — " + streak + " in a row! 🔥";
    else if (streak === 2) t = "Two for two!";
    else t = "Correct!";
    return '<b class="quiz-fb__lead">' + t + "</b>";
  }

  function advance() {
    if (!answered || advancing) return; // ignore stray/rapid clicks during the transition
    advancing = true;
    if (glow) { glow.destroy(); glow = null; }
    const cardEl = document.getElementById("quizCard");
    pos++;
    if (pos >= deck.length) { renderEnd(); return; }
    if (hasGSAP && cardEl) {
      // The out-slide is purely cosmetic; progression is driven by the timer
      // below so the quiz can't soft-lock if rAF (and thus GSAP) is throttled.
      window.gsap.to(cardEl, { y: -38, opacity: 0, scale: 0.97, duration: 0.4, ease: "power2.in" });
      setTimeout(showQuestion, 420);
    } else {
      showQuestion();
    }
  }

  /* ---------- end screen ---------- */
  function renderEnd() {
    teardown();
    const total = deck.length;
    const pct = Math.round((score / total) * 100);
    const rank = rankFor(pct);
    const rows = results
      .map((r) => {
        const item = r.item;
        const right = item.options[item.answer];
        return (
          '<li class="quiz-review ' + (r.correct ? "is-good" : "is-miss") + '">' +
            '<div class="quiz-review__top">' +
              '<span class="quiz-review__mark" aria-hidden="true">' + (r.correct ? "&#10003;" : "&bull;") + "</span>" +
              '<span>' + esc(item.topic || "Question") + "</span>" +
            "</div>" +
            '<p class="quiz-review__q">' + esc(item.q) + "</p>" +
            '<p class="quiz-review__a">Answer: <b>' + esc(right) + "</b></p>" +
            '<p class="quiz-review__why">' + esc(item.explanation) + "</p>" +
          "</li>"
        );
      })
      .join("");

    const streakLine = bestStreak >= 3 ? " Best streak: " + bestStreak + " in a row." : "";
    stage.innerHTML =
      '<div class="quiz__end">' +
        '<div class="quiz__rank">' +
          '<span class="quiz__rank-emoji" aria-hidden="true">' + rank.emoji + "</span>" +
          '<p class="quiz__rank-title">' + rank.title + "</p>" +
        "</div>" +
        '<p class="quiz__score-big"><b id="quizFinalN">0</b><span>/ ' + total + "</span></p>" +
        '<p class="quiz__end-line">' + rank.note + streakLine + "</p>" +
        '<ul class="quiz-reviews">' + rows + "</ul>" +
        '<button class="btn" type="button" id="quizAgain" data-magnetic>Play again &rarr;</button>' +
      "</div>";
    document.getElementById("quizAgain").addEventListener("click", startRound);

    countUp(document.getElementById("quizFinalN"), score);

    // confetti rains on a strong finish
    if (pct >= 78) {
      const r = section.getBoundingClientRect();
      setTimeout(() => cheer(window.innerWidth / 2, Math.max(130, r.top + 150), {
        count: pct === 100 ? 120 : 80, power: 12,
      }), 200);
    }

    if (hasGSAP) {
      window.gsap.fromTo(
        ".quiz__end > *",
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: "power3.out" }
      );
    }
  }

  function rankFor(pct) {
    if (pct >= 100) return { emoji: "🏆", title: "Perfect run", note: "Every single one — you could teach this." };
    if (pct >= 78) return { emoji: "🌟", title: "Feminism fluent", note: "You really know your stuff." };
    if (pct >= 55) return { emoji: "🌱", title: "Getting there", note: "Solid core — the rest is one more round away." };
    return { emoji: "✨", title: "Just warming up", note: "Now you’ve seen it once. Run it back and watch it climb." };
  }

  // count the final score up from zero (timer-driven so it survives rAF throttling)
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
    if (glow) { glow.destroy(); glow = null; }
    answered = false;
    advancing = false;
  }

  // Keyboard — only while a question is on screen and you're not typing elsewhere.
  document.addEventListener("keydown", (e) => {
    if (!stage.querySelector(".quiz__play")) return;
    const t = e.target;
    if (t && (/^(input|textarea|select)$/i.test(t.tagName) || t.isContentEditable)) return;

    if (!answered) {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9) {
        const btn = stage.querySelector('.quiz__opt[data-i="' + (n - 1) + '"]');
        if (btn) { e.preventDefault(); choose(n - 1); }
      }
    } else if (e.key === "Enter" || e.key === "ArrowRight") {
      e.preventDefault();
      advance();
    }
  });

  renderStart();
})();
