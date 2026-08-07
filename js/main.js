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
   The Wall (voice.html)
   Anonymous stories, written mostly by 13-19 year olds. Three rules shape
   everything below: nothing leaves the device, every input gets the same
   safety pass, and anything you post you can take back down.
   ===================================================== */
const wallList = document.getElementById("wallList");
const wallForm = document.getElementById("wallForm");

if (wallList && wallForm) {
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

/* Posts store a timestamp, not the words "just now": a post read tomorrow
   used to still claim it was written a second ago. */
function timeAgo(ts) {
  if (!ts) return "a while ago";
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + (mins === 1 ? " minute ago" : " minutes ago");
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + (hrs === 1 ? " hour ago" : " hours ago");
  const days = Math.floor(hrs / 24);
  return days + (days === 1 ? " day ago" : " days ago");
}

/* --- the safety pass ------------------------------------------------------
   Two things get a second look before anything lands: details that could
   identify someone, and words that sound like a crisis. Neither is a block.
   Identifying details ask for one more press. Crisis words put a real
   helpline on screen first. Both are deliberately easy to walk past, because
   a wall that stops a girl mid-sentence is worse than one that pauses her.
   This runs on every input on the wall, the composer and every reply box
   alike: the reply box is exactly where someone answers a hard story with a
   harder one, so it cannot be the unguarded door. */
const CRISIS = /\b(kill myself|killing myself|end my life|take my (own )?life|want to die|wanna die|suicid\w*|self[- ]harm|hurt myself|cut myself|cutting myself)\b/i;
const IDENTIFYING = [
  /[\w.+-]+@[\w-]+\.[a-z]{2,}/i,                 // email
  /\b(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/, // phone
  /(^|\s)@[a-z0-9._]{3,}/i,                       // social handle
  /\bhttps?:\/\/\S+/i,                            // link
  /\bmy name is\b/i,
];

function screenText(text) {
  if (CRISIS.test(text)) {
    return (
      "Before this goes up: if any of that is happening to you right now, please talk to someone who can help tonight. " +
      "<strong>Kids Help Phone: text CONNECT to 686868</strong>, free and confidential, any hour. " +
      "Black youth can text <strong>RISE</strong> to the same number for RiseUp. " +
      "You can also call or text <strong>988</strong>. Your words are still yours, and sending again will put them on the wall."
    );
  }
  if (IDENTIFYING.some((re) => re.test(text))) {
    return (
      "That looks like it might name someone or share a way to contact you. " +
      "Take it out if you can, then send again. Your story lands just as hard without it, and staying unidentifiable is what keeps this wall safe."
    );
  }
  return null;
}

/* One guarded submit, shared by the composer and every reply form.
   `field` is the input, `caution` the status line under it, `onPass` the
   thing that actually posts. Returns nothing; it either warns or posts. */
function guardedSubmit(field, caution, onPass) {
  const text = field.value.trim();
  if (!text) return;

  if (caution && caution.dataset.armed !== "true") {
    const warning = screenText(text);
    if (warning) {
      caution.innerHTML = warning;
      caution.hidden = false;
      caution.dataset.armed = "true";   // the next send goes through unchanged
      return;
    }
  }
  if (caution) {
    caution.hidden = true;
    caution.dataset.armed = "false";
  }
  onPass(text);
}

/* editing after a caution re-arms the check, so a fresh problem is caught */
function watchForEdits(field, caution) {
  if (!field || !caution) return;
  field.addEventListener("input", () => {
    if (caution.dataset.armed !== "true") return;
    caution.dataset.armed = "false";
    caution.hidden = true;
  });
}

/* Announcements. Everything here used to happen in total silence: the box
   emptied, a card appeared, and a screen reader was told nothing at all. */
const wallStatus = document.getElementById("wallStatus");
function announce(msg) {
  if (!wallStatus) return;
  wallStatus.textContent = "";
  // re-setting after a tick makes repeat messages announce again
  setTimeout(() => { wallStatus.textContent = msg; }, 50);
}

function renderPosts() {
  if (!posts.length) {
    wallList.innerHTML = `
      <div class="wall__empty">
        <p><strong>Nothing saved on this device yet.</strong><br />
        One sentence is enough. What you write stays here, on this device, and no one else can read it.</p>
      </div>`;
    if (wallClear) wallClear.hidden = true;
    return;
  }
  if (wallClear) wallClear.hidden = false;

  wallList.innerHTML = posts
    .map(
      (p, i) => `
    <article class="post${p.id === justPosted ? " post--new" : ""}" data-id="${p.id}" tabindex="-1" aria-label="Your reflection ${i + 1} of ${posts.length}">
      <div class="post__meta">
        <span class="post__name">Your reflection</span>
        <span class="post__time">${timeAgo(p.ts)}</span>
      </div>
      <p class="post__body">${escapeHtml(p.body)}</p>
      <div class="post__actions">
        <button class="post__action" type="button" data-act="reply" aria-expanded="false">Add a note</button>
        <button class="post__action" type="button" data-act="heart">★ Mark this (${p.hearts || 0})</button>
        <button class="post__action post__action--remove" type="button" data-act="remove">Delete</button>
      </div>
      ${
        p.replies.length
          ? `<div class="replies">${p.replies
              .map((r) => `<div class="reply"><strong>Note</strong> · ${escapeHtml(r.body)}</div>`)
              .join("")}</div>`
          : ""
      }
      <form class="reply-form" hidden>
        <label class="visually-hidden" for="reply-${p.id}">Add a note to this reflection</label>
        <input type="text" id="reply-${p.id}" maxlength="600" placeholder="Add a note to this…" required />
        <button type="submit">Send</button>
        <p class="composer__caution reply-caution" role="status" hidden></p>
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
  if (!post) return;

  if (btn.dataset.act === "reply") {
    const form = postEl.querySelector(".reply-form");
    form.hidden = !form.hidden;
    btn.setAttribute("aria-expanded", String(!form.hidden));
    if (!form.hidden) {
      const input = form.querySelector("input");
      watchForEdits(input, form.querySelector(".reply-caution"));
      input.focus();
    }
  }

  if (btn.dataset.act === "heart") {
    post.hearts = (post.hearts || 0) + 1;
    savePosts(posts);
    btn.textContent = `♥ With you (${post.hearts})`;
    btn.classList.remove("is-pop");
    void btn.offsetWidth; // restart animation
    btn.classList.add("is-pop");
  }

  /* No confirmation dialog on purpose: taking something back down should
     never be harder than putting it up. */
  if (btn.dataset.act === "remove") {
    posts = posts.filter((p) => p.id !== post.id);
    savePosts(posts);
    renderPosts();
    announce("Taken down. It is gone from this device.");
  }
});

/* Replies go through the same gate as the composer. Only the affected post
   is re-rendered, so a draft typed into another reply box survives. */
wallList.addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target.closest(".reply-form");
  if (!form) return;
  const postEl = form.closest(".post");
  const post = posts.find((p) => p.id === postEl.dataset.id);
  if (!post) return;
  const input = form.querySelector("input");
  const caution = form.querySelector(".reply-caution");

  guardedSubmit(input, caution, (text) => {
    post.replies.push({ body: text });
    savePosts(posts);

    const existing = postEl.querySelector(".replies");
    const markup = post.replies
      .map((r) => `<div class="reply"><strong>Note</strong> · ${escapeHtml(r.body)}</div>`)
      .join("");
    if (existing) {
      existing.innerHTML = markup;
    } else {
      const wrap = document.createElement("div");
      wrap.className = "replies";
      wrap.innerHTML = markup;
      postEl.querySelector(".post__actions").after(wrap);
    }
    form.reset();
    form.hidden = true;
    postEl.querySelector('[data-act="reply"]').setAttribute("aria-expanded", "false");
    announce("Your response was added.");
  });
});

/* --- the stitch ----------------------------------------------------------
   The moment after posting used to be nothing: the box emptied, a card
   appeared, and the page said not one word about what had just taken
   effort. This pulls a gold thread from the composer down to her words,
   lets it settle into a running stitch, and leaves. It is deliberately an
   acknowledgement rather than a celebration, because some of what lands
   here is the worst thing that ever happened to someone and confetti
   would be an insult.

   Never blocks: the card is already in the DOM and readable before the
   thread starts drawing. Skipped entirely under reduced motion or the
   site's own accessible mode. */
let justPosted = null;

function motionOff() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
         document.documentElement.hasAttribute("data-a11y");
}

const NS = "http://www.w3.org/2000/svg";

function drawStitch(card) {
  const inner = wallList.closest(".wall-section__inner");
  if (!inner || !card || motionOff()) return;

  const ir = inner.getBoundingClientRect();
  const cr = wallForm.getBoundingClientRect();
  const kr = card.getBoundingClientRect();

  /* Down the LEFT GUTTER, not across the middle: the acknowledgement line
     sits between the composer and the card, and a thread drawn to the card's
     centre struck straight through those words. A stitch in the margin reads
     the way a real one does and never crosses type. */
  const GUTTER = 14;
  const x1 = GUTTER;
  const y1 = cr.bottom - ir.top - 10;   // starts inside the box she typed in
  const x2 = GUTTER;
  const y2 = kr.top - ir.top + 22;      // ends inside the card, so it binds
  if (y2 - y1 < 24) return;   // too tight to be worth drawing

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "wall__stitch");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("viewBox", `0 0 ${Math.round(ir.width)} ${Math.round(ir.height)}`);

  const path = document.createElementNS(NS, "path");
  const bow = 7;   // slight lean, so it looks sewn rather than ruled
  const d = `M ${x1} ${y1} C ${x1 + bow} ${y1 + (y2 - y1) * 0.3}, ` +
            `${x2 - bow} ${y1 + (y2 - y1) * 0.7}, ${x2} ${y2}`;
  path.setAttribute("d", d);
  svg.appendChild(path);

  const knot = document.createElementNS(NS, "circle");
  knot.setAttribute("cx", x2);
  knot.setAttribute("cy", y2);
  knot.setAttribute("r", 3.5);
  svg.appendChild(knot);

  inner.appendChild(svg);
  const len = path.getTotalLength();
  path.style.setProperty("--len", len);
  svg.addEventListener("animationend", (e) => {
    if (e.animationName === "stitch-fade") svg.remove();
  });
  // belt and braces: never leave an orphan overlay behind
  setTimeout(() => svg.remove(), 2600);
}

/* The line she actually reads. #wallStatus does the announcing, so this is
   hidden from assistive tech to avoid saying it twice. */
function acknowledge() {
  const old = document.querySelector(".wall__ack");
  if (old) old.remove();
  const p = document.createElement("p");
  p.className = "wall__ack";
  p.setAttribute("aria-hidden", "true");
  p.innerHTML = "<span>Stitched in. It stays on this device, and <b>you can take it down</b> whenever you want.</span>";
  wallForm.after(p);
  setTimeout(() => {
    p.style.transition = "opacity .6s ease";
    p.style.opacity = "0";
    setTimeout(() => p.remove(), 700);
  }, 7000);
}

const wallText = document.getElementById("wallText");
const wallCaution = document.getElementById("wallCaution");
const wallClear = document.getElementById("wallClear");
watchForEdits(wallText, wallCaution);

wallForm.addEventListener("submit", (e) => {
  e.preventDefault();
  guardedSubmit(wallText, wallCaution, (text) => {
    posts.unshift({
      id: "post-" + Date.now(),
      ts: Date.now(),
      body: text,
      replies: [],
      hearts: 0,
    });
    savePosts(posts);
    justPosted = posts[0].id;
    renderPosts();
    wallForm.reset();
    announce("It is on the wall. You can take it down any time.");
    const first = wallList.querySelector(".post");
    if (first) {
      // preventScroll: the card lands directly under the composer, so jumping
      // the viewport would only throw away the thread she is meant to see
      first.focus({ preventScroll: true });
      acknowledge();
      drawStitch(first);
    }
    justPosted = null;
  });
});

if (wallClear) {
  wallClear.addEventListener("click", () => {
    if (!posts.length) return;
    posts = [];
    savePosts(posts);
    renderPosts();
    announce("The wall on this device is empty again.");
  });
}

renderPosts();
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
  tiltContainer(document.getElementById("wallList"), ".post", 7, 26);
}
