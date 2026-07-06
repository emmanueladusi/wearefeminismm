/* wearefeminism v2 — motion + interaction.
   Front-end only: wall posts and pulse votes persist in
   localStorage. A real backend with moderation is required
   before launch (minor audience — safety-critical). */

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const lerp = (a, b, t) => a + (b - a) * t;

/* ===== Quick exit: instantly leave, replacing this page in history ===== */
document.getElementById("quickExit").addEventListener("click", () => {
  window.location.replace("https://www.google.com/search?q=weather");
});

/* ===== Nav border on scroll ===== */
const nav = document.getElementById("nav");
window.addEventListener(
  "scroll",
  () => nav.classList.toggle("is-scrolled", window.scrollY > 10),
  { passive: true }
);

/* ===== Scroll reveals — staggered within each section ===== */
const staggerGroups = new Map();
document.querySelectorAll(".reveal").forEach((el) => {
  const group = el.parentElement;
  const idx = staggerGroups.get(group) || 0;
  el.style.transitionDelay = `${Math.min(idx * 0.09, 0.36)}s`;
  staggerGroups.set(group, idx + 1);
});

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
   (the mission flythrough scene is handled in scene3d.js)
   ===================================================== */
const clamp01 = (v) => Math.min(1, Math.max(0, v));

const plFill = document.getElementById("plFill");
const plDot = document.getElementById("plDot");

function scrubUpdate() {
  const max = document.documentElement.scrollHeight - innerHeight;
  const pageT = max > 0 ? window.scrollY / max : 0;
  plFill.style.transform = `scaleY(${pageT})`;
  plDot.style.top = `${pageT * 100}%`;
}

if (!reduceMotion) {
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
   The Wall
   ===================================================== */
const wallList = document.getElementById("wallList");
const wallForm = document.getElementById("wallForm");

const WALL_KEY = "wallPosts.v2";
localStorage.removeItem("wallPosts"); // v1 held demo seed posts

function loadPosts() {
  const saved = localStorage.getItem(WALL_KEY);
  return saved ? JSON.parse(saved) : [];
}

function savePosts(list) {
  localStorage.setItem(WALL_KEY, JSON.stringify(list));
}

let posts = loadPosts();

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderPosts() {
  if (!posts.length) {
    wallList.innerHTML = `
      <div class="wall__empty">
        <p><strong>The wall is waiting for its first story.</strong><br />
        One sentence is enough. No one will ever know it was you.</p>
      </div>`;
    return;
  }

  wallList.innerHTML = posts
    .map(
      (p) => `
    <article class="post" data-id="${p.id}">
      <div class="post__meta">
        <span class="post__name">Anonymous</span>
        <span class="post__time">${p.time}</span>
      </div>
      <p class="post__body">${escapeHtml(p.body)}</p>
      <div class="post__actions">
        <button class="post__action" data-act="reply">Respond</button>
        <button class="post__action" data-act="heart">♥ With you (${p.hearts || 0})</button>
      </div>
      ${
        p.replies.length
          ? `<div class="replies">${p.replies
              .map((r) => `<div class="reply"><strong>Anonymous</strong> · ${escapeHtml(r.body)}</div>`)
              .join("")}</div>`
          : ""
      }
      <form class="reply-form" hidden>
        <input type="text" placeholder="Respond with care..." required />
        <button type="submit">Send</button>
      </form>
    </article>`
    )
    .join("");
}

wallList.addEventListener("click", (e) => {
  const btn = e.target.closest(".post__action");
  if (!btn) return;
  const postEl = btn.closest(".post");
  const post = posts.find((p) => p.id === postEl.dataset.id);

  if (btn.dataset.act === "reply") {
    const form = postEl.querySelector(".reply-form");
    form.hidden = !form.hidden;
    if (!form.hidden) form.querySelector("input").focus();
  }

  if (btn.dataset.act === "heart") {
    post.hearts = (post.hearts || 0) + 1;
    savePosts(posts);
    btn.textContent = `♥ With you (${post.hearts})`;
    btn.classList.remove("is-pop");
    void btn.offsetWidth; // restart animation
    btn.classList.add("is-pop");
  }
});

wallList.addEventListener("submit", (e) => {
  e.preventDefault();
  const postEl = e.target.closest(".post");
  const post = posts.find((p) => p.id === postEl.dataset.id);
  const input = e.target.querySelector("input");
  post.replies.push({ body: input.value.trim() });
  savePosts(posts);
  renderPosts();
});

wallForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = document.getElementById("wallText").value.trim();
  posts.unshift({
    id: "post-" + Date.now(),
    time: "just now",
    body: text,
    replies: [],
  });
  savePosts(posts);
  renderPosts();
  wallForm.reset();
});

renderPosts();

/* =====================================================
   Pulse check
   ===================================================== */
const PULSE_KEY = "pulse.intersectionality";
const pulseScale = document.getElementById("pulseScale");
const pulseResults = document.getElementById("pulseResults");
const pulseBars = document.getElementById("pulseBars");

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

pulseForm.addEventListener("submit", (e) => {
  e.preventDefault();
  pulseForm.reset();
  pulseSent.hidden = false;
  setTimeout(() => (pulseSent.hidden = true), 5000);
});

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
  tiltContainer(document.getElementById("wallList"), ".post", 7, 26);
}
