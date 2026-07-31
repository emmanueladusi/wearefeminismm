/* Home — a different scroll move per section.

   Every section used the same fade-up, which is what made a long page feel
   like one repeated gesture. Each section now gets its own, borrowed from the
   ownitt.fr vocabulary (clip-path wipes, an inset frame opening to full
   bleed, per-word reveals, a small scale settle):

     #paths        rows wipe in from the left   clip-path: inset(0 100% 0 0) -> inset(0)
     #popculture   the photo opens out of its frame, scroll-linked
     #about        heading reveals word by word
     headings      section titles rise per word instead of as one block

   Rules this file keeps to:
   - Nothing starts hidden in CSS. The classes that hide are added BY this
     script, so if it never runs the page is fully readable.
   - Reduced motion and the site's own accessible mode opt out entirely.
   - Transform/opacity/clip-path only, so it stays on the compositor.
*/

(function () {
  const reduced =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.hasAttribute("data-a11y");
  if (reduced) return;

  /* ---------- per-word reveal ----------
     Wraps each word in a span so it can rise on its own. Two spans deep: the
     outer clips, the inner moves, which is what gives the "out of the floor"
     look rather than a fade. */
  function splitWords(el) {
    if (!el || el.dataset.split === "1") return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue.trim()) texts.push(walker.currentNode);
    }
    texts.forEach((node) => {
      const frag = document.createDocumentFragment();
      node.nodeValue.split(/(\s+)/).forEach((tok) => {
        if (!tok.trim()) { frag.appendChild(document.createTextNode(tok)); return; }
        const outer = document.createElement("span");
        outer.className = "wsplit";
        const inner = document.createElement("span");
        inner.className = "wsplit__i";
        inner.textContent = tok;
        outer.appendChild(inner);
        frag.appendChild(outer);
      });
      node.parentNode.replaceChild(frag, node);
    });
    el.dataset.split = "1";
    el.classList.add("is-split");
  }

  /* A shared rAF scroll watcher instead of IntersectionObserver.
     journey.js wraps these sections in a perspective transform, and a
     transformed ancestor stops IO from ever reporting an intersection, so
     the reveals never fired. Measuring the rect directly is immune to that. */
  const watchers = [];
  function watch(el, ratio, onEnter) {
    watchers.push({ el: el, ratio: ratio, fn: onEnter, done: false });
  }
  let wTicking = false;
  function runWatchers() {
    wTicking = false;
    const vh = window.innerHeight;
    for (let i = watchers.length - 1; i >= 0; i--) {
      const w = watchers[i];
      const r = w.el.getBoundingClientRect();
      if (r.top < vh * w.ratio && r.bottom > 0) {
        w.fn(w.el);
        watchers.splice(i, 1);
      }
    }
  }
  function onWatchScroll() {
    if (wTicking) return;
    wTicking = true;
    requestAnimationFrame(runWatchers);
  }
  window.addEventListener("scroll", onWatchScroll, { passive: true });
  window.addEventListener("resize", onWatchScroll);

  // section headings: word-by-word rise
  const headings = [
    ".popculture__title",
    ".about__title",
    ".paths__title",
  ].flatMap((sel) => [...document.querySelectorAll(sel)]);

  headings.forEach((h) => {
    splitWords(h);
    const words = h.querySelectorAll(".wsplit__i");
    words.forEach((w, i) => (w.style.transitionDelay = i * 0.055 + "s"));
    watch(h, 0.88, function (el) { el.classList.add("words-in"); });
  });

  /* ---------- #paths: rows wipe in from the left ---------- */
  const rows = [...document.querySelectorAll(".paths__item")];
  if (rows.length) {
    rows.forEach((r, i) => {
      r.classList.add("wipe-row");
      r.style.transitionDelay = i * 0.1 + "s";
    });
    rows.forEach(function (r) {
      watch(r, 0.9, function (el) { el.classList.add("wipe-in"); });
    });
  }

  /* ---------- #popculture: the photo opens out of its frame ----------
     Scroll-linked rather than a one-shot, so it tracks you: the inset shrinks
     from 18% to 0 across the approach, and the image inside settles from 1.12
     to 1. rAF-throttled and parked when the section is off screen. */
  const photo = document.querySelector(".piece__photo");
  if (photo) {
    const img = photo.querySelector("img");
    photo.classList.add("frame-open");
    let ticking = false;
    let active = false;

    const frame = () => {
      const r = photo.getBoundingClientRect();
      // 0 when the frame's top hits the bottom of the screen, 1 once it is
      // roughly a third of the way up
      const p = Math.min(1, Math.max(0, 1 - r.top / (window.innerHeight * 0.82)));
      const eased = p * p * (3 - 2 * p);
      photo.style.clipPath = "inset(" + (18 - 18 * eased).toFixed(2) + "% round 14px)";
      if (img) img.style.transform = "scale(" + (1.12 - 0.12 * eased).toFixed(4) + ")";
      ticking = false;
    };

    const onScroll = () => {
      if (ticking || !active) return;
      ticking = true;
      requestAnimationFrame(frame);
    };

    const setActive = () => {
      const r = photo.getBoundingClientRect();
      active = r.top < window.innerHeight * 1.3 && r.bottom > -200;
    };
    window.addEventListener("scroll", () => { setActive(); onScroll(); }, { passive: true });
    setActive();
    window.addEventListener("resize", onScroll);
    frame();
  }

  /* ---------- #about: the stat settles in ---------- */
  const stat = document.querySelector(".about__stat");
  if (stat) {
    stat.classList.add("stat-pop");
    watch(stat, 0.85, function (el) { el.classList.add("stat-in"); });
  }
  /* first pass, in case the page loads already scrolled (a hash link, or a
     back-navigation restoring position) */
  runWatchers();
  window.addEventListener("load", runWatchers);
})();
