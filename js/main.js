/* wearefeminism v2 — motion + interaction.
   Front-end only: wall posts and pulse votes persist in
   localStorage. A real backend with moderation is required
   before launch (minor audience — safety-critical). */

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const lerp = (a, b, t) => a + (b - a) * t;

/* ===== Nav border on scroll ===== */
const nav = document.getElementById("nav");
window.addEventListener(
  "scroll",
  () => nav.classList.toggle("is-scrolled", window.scrollY > 10),
  { passive: true }
);

/* ===== Scroll reveals =====
   Stagger belongs to things that read AS a list. Applied to every section it
   turns the whole page into one long staggered list, which is how the generic
   layer ended up competing with the page's authored moments. */
const LIST_LIKE = "ol, ul, .paths__list, .wall, .deck, .resources__grid, [class*='__list'], [class*='__grid']";
const staggerGroups = new Map();
document.querySelectorAll(".reveal").forEach((el) => {
  const group = el.parentElement;
  if (!group || !group.matches(LIST_LIKE)) { el.style.transitionDelay = "0s"; return; }
  const idx = staggerGroups.get(group) || 0;
  el.style.transitionDelay = `${Math.min(idx * 0.07, 0.28)}s`;
  staggerGroups.set(group, idx + 1);
});
document.documentElement.classList.add("reveal-ready");

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);

document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

/* =====================================================
   Page-wide scroll guide line
   ===================================================== */
const clamp01 = (v) => Math.min(1, Math.max(0, v));

const plFill = document.getElementById("plFill");
const plDot = document.getElementById("plDot");

function scrubUpdate() {
  if (!plFill || !plDot) return;   // the guide line only exists on Home now
  const max = document.documentElement.scrollHeight - innerHeight;
  const pageT = max > 0 ? window.scrollY / max : 0;
  plFill.style.transform = `scaleY(${pageT})`;
  plDot.style.top = `${pageT * 100}%`;
}

if (!reduceMotion && plFill && plDot) {
  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          scrubUpdate();
          ticking = false;
        });
      }
    },
    { passive: true }
  );
  window.addEventListener("resize", scrubUpdate);
  scrubUpdate();
}

/* ===== Marquee: continuous drift, eases faster while scrolling ===== */
const marquee = document.getElementById("marquee");

if (!reduceMotion && marquee) {
  let offset = 0;
  let vel = 0, smoothVel = 0, prevY = window.scrollY;

  (function drift() {
    const y = window.scrollY;
    vel = y - prevY;
    prevY = y;
    smoothVel = lerp(smoothVel, vel, 0.1);

    offset -= 0.55 + Math.min(5, Math.abs(smoothVel) * 0.25);
    const half = marquee.scrollWidth / 2;
    if (half > 0 && offset <= -half) offset += half;
    marquee.style.transform = `translateX(${offset}px)`;

    requestAnimationFrame(drift);
  })();
}

/* =====================================================
   Pulse check (only present on community.html)
   ===================================================== */
const pulseScale = document.getElementById("pulseScale");
const pulseResults = document.getElementById("pulseResults");
const pulseBars = document.getElementById("pulseBars");

if (pulseScale && pulseResults && pulseBars) {
const PULSE_KEY = "pulse.intersectionality";

function loadPulse() {
  const saved = localStorage.getItem(PULSE_KEY);
  return saved ? JSON.parse(saved) : { counts: [0, 0, 0, 0, 0], mine: null };
}

function savePulse(state) {
  localStorage.setItem(PULSE_KEY, JSON.stringify(state));
}

let pulse = loadPulse();

function renderPulse(animate) {
  if (pulse.mine === null) return;

  pulseResults.hidden = false;
  pulseScale.querySelectorAll(".pulse__option").forEach((b) => {
    b.classList.toggle("is-picked", +b.dataset.val === pulse.mine);
  });

  const total = pulse.counts.reduce((a, b) => a + b, 0) || 1;
  pulseBars.innerHTML = pulse.counts
    .map((c, i) => {
      const pct = Math.round((c / total) * 100);
      return `
      <div class="pulse__bar-row${i + 1 === pulse.mine ? " is-mine" : ""}">
        <span class="pulse__bar-num">${i + 1}</span>
        <div class="pulse__bar-track"><div class="pulse__bar-fill" data-pct="${pct}"></div></div>
        <span class="pulse__bar-pct">${pct}%</span>
      </div>`;
    })
    .join("");

  // let the bars render at 0, then animate to width
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      pulseBars.querySelectorAll(".pulse__bar-fill").forEach((bar) => {
        bar.style.width = bar.dataset.pct + "%";
      });
    });
  });
}

pulseScale.addEventListener("click", (e) => {
  const option = e.target.closest(".pulse__option");
  if (!option) return;
  const val = +option.dataset.val;
  if (pulse.mine !== null) pulse.counts[pulse.mine - 1]--; // changed their mind
  pulse.counts[val - 1]++;
  pulse.mine = val;
  savePulse(pulse);
  renderPulse(true);
});

renderPulse(false);

/* open feedback prompt */
const pulseForm = document.getElementById("pulseForm");
const pulseSent = document.getElementById("pulseSent");

if (pulseForm && pulseSent) {
  pulseForm.addEventListener("submit", (e) => {
    e.preventDefault();
    pulseForm.reset();
    pulseSent.hidden = false;
    setTimeout(() => (pulseSent.hidden = true), 5000);
  });
}
}

/* =====================================================
   3D depth layer: hero parallax + tilt-on-hover cards
   ===================================================== */
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

if (!reduceMotion && finePointer) {
  /* --- hero: text planes drift at different depths over the fluid --- */
  const heroLayers = [
    [".hero__eyebrow", 34],
    [".hero__title", 15],
    [".hero__sub", 26],
    [".hero__ctas", 42],
  ]
    .map(([sel, depth]) => ({ el: document.querySelector(sel), depth }))
    .filter((o) => o.el);

  let tx = 0, ty = 0, cx = 0, cy = 0;
  window.addEventListener(
    "mousemove",
    (e) => {
      tx = e.clientX / innerWidth - 0.5;
      ty = e.clientY / innerHeight - 0.5;
    },
    { passive: true }
  );

  (function heroParallax() {
    // ease toward the cursor for a floaty, physical feel
    cx += (tx - cx) * 0.07;
    cy += (ty - cy) * 0.07;
    if (window.scrollY < innerHeight) {
      heroLayers.forEach(({ el, depth }) => {
        el.style.transform = `translate3d(${cx * depth}px, ${cy * depth}px, 0)`;
      });
    }
    requestAnimationFrame(heroParallax);
  })();

  /* --- tilt cards in 3D under the cursor, via delegation so
         dynamically-rendered wall posts are covered too --- */
  function tiltContainer(container, selector, max, lift) {
    if (!container) return;
    let active = null;

    const reset = (el) => {
      el.style.transition = "transform 0.5s var(--ease)";
      el.style.transform = "";
    };

    container.addEventListener("mousemove", (e) => {
      const card = e.target.closest(selector);
      if (card !== active) {
        if (active) reset(active);
        active = card;
        if (card) card.classList.add("tilt-3d");
      }
      if (!card) return;
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      card.style.transition = "transform 0.1s linear";
      card.style.transform =
        `rotateY(${px * max}deg) rotateX(${-py * max}deg) translateZ(${lift}px)`;
    });

    container.addEventListener("mouseleave", () => {
      if (active) { reset(active); active = null; }
    });
  }

  tiltContainer(document.querySelector(".paths__list"), ".pathway", 4, 26);
  tiltContainer(document.querySelector(".pulse__scale"), ".pulse__option", 12, 30);
}
