/* The timeline — "one thread, four waves, 178 years" (Learn page).

   Replaces the old wave-scrub screen. The four waves live on as the
   CHAPTERS of an interactive timeline: rolling chapter index, chapter
   heroes that grow from a card to full-bleed as you scroll, dated event
   nodes that light up as the thread reaches them (tap for "why it
   matters"), bridge nodes between the waves, and a one-tap quick check
   per chapter.

   The gold line itself is drawn by js/thread.js — it leaves its
   right-margin ribbon and weaves through this section's .th-anchor
   points (see the timeline splice in thread.js layout()). This file
   owns everything else: node lighting, hero growth, quizzes, jumps,
   and the fixed wave counter.

   Reduced motion / data-a11y: nodes render lit, heroes stay cards,
   no scroll choreography. */

(function () {
  const root = document.getElementById("timeline");
  if (!root) return;

  const reduce =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.hasAttribute("data-a11y");

  /* ---- event nodes: light up as the head of the thread passes ---- */
  const nodes = [...root.querySelectorAll(".node")];
  let nodeYs = [];

  /* ---- chapter heroes: the art card grows to swallow the viewport.
     The BOX is animated (width/height), not transform:scale — scaling
     would zoom into the artwork; resizing re-composes the waves and the
     big number so the art stays framed while it grows. ---- */
  const heroes = [...root.querySelectorAll(".hero-wrap")].map((w) => ({
    wrap: w,
    art: w.querySelector(".hero-art"),
    title: w.querySelector(".hero-title"),
  }));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  function measure() {
    nodeYs = nodes.map((n) => {
      const d = n.querySelector(".node__dot").getBoundingClientRect();
      return d.top + d.height / 2 + window.scrollY;
    });
    frame();
  }

  function frame() {
    const targetY = window.scrollY + window.innerHeight * 0.58;
    nodes.forEach((n, i) =>
      n.classList.toggle("lit", reduce || nodeYs[i] <= targetY)
    );

    if (reduce) return; // heroes stay as cards; CSS shows the titles

    for (const h of heroes) {
      const r = h.wrap.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      if (span <= 0) continue;
      const p = Math.min(1, Math.max(0, -r.top / span));

      // base card size (matches the CSS: min(46vw, 520px), min 280, 4:3)
      const w0 = Math.max(280, Math.min(window.innerWidth * 0.46, 520));
      const h0 = w0 * 0.75;

      // grow the box over p ∈ [0.08, 0.68]
      const g = easeOut(Math.min(1, Math.max(0, (p - 0.08) / 0.6)));
      h.art.style.width = `${(w0 + (window.innerWidth - w0) * g).toFixed(1)}px`;
      h.art.style.height = `${(h0 + (window.innerHeight - h0) * g).toFixed(1)}px`;
      h.art.style.borderRadius = `${((1 - g) * 20).toFixed(1)}px`;

      // title slides up over p ∈ [0.68, 0.9]
      const t = Math.min(1, Math.max(0, (p - 0.68) / 0.22));
      h.title.style.opacity = t.toFixed(3);
      h.title.style.transform = `translateY(${((1 - easeOut(t)) * 60).toFixed(1)}px)`;
    }
  }

  /* ---- rolling index: jump to a chapter ---- */
  root.querySelectorAll("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = document.getElementById(btn.dataset.goto);
      if (!target) return;
      const l = window.__lenis;
      if (l && !reduce) l.scrollTo(target, { offset: 0 });
      else target.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    });
  });

  /* ---- event cards: tap to expand "why it matters" ---- */
  root.querySelectorAll(".node__card").forEach((card) => {
    const toggle = () => {
      const open = card.classList.toggle("open");
      card.setAttribute("aria-expanded", open);
    };
    card.addEventListener("click", toggle);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
  });

  /* ---- quick checks: one tap, instant feedback ---- */
  root.querySelectorAll(".check__opts").forEach((opts) => {
    const right = +opts.dataset.answer;
    const verdict = opts.parentElement.querySelector(".check__verdict");
    [...opts.children].forEach((btn, i) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (i === right) {
          btn.classList.add("right");
          opts.parentElement.classList.add("correct");
          verdict.innerHTML = verdict.dataset.right;
          [...opts.children].forEach((b) => (b.disabled = true));
        } else {
          btn.classList.remove("wrong");
          void btn.offsetWidth; // restart the shake
          btn.classList.add("wrong");
          verdict.textContent = verdict.dataset.wrong;
        }
      });
    });
  });

  /* ---- fixed wave counter (01–04) ---- */
  const counter = document.getElementById("tlCount");
  const counterNum = counter ? counter.querySelector("b") : null;
  const chapters = [...root.querySelectorAll(".chapter")];
  if (counter && counterNum && "IntersectionObserver" in window) {
    chapters.forEach((c) =>
      new IntersectionObserver(
        (es) =>
          es.forEach((e) => {
            if (e.isIntersecting) counterNum.textContent = c.dataset.wave;
          }),
        { rootMargin: "-45% 0px -45% 0px" }
      ).observe(c)
    );
  }
  function counterVis() {
    if (!counter) return;
    const anyVisible = chapters.some((c) => {
      const r = c.getBoundingClientRect();
      return r.top < window.innerHeight * 0.6 && r.bottom > window.innerHeight * 0.4;
    });
    counter.classList.toggle("show", anyVisible);
  }

  /* ---- main loop ---- */
  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        frame();
        counterVis();
        ticking = false;
      });
    },
    { passive: true }
  );

  let rt;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(measure, 150);
  });
  if (typeof ScrollTrigger !== "undefined") {
    ScrollTrigger.addEventListener("refresh", () => setTimeout(measure, 0));
  }
  window.addEventListener("load", () => setTimeout(measure, 80));
  measure();
})();
