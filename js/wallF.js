/* The shared wall, room design — wall.html
   ------------------------------------------------------------------------
   Same backend contract as the previous wall.js, unchanged: the Apps Script
   endpoint, the payload shapes, the localStorage keys (a device holding a
   pending post keeps holding it across this rewrite). Only the rendering
   changed — an entrance you pass once, then two ways to read what is
   already here (Everything, a card wall; Conversations, who answered who).

   NOTHING IS PUBLIC UNTIL A HUMAN APPROVES IT. This file cannot publish
   anything: the endpoint writes every post as pending and only ever serves
   approved rows back. There is deliberately no "approve" control anywhere
   in this script, on any surface — the F prototype this was built from had
   one for demo purposes only (so a reviewer could see a card's whole life
   in one sitting without a second device). Shipping that control here would
   let any visitor publish any post on a site students aged about 13 to 19
   write on. If a reviewer needs that demo again, it lives on, unchanged, at
   wall-protos/f-combined.html — never here.

   Every place a person can type into this page routes through
   window.WFGuard (js/wallguard.js) before it sends: the crisis-language
   pause and the identifying-information pause are both defined exactly
   once, in that file, and this file only ever calls them. */

(function () {
  const DATA_URL = "https://script.google.com/macros/s/AKfycbxFQPSSLeKquN2o3ETWxLzl9YYAeMJxrv_Sa_KUQSk9J2Ib0IicDC1rpJUhfgCruXBK/exec";

  const root = document.getElementById("wallf");
  if (!root) return;

  const MAX_LEN = 1200;
  const LS_DEVICE = "wf-wall-device";
  const LS_MINE = "wf-wall-mine";
  const LS_SUPPORTED = "wf-wall-supported";
  const LS_ROOM = "wf-wall-room";
  const LS_CUED = "wf-wall-cued";

  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  const store = {
    get(k, fallback) {
      try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; }
      catch (e) { return fallback; }
    },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    getStr(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    setStr(k, v) { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} },
  };

  let device = store.get(LS_DEVICE, null);
  if (!device) {
    device = "d" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    store.set(LS_DEVICE, device);
  }

  let posts = [];                          // approved, from the server
  let mine = store.get(LS_MINE, []);       // my own, including pending
  let supported = store.get(LS_SUPPORTED, []);
  const live = !!DATA_URL;

  /* Motion is off under EITHER signal: the OS preference, or this site's own
     accessible-mode toggle. The two are not the same switch — a11y mode is
     opt-in independent of the OS — and F's decorative motion (breathing
     lights, swaying threads) is JS-driven, so the site's blanket
     `[data-a11y] * { transition:none }` CSS rule cannot reach it. Checked
     live, not cached, because a11y can be toggled without a reload. */
  function reduced() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.hasAttribute("data-a11y");
  }

  /* ------------------------------ transport ------------------------------
     Identical to wall.js: Apps Script cannot answer a CORS preflight, so
     posts go out as text/plain; the body is still JSON. */

  async function send(payload) {
    const res = await fetch(DATA_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(Object.assign({ device: device }, payload)),
    });
    return res.json();
  }

  async function load() {
    try {
      const res = await fetch(DATA_URL + "?t=" + Date.now(), { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "bad response");
      posts = data.posts || [];
      setOffline(false);
      return true;
    } catch (e) {
      console.warn("wall: could not load", e);
      setOffline(true);
      return false;
    }
  }

  const offlineEl = document.getElementById("wallfOffline");
  function setOffline(isOffline) {
    if (!offlineEl) return;
    offlineEl.hidden = !isOffline;
    if (isOffline) {
      offlineEl.querySelector("[data-offline-msg]").textContent =
        "This wall could not be reached just now. What is already loaded still works; sending " +
        "something new will try again when you submit.";
    }
  }

  /* ------------------------------- shape --------------------------------
     Same three functions as wall.js, unchanged: a top-level post plus its
     own pending copy exist as one thing to a reader, a reply-to-a-reply
     still belongs to its top-level ancestor, and "everything" is the
     server's approved rows plus whatever of mine is still waiting. */

  function everything() {
    const byId = new Map();
    posts.forEach((p) => byId.set(p.id, Object.assign({ status: "approved" }, p)));
    mine.forEach((p) => { if (!byId.has(p.id) && p.status !== "removed") byId.set(p.id, p); });
    return [...byId.values()];
  }

  function rootOf(id, byId) {
    let cur = byId.get(id);
    const guard = new Set();
    while (cur && cur.parentId && !guard.has(cur.id)) {
      guard.add(cur.id);
      const up = byId.get(cur.parentId);
      if (!up) break;
      cur = up;
    }
    return cur ? cur.id : "";
  }

  function when(iso) {
    const t = new Date(iso).getTime();
    if (!t) return "just now";
    const mins = Math.floor((Date.now() - t) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + (mins === 1 ? " minute ago" : " minutes ago");
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + (hrs === 1 ? " hour ago" : " hours ago");
    const days = Math.floor(hrs / 24);
    if (days < 30) return days + (days === 1 ? " day ago" : " days ago");
    return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  }

  function isMine(id) { return mine.some((m) => m.id === id); }
  function publicCount() { return everything().filter((p) => p.status === "approved").length; }

  function tops(sortBy) {
    const all = everything();
    const list = all.filter((p) => !p.parentId);
    const copy = list.slice();
    if (sortBy === "supported") {
      copy.sort((a, b) => (b.support || 0) - (a.support || 0) || new Date(b.at) - new Date(a.at));
    } else {
      copy.sort((a, b) => new Date(b.at) - new Date(a.at) || (a.pending ? -1 : 1));
    }
    // pending cards sit first regardless of sort: their writer needs to find them
    copy.sort((a, b) => (b.status === "pending" ? 1 : 0) - (a.status === "pending" ? 1 : 0));
    return copy;
  }
  function kidsOf(id) {
    const all = everything();
    const byId = new Map(all.map((p) => [p.id, p]));
    return all
      .filter((p) => p.parentId && rootOf(p.parentId, byId) === id)
      .sort((a, b) => new Date(a.at) - new Date(b.at));
  }
  function find(id) { return everything().find((p) => p.id === id); }

  /* ------------------------------ actions -------------------------------- */

  function rememberMine(p) {
    mine.push(p);
    if (mine.length > 200) mine = mine.slice(-200);
    store.set(LS_MINE, mine);
  }

  let busy = false;
  async function submit(text, parentId, cautionEl, fieldEl, after) {
    if (busy) return;
    if (text.length > MAX_LEN) { say("That is longer than the wall accepts."); return; }
    let target = "";
    if (parentId) {
      const byId = new Map(everything().map((p) => [p.id, p]));
      target = rootOf(parentId, byId) || parentId;
    }
    busy = true;
    say("Sending…");
    let res;
    try { res = await send({ action: "post", body: text, parentId: target }); }
    catch (e) { busy = false; say("Could not send that. Check your connection and try again."); return; }
    busy = false;

    if (!res.ok) {
      say(res.error === "slow down"
        ? "Give it " + (res.retryIn || 20) + " seconds before posting again."
        : "That did not send. Try again in a moment.");
      return;
    }
    const post = Object.assign({ status: "pending" }, res.post);
    rememberMine(post);
    fieldEl.value = "";
    if (cautionEl) { cautionEl.hidden = true; cautionEl.dataset.armed = "false"; }
    renderAll();
    say("Sent. It waits until a person has read it.");
    if (after) after(post);
  }

  async function support(id) {
    if (supported.indexOf(id) !== -1) return;
    supported.push(id);
    store.set(LS_SUPPORTED, supported);
    const p = posts.find((x) => x.id === id);
    if (p) p.support = (p.support || 0) + 1;
    renderAll();
    try { await send({ action: "support", id: id }); } catch (e) {}
  }

  async function remove(id) {
    if (!isMine(id)) return;                 // only ever your own — matches the server rule
    mine = mine.filter((m) => m.id !== id);
    store.set(LS_MINE, mine);
    posts = posts.filter((p) => p.id !== id);
    renderAll();
    try { await send({ action: "remove", id: id }); } catch (e) {}
    say("Taken down.");
  }

  async function report(id) {
    posts = posts.filter((p) => p.id !== id);   // out of sight at once, before anyone reviews it
    renderAll();
    try { await send({ action: "report", id: id }); } catch (e) {}
    say("Reported, and hidden from the wall until someone reviews it.");
  }

  function say(msg) {
    document.querySelectorAll("[data-wallf-status]").forEach((el) => { el.textContent = msg; });
  }

  /* --------------------------- the guarded compose ---------------------------
     One function, called by every textarea on this page. It reads WFGuard's
     verdict off the shared file (js/wallguard.js) and only ever calls
     submit() when that file has cleared the text — this module never
     inspects the text itself. */
  function guardedCompose(field, caution, parentId, after) {
    window.WFGuard.guardedSubmit(field, caution, (text) => submit(text, parentId, caution, field, after));
  }

  /* ============================================================
     RENDERING — three views over the same data
     ============================================================ */

  function renderAll() {
    renderEntranceCount();
    renderField();
    renderEverything();
    renderConversations();
    if (panelOpenId) openPanel(panelOpenId);   // keep an open reading panel in sync
  }

  function renderEntranceCount() {
    const el = document.getElementById("doorCount");
    if (el) el.textContent = String(publicCount());
    const wc = document.getElementById("wallfCount");
    if (wc) wc.textContent = publicCount() === 1 ? "1 card on the wall" : publicCount() + " cards on the wall";
    const empty = document.getElementById("wallfEmpty");
    if (empty) empty.hidden = tops("new").length !== 0;
  }

  /* ---------------------------- Everything -------------------------------- */

  const cardsEl = document.getElementById("wallfCards");
  const sortEl = document.getElementById("wallfSort");
  let replyOpenId = null;

  function colCount() {
    const w = window.innerWidth || document.documentElement.clientWidth || 1280;
    return w >= 1080 ? 3 : (w >= 680 ? 2 : 1);
  }

  function tilt(id, spread) {
    return ((seedRand(id) - 0.5) * (spread || 2.6)).toFixed(2) + "deg";
  }
  function seedRand(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 10000) / 10000;
  }

  function slipHTML(r) {
    if (r.status === "pending") {
      return '<li class="wallf-slip wallf-slip--pending" style="--tilt:' + tilt(r.id, 1.4) + '">' +
        esc(r.body).replace(/\n+/g, "<br>") +
        '<span class="wallf-slip__when">Waiting to be read &middot; only you can see this</span>' +
        (isMine(r.id) ? '<div class="wallf-slip__acts"><button class="wallf-pact" type="button" data-wf-remove="' + esc(r.id) + '">Take it down</button></div>' : "") +
        "</li>";
    }
    return '<li class="wallf-slip" style="--tilt:' + tilt(r.id, 1.4) + '">' +
      esc(r.body).replace(/\n+/g, "<br>") +
      '<span class="wallf-slip__when">' + esc(when(r.at)) + " &middot; a reply</span></li>";
  }

  function cardHTML(p) {
    const kids = kidsOf(p.id);
    const on = supported.indexOf(p.id) !== -1;
    const pending = p.status === "pending";

    if (pending) {
      return '<article class="wallf-card wallf-card--pending" style="--tilt:' + tilt(p.id) + '">' +
        '<span class="wallf-card__pin"></span>' +
        '<span class="wallf-card__wait">Waiting to be read &middot; only you can see this</span>' +
        '<p class="wallf-card__body">' + esc(p.body).replace(/\n+/g, "<br>") + "</p>" +
        '<div class="wallf-card__foot"><span class="wallf-card__when">just now</span>' +
        (isMine(p.id) ? '<button class="wallf-pact" type="button" data-wf-remove="' + esc(p.id) + '">Take it down</button>' : "") +
        "</div></article>";
    }

    const box = replyOpenId === p.id
      ? '<div class="wallf-replybox">' +
          '<label class="visually-hidden" for="wf-rb-' + esc(p.id) + '">Write an answer</label>' +
          '<textarea id="wf-rb-' + esc(p.id) + '" rows="3" maxlength="' + MAX_LEN + '" placeholder="Say something to them."></textarea>' +
          '<p class="caution wallf-caution" role="status" hidden></p>' +
          '<div class="wallf-replybox__row"><p class="wallf-replybox__note">No name is attached.</p>' +
          '<button class="wallf-ghost" type="button" data-wf-replycancel>Cancel</button>' +
          '<button class="wallf-pin" type="button" data-wf-replysend="' + esc(p.id) + '">Pin the answer</button></div></div>'
      : "";

    return '<article class="wallf-card" style="--tilt:' + tilt(p.id) + '">' +
      '<span class="wallf-card__pin"></span>' +
      '<p class="wallf-card__body">' + esc(p.body).replace(/\n+/g, "<br>") + "</p>" +
      '<div class="wallf-card__foot">' +
        '<span class="wallf-card__when">' + esc(when(p.at)) + "</span>" +
        '<button class="wallf-pact wallf-pact--sup' + (on ? " is-on" : "") + '" type="button" data-wf-sup="' + esc(p.id) + '"' + (on ? " disabled" : "") + '>' +
          '<span aria-hidden="true">&#9825;</span><span class="wallf-pact__n">' + (p.support || 0) + "</span>" +
          '<span class="visually-hidden"> people found this helpful. Mark as helpful</span></button>' +
        '<button class="wallf-pact" type="button" data-wf-reply="' + esc(p.id) + '">Answer' + (kids.length ? ' <span class="wallf-pact__n">' + kids.length + "</span>" : "") + "</button>" +
        (isMine(p.id) ? '<button class="wallf-pact" type="button" data-wf-remove="' + esc(p.id) + '">Take it down</button>' : "") +
        (isMine(p.id) ? "" : '<button class="wallf-pact" type="button" data-wf-report="' + esc(p.id) + '">Report</button>') +
      "</div>" + box +
      (kids.length ? '<ul class="wallf-slips">' + kids.map(slipHTML).join("") + "</ul>" : "") +
    "</article>";
  }

  function composeCard() {
    return '<div class="wallf-compose" id="wallfCompose">' +
      '<button class="wallf-compose__prompt" type="button" id="wallfComposeOpen">' +
        "<b>Take a blank card</b>" +
        "<span>Something that happened. Something you noticed. Something you wish someone had told you.</span>" +
      "</button>" +
      '<form class="wallf-compose__form" id="wallfComposeForm">' +
        '<label class="visually-hidden" for="wallfComposeField">Write something for the wall</label>' +
        '<textarea class="wallf-compose__field" id="wallfComposeField" rows="6" maxlength="' + MAX_LEN + '" placeholder="Start anywhere."></textarea>' +
        '<p class="caution wallf-caution" role="status" hidden id="wallfComposeCaution"></p>' +
        '<div class="wallf-compose__row"><p class="wallf-compose__note">No name is attached. You can take it down later.</p>' +
        '<button class="wallf-ghost" type="button" id="wallfComposeCancel">Put it back</button>' +
        '<button class="wallf-pin" type="submit">Pin it up</button></div>' +
      "</form></div>";
  }

  function rulesCard() {
    // verbatim: the site's one copy of these rules, matching the house-rules
    // aside on this same page and the private wall's own version.
    return '<aside class="wallf-rules"><h2>How this wall works</h2><ul>' +
      "<li><strong>A person reads it first.</strong> Your post waits until it has been approved. You can see your own while it waits. Nobody else can.</li>" +
      "<li><strong>No name, no account.</strong> Nothing you post is tied to who you are.</li>" +
      "<li><strong>No downvotes.</strong> You can mark a post as helpful, and that is the only number on this page. There is nothing here to lose.</li>" +
      "<li><strong>Take it down any time.</strong> Your own posts, whenever you want.</li>" +
      "<li><strong>Report anything cruel.</strong> One report pulls a post off the wall straight away, before anyone reviews it.</li>" +
      '</ul><p class="wallf-rules__warn"><strong>Do not post anything that identifies you or anyone else.</strong> ' +
      "No full names, no schools, no handles, no phone numbers. This page checks for those and will ask you twice, but it cannot catch everything.</p>" +
      '<p class="wallf-rules__help">If things are bad right now: <strong>Kids Help Phone</strong>, text CONNECT to 686868, any hour. ' +
      "Black youth can text RISE to the same number. Or call 988.</p></aside>";
  }

  function renderEverything() {
    if (!cardsEl) return;
    const list = tops(sortEl ? sortEl.value : "new");
    const items = [composeCard()].concat(list.map(cardHTML)).concat([rulesCard()]);
    const n = colCount();
    const cols = [];
    for (let c = 0; c < n; c++) cols.push([]);
    items.forEach((html, k) => cols[k % n].push(html));
    cardsEl.innerHTML = cols.map((col) => '<div class="wallf-col">' + col.join("") + "</div>").join("");
    wireCompose();
  }

  function wireCompose() {
    const compose = document.getElementById("wallfCompose");
    if (!compose) return;
    const open = document.getElementById("wallfComposeOpen");
    const field = document.getElementById("wallfComposeField");
    const caution = document.getElementById("wallfComposeCaution");
    open.addEventListener("click", () => { compose.classList.add("is-open"); field.focus(); });
    document.getElementById("wallfComposeCancel").addEventListener("click", () => compose.classList.remove("is-open"));
    window.WFGuard.watchForEdits(field, caution);
    document.getElementById("wallfComposeForm").addEventListener("submit", (e) => {
      e.preventDefault();
      guardedCompose(field, caution, "", () => compose.classList.remove("is-open"));
    });
  }

  if (cardsEl) {
    cardsEl.addEventListener("click", (e) => {
      let el;
      if ((el = e.target.closest("[data-wf-sup]"))) { support(el.getAttribute("data-wf-sup")); return; }
      if ((el = e.target.closest("[data-wf-remove]"))) { remove(el.getAttribute("data-wf-remove")); return; }
      if ((el = e.target.closest("[data-wf-report]"))) { report(el.getAttribute("data-wf-report")); return; }
      if (e.target.closest("[data-wf-replycancel]")) { replyOpenId = null; renderEverything(); return; }
      if ((el = e.target.closest("[data-wf-replysend]"))) {
        const id = el.getAttribute("data-wf-replysend");
        const field = cardsEl.querySelector("#wf-rb-" + CSS.escape(id));
        const caution = field && field.parentElement.querySelector(".wallf-caution");
        if (!field || !field.value.trim()) { if (field) field.focus(); return; }
        guardedCompose(field, caution, id, () => { replyOpenId = null; });
        return;
      }
      if ((el = e.target.closest("[data-wf-reply]"))) {
        const id = el.getAttribute("data-wf-reply");
        replyOpenId = replyOpenId === id ? null : id;
        renderEverything();
        const box = cardsEl.querySelector("#wf-rb-" + CSS.escape(id));
        if (box) {
          const caution = box.parentElement.querySelector(".wallf-caution");
          window.WFGuard.watchForEdits(box, caution);
          box.focus();
        }
      }
    });
  }
  if (sortEl) sortEl.addEventListener("change", renderEverything);

  /* ---------------------------- the entrance field -------------------------- */

  const cv = document.getElementById("wallfCanvas");
  const ctx = cv ? cv.getContext("2d") : null;
  const tip = document.getElementById("wallfTip");
  let lights = [];
  const cam = { x: 0, y: 0, s: 1, tx: 0, ty: 0, ts: 0.62 };
  let W = 0, H = 0, dpr = 1, t = 0, hover = null, dragging = false, moved = 0;

  function vw() { return window.innerWidth || document.documentElement.clientWidth || 1280; }
  function vh() { return window.innerHeight || document.documentElement.clientHeight || 800; }

  function resizeCanvas() {
    if (!cv) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = cv.clientWidth || vw(); H = cv.clientHeight || vh();
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function layoutField() {
    const keep = {};
    lights.forEach((l) => { keep[l.post.id] = l; });
    lights = [];
    const GOLD = 2.39996323;
    tops("new").forEach((p, i) => {
      const a = i * GOLD, r = 168 * Math.sqrt(i + 0.6);
      const l = keep[p.id] || { x: 0, y: 0 };
      l.post = p;
      l.fx = Math.cos(a) * r + (seedRand(p.id + "x") - 0.5) * 66;
      l.fy = Math.sin(a) * r * 0.74 + (seedRand(p.id + "y") - 0.5) * 66;
      l.ph = seedRand(p.id + "p") * 6.28;
      l.kids = kidsOf(p.id);
      if (!keep[p.id]) { l.x = l.fx; l.y = l.fy; l.tx = l.fx; l.ty = l.fy; }
      lights.push(l);
      l.kids.forEach((k, j) => {
        const ka = seedRand(k.id) * 6.28 + j * 1.9, kr = 62 + seedRand(k.id + "r") * 26;
        const kl = keep[k.id] || { x: 0, y: 0 };
        kl.post = k; kl.parent = l; kl.small = true; kl.kids = [];
        kl.fx = l.fx + Math.cos(ka) * kr; kl.fy = l.fy + Math.sin(ka) * kr * 0.8;
        kl.ph = seedRand(k.id + "p") * 6.28;
        if (!keep[k.id]) { kl.x = kl.fx; kl.y = kl.fy; kl.tx = kl.fx; kl.ty = kl.fy; }
        lights.push(kl);
      });
    });
  }

  function radius(l) {
    if (l.post.status === "pending") return 5.5;
    if (l.small) return 3.4;
    return 4.6 + Math.min(9, Math.sqrt(l.post.support || 0) * 1.7);
  }
  function toScreen(l) { return { x: (l.x - cam.x) * cam.s + W / 2, y: (l.y - cam.y) * cam.s + H / 2 }; }

  function drawField() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    if (!reduced()) t += 0.009;

    ctx.lineWidth = 1;
    lights.forEach((l) => {
      if (!l.parent) return;
      const a = toScreen(l.parent), b = toScreen(l);
      const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      g.addColorStop(0, "rgba(234,115,147,.30)");
      g.addColorStop(1, "rgba(234,115,147,.04)");
      ctx.strokeStyle = g;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });

    lights.forEach((l) => {
      const p = toScreen(l);
      if (p.x < -160 || p.x > W + 160 || p.y < -160 || p.y > H + 160) return;
      const breathe = reduced() ? 1 : 1 + Math.sin(t * 1.4 + l.ph) * 0.07;
      const r = radius(l) * cam.s * breathe;
      const isHover = hover === l, warm = l.post.status === "pending";
      const R = r * 5.2;
      const core = warm ? "234,115,147" : (l.small ? "205,175,225" : "255,236,246");
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
      glow.addColorStop(0, "rgba(" + core + "," + (isHover ? 0.52 : 0.30) + ")");
      glow.addColorStop(0.34, "rgba(" + core + ",.075)");
      glow.addColorStop(1, "rgba(" + core + ",0)");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, 6.283); ctx.fill();

      ctx.fillStyle = warm ? "rgba(255,206,222,.95)" : "rgba(255,252,255," + (isHover ? 1 : 0.92) + ")";
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.2, r * 0.5), 0, 6.283); ctx.fill();

      if (warm) {
        ctx.strokeStyle = "rgba(234,115,147," + (0.42 + (reduced() ? 0 : Math.sin(t * 2.2) * 0.24)) + ")";
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.6, 0, 6.283); ctx.stroke();
      }
      if (isHover) {
        ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.9, 0, 6.283); ctx.stroke();
      }
    });
  }

  function hitTest(mx, my) {
    let best = null, bestD = 30;
    lights.forEach((l) => {
      const p = toScreen(l);
      const d = Math.hypot(p.x - mx, p.y - my) - radius(l) * cam.s;
      if (d < bestD) { bestD = d; best = l; }
    });
    return best;
  }

  function renderField() { layoutField(); }   // camera/draw loop reads `lights` live; this just refreshes positions

  if (cv) {
    cv.addEventListener("pointermove", (e) => {
      if (mode !== "field") return;
      if (dragging) {
        moved += Math.abs(e.movementX) + Math.abs(e.movementY);
        cam.tx -= e.movementX / cam.s; cam.ty -= e.movementY / cam.s;
        cam.x = cam.tx; cam.y = cam.ty;
        return;
      }
      const l = hitTest(e.clientX, e.clientY);
      hover = l;
      cv.classList.toggle("is-over", !!l);
      if (l && tip) {
        const txt = l.post.body;
        tip.innerHTML = esc(txt.length > 130 ? txt.slice(0, 130) + "…" : txt) +
          "<em>" + (l.post.status === "pending" ? "waiting to be read"
            : (l.small ? "an answer" : (l.post.support || 0) + " found this helpful")) + " &middot; click to read</em>";
        tip.classList.add("is-on");
        tip.style.left = Math.min(e.clientX + 18, vw() - 312) + "px";
        tip.style.top = Math.min(e.clientY + 18, vh() - 140) + "px";
      } else if (tip) tip.classList.remove("is-on");
    });
    cv.addEventListener("pointerdown", (e) => {
      if (mode !== "field") return;
      dragging = true; moved = 0; cv.setPointerCapture(e.pointerId); cv.classList.add("is-drag");
    });
    cv.addEventListener("pointerup", (e) => {
      if (mode !== "field") return;
      dragging = false; cv.classList.remove("is-drag");
      if (moved < 5) { const l = hitTest(e.clientX, e.clientY); if (l) openPanel(l.post.id); }
    });
    // plain wheel pans; the pinch gesture (ctrl/meta+wheel) zooms — one meaning
    // per gesture, matching the rule used in Conversations below
    cv.addEventListener("wheel", (e) => {
      if (mode !== "field") return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        cam.ts = Math.max(0.34, Math.min(2.4, cam.ts * (e.deltaY > 0 ? 0.92 : 1.09)));
        return;
      }
      cam.tx += (Math.abs(e.deltaX) < 1 ? 0 : e.deltaX) / cam.s;
      cam.ty += e.deltaY / cam.s;
      cam.x = cam.tx; cam.y = cam.ty;
    }, { passive: false });
  }

  /* --------------------------- the reading panel -------------------------- */

  const panel = document.getElementById("wallfPanel");
  const panelBody = document.getElementById("wallfPanelBody");
  let panelOpenId = null, answerFor = null;

  function openPanel(id) {
    const p = find(id);
    if (!p) return closePanel();
    panelOpenId = id;
    const kids = kidsOf(id), on = supported.indexOf(id) !== -1, isReply = !!p.parentId, pending = p.status === "pending";
    const kindEl = document.getElementById("wallfPanelKind");
    if (kindEl) kindEl.textContent = pending ? "Yours, waiting" : (isReply ? "An answer" : "On the wall");

    panelBody.innerHTML =
      (pending ? '<span class="wallf-panel__wait">Waiting to be read &middot; only you can see this</span>' : "") +
      '<p class="wallf-panel__text">' + esc(p.body).replace(/\n+/g, "<br>") + "</p>" +
      '<p class="wallf-panel__meta"><span>' + esc(pending ? "just now" : when(p.at)) + "</span>" +
        (pending ? "" : "<span>&middot;</span><span>" + (p.support || 0) + " found this helpful</span>") + "</p>" +
      '<div class="wallf-panel__acts">' +
        (pending
          ? (isMine(id) ? '<button class="wallf-btn" type="button" data-wf-remove="' + esc(id) + '">Take it down</button>' : "")
          : '<button class="wallf-btn' + (on ? "" : " wallf-btn--go") + '" type="button" data-wf-sup="' + esc(id) + '"' + (on ? " disabled" : "") + '>' +
              (on ? "Marked helpful" : "This helped") + "</button>" +
            (isReply ? "" : '<button class="wallf-btn" type="button" id="wallfAnswerBtn">Answer this</button>') +
            (isMine(id)
              ? '<button class="wallf-btn" type="button" data-wf-remove="' + esc(id) + '">Take it down</button>'
              : '<button class="wallf-btn" type="button" data-wf-report="' + esc(id) + '">Report</button>')) +
      "</div>" +
      (answerFor === id
        ? '<div class="wallf-answerbox">' +
            '<label class="visually-hidden" for="wallfAnswerField">Write an answer</label>' +
            '<textarea id="wallfAnswerField" rows="3" maxlength="' + MAX_LEN + '" placeholder="Say something to them."></textarea>' +
            '<p class="caution wallf-caution" role="status" hidden id="wallfAnswerCaution"></p>' +
            '<div class="wallf-answerbox__row"><p class="wallf-answerbox__note">No name is attached.</p>' +
            '<button class="wallf-btn wallf-btn--sm" type="button" id="wallfAnswerCancel">Cancel</button>' +
            '<button class="wallf-btn wallf-btn--go wallf-btn--sm" type="button" id="wallfAnswerSend">Send the answer</button></div></div>'
        : "") +
      (kids.length
        ? "<h3>" + kids.length + (kids.length === 1 ? " answer" : " answers") + "</h3>" +
          kids.map((k) => {
            const kPending = k.status === "pending";
            return '<div class="wallf-reply">' + esc(k.body) +
              "<span>" + (kPending ? "waiting to be read &middot; only you can see this" : esc(when(k.at))) + "</span>" +
              (kPending && isMine(k.id)
                ? '<p style="margin-top:10px"><button class="wallf-btn wallf-btn--sm" type="button" data-wf-remove="' + esc(k.id) + '">Take it down</button></p>'
                : "") + "</div>";
          }).join("")
        : "");

    if (panel) { panel.classList.add("is-on"); panel.setAttribute("aria-hidden", "false"); }
    const l = lights.find((x) => x.post.id === id);
    if (l && mode === "field") {
      cam.tx = l.x + 220 / cam.ts; cam.ty = l.y;
      cam.ts = Math.max(cam.ts, 1.15);
    }

    if (answerFor === id) {
      const f = document.getElementById("wallfAnswerField");
      const c = document.getElementById("wallfAnswerCaution");
      window.WFGuard.watchForEdits(f, c);
    }
  }
  function closePanel() {
    panelOpenId = null; answerFor = null;
    if (panel) { panel.classList.remove("is-on"); panel.setAttribute("aria-hidden", "true"); }
  }
  const panelX = document.getElementById("wallfPanelX");
  if (panelX) panelX.addEventListener("click", closePanel);

  if (panelBody) {
    panelBody.addEventListener("click", (e) => {
      let el;
      if ((el = e.target.closest("[data-wf-sup]"))) { support(el.getAttribute("data-wf-sup")); return; }
      if ((el = e.target.closest("[data-wf-remove]"))) {
        const id = el.getAttribute("data-wf-remove");
        const d = find(id);
        const parent = d && d.parentId ? d.parentId : null;
        remove(id).then(() => { if (parent) openPanel(parent); else closePanel(); });
        return;
      }
      if ((el = e.target.closest("[data-wf-report]"))) {
        const id = el.getAttribute("data-wf-report");
        report(id).then(() => closePanel());
        return;
      }
      if (e.target.id === "wallfAnswerBtn") { answerFor = panelOpenId; openPanel(panelOpenId); const f = document.getElementById("wallfAnswerField"); if (f) f.focus(); return; }
      if (e.target.id === "wallfAnswerCancel") { answerFor = null; openPanel(panelOpenId); return; }
      if (e.target.id === "wallfAnswerSend") {
        const f = document.getElementById("wallfAnswerField");
        const c = document.getElementById("wallfAnswerCaution");
        if (!f || !f.value.trim()) { if (f) f.focus(); return; }
        const parentId = answerFor;
        guardedCompose(f, c, parentId, () => { answerFor = null; openPanel(parentId); });
      }
    });
  }

  /* ---------------------------- Conversations ------------------------------ */

  const tvp = document.getElementById("wallfTvp");
  const tworld = document.getElementById("wallfTworld");
  const tsvg = document.getElementById("wallfThreads");
  let laid = [];
  const tcam = { x: 0, y: 0, s: 1, tx: 0, ty: 0, ts: 1 };
  let tdrag = false;

  function layoutThread() {
    laid = [];
    tops("new").forEach((p, i) => {
      const x = i * 430;
      const y = Math.sin(i * 0.85) * 190 + (seedRand(p.id) - 0.5) * 70;
      const node = { post: p, x, y, w: 330, root: true };
      laid.push(node);
      kidsOf(p.id).forEach((k, j) => {
        laid.push({ post: k, x: x + 42 + (seedRand(k.id) - 0.5) * 60, y: y + 300 + j * 170, w: 274, parent: node });
      });
    });
  }

  function nodeHTML(n) {
    const p = n.post, on = supported.indexOf(p.id) !== -1, pending = p.status === "pending";
    return '<article class="wallf-node' + (n.root ? "" : " wallf-node--reply") + (pending ? " wallf-node--pending" : "") +
      '" data-id="' + esc(p.id) + '" style="left:' + n.x + "px;top:" + n.y + "px;width:" + n.w + 'px">' +
      '<span class="wallf-node__knot"></span>' +
      (pending ? '<span class="wallf-node__wait">Waiting to be read &middot; only you</span>' : "") +
      '<p class="wallf-node__body">' + esc(p.body).replace(/\n+/g, "<br>") + "</p>" +
      '<div class="wallf-node__foot">' +
        '<span class="wallf-node__when">' + esc(pending ? "just now" : when(p.at)) + (n.root ? "" : " &middot; an answer") + "</span>" +
        (pending
          ? (isMine(p.id) ? '<button class="wallf-pact" type="button" data-wf-remove="' + esc(p.id) + '">Take it down</button>' : "")
          : '<button class="wallf-pact wallf-pact--sup' + (on ? " is-on" : "") + '" type="button" data-wf-sup="' + esc(p.id) + '"' + (on ? " disabled" : "") + '>' +
              '<span aria-hidden="true">&#9825;</span><span class="wallf-pact__n">' + (p.support || 0) + "</span>" +
              '<span class="visually-hidden"> people found this helpful. Mark as helpful</span></button>' +
            (n.root ? '<button class="wallf-pact" type="button" data-wf-answer="' + esc(p.id) + '">Answer</button>' : "") +
            (isMine(p.id)
              ? '<button class="wallf-pact" type="button" data-wf-remove="' + esc(p.id) + '">Take it down</button>'
              : '<button class="wallf-pact" type="button" data-wf-report="' + esc(p.id) + '">Report</button>')) +
      "</div></article>";
  }

  function renderConversations() {
    if (!tworld) return;
    layoutThread();
    tworld.querySelectorAll(".wallf-node").forEach((el) => el.remove());
    tworld.insertAdjacentHTML("beforeend", laid.map(nodeHTML).join(""));
    laid.forEach((n) => {
      const el = tworld.querySelector('.wallf-node[data-id="' + CSS.escape(n.post.id) + '"]');
      n.h = el ? el.offsetHeight : 140;
    });
    drawThreads();
  }

  function drawThreads() {
    if (!tsvg) return;
    const d = [];
    const roots = laid.filter((n) => n.root);
    for (let i = 0; i < roots.length - 1; i++) {
      const a = roots[i], b = roots[i + 1];
      d.push(hang(a.x + a.w / 2, a.y + (a.h || 140), b.x + b.w / 2, b.y, 0.30, i, false));
    }
    laid.filter((n) => n.parent).forEach((n, j) => {
      const p = n.parent;
      d.push(hang(p.x + p.w / 2, p.y + (p.h || 140), n.x + n.w / 2, n.y, 0.22, j + 40, true));
    });
    tsvg.innerHTML = d.join("");
  }
  function hang(x1, y1, x2, y2, k, seed, thin) {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const span = Math.hypot(x2 - x1, y2 - y1);
    const sway = reduced() ? 0 : Math.sin(t * 0.7 + seed) * 7;
    return '<path d="M' + x1 + "," + y1 + " Q" + (mx + sway) + "," + (my + span * k) + " " + x2 + "," + y2 + '" ' +
      'fill="none" stroke="rgba(255,166,190,' + (thin ? 0.40 : 0.58) + ')" stroke-width="' + (thin ? 1.2 : 1.8) + '" stroke-linecap="round"/>';
  }

  function tCenterOn(wx, wy, s) {
    if (s) tcam.ts = s;
    tcam.tx = vw() / 2 - wx * tcam.ts;
    tcam.ty = vh() / 2 - wy * tcam.ts;
  }
  function fitThread() {
    if (!laid.length) return;
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    laid.forEach((n) => {
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x + n.w);
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y + (n.h || 140));
    });
    const w = maxX - minX, h = maxY - minY;
    tcam.ts = Math.max(0.22, Math.min((vw() - 120) / w, (vh() - 260) / h, 1));
    tCenterOn((minX + maxX) / 2, (minY + maxY) / 2);
  }

  if (tvp) {
    tvp.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      tdrag = true; tvp.setPointerCapture(e.pointerId); tvp.classList.add("is-drag");
    });
    tvp.addEventListener("pointermove", (e) => {
      if (!tdrag) return;
      tcam.tx += e.movementX; tcam.ty += e.movementY;
      tcam.x = tcam.tx; tcam.y = tcam.ty;
    });
    tvp.addEventListener("pointerup", () => { tdrag = false; tvp.classList.remove("is-drag"); });
    // plain wheel travels along the line (vertical delta -> horizontal travel,
    // since this line runs across); ctrl/meta+wheel (a trackpad pinch) zooms
    tvp.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const ns = Math.max(0.22, Math.min(1.7, tcam.ts * (e.deltaY > 0 ? 0.92 : 1.09)));
        const wx = (e.clientX - tcam.tx) / tcam.ts, wy = (e.clientY - tcam.ty) / tcam.ts;
        tcam.ts = ns; tcam.tx = e.clientX - wx * ns; tcam.ty = e.clientY - wy * ns;
        return;
      }
      if (Math.abs(e.deltaX) < 1) tcam.tx -= e.deltaY;
      else { tcam.tx -= e.deltaX; tcam.ty -= e.deltaY; }
      tcam.x = tcam.tx; tcam.y = tcam.ty;
    }, { passive: false });

    tworld.addEventListener("focusin", (e) => {
      const card = e.target.closest(".wallf-node"); if (!card) return;
      const n = laid.find((x) => x.post.id === card.getAttribute("data-id"));
      if (n) tCenterOn(n.x + n.w / 2, n.y + (n.h || 140) / 2, Math.max(tcam.ts, 0.9));
    });

    tworld.addEventListener("click", (e) => {
      let el;
      if ((el = e.target.closest("[data-wf-sup]"))) { support(el.getAttribute("data-wf-sup")); return; }
      if ((el = e.target.closest("[data-wf-remove]"))) { remove(el.getAttribute("data-wf-remove")); return; }
      if ((el = e.target.closest("[data-wf-report]"))) { report(el.getAttribute("data-wf-report")); return; }
      if ((el = e.target.closest("[data-wf-answer]"))) { openWrite(el.getAttribute("data-wf-answer")); }
    });

    const zIn = document.getElementById("wallfZoomIn"), zOut = document.getElementById("wallfZoomOut");
    function zoomBy(f) {
      const ns = Math.max(0.22, Math.min(1.7, tcam.ts * f));
      const cx = vw() / 2, cy = vh() / 2;
      const wx = (cx - tcam.tx) / tcam.ts, wy = (cy - tcam.ty) / tcam.ts;
      tcam.ts = ns; tcam.tx = cx - wx * ns; tcam.ty = cy - wy * ns;
    }
    if (zIn) zIn.addEventListener("click", () => zoomBy(1.25));
    if (zOut) zOut.addEventListener("click", () => zoomBy(0.8));
    const fitBtn = document.getElementById("wallfFit");
    if (fitBtn) fitBtn.addEventListener("click", fitThread);
  }

  /* ============================================================
     THE ENTRANCE / ROOM SWITCH
     ============================================================ */

  let mode = "field";
  let morphing = false;

  function wallTargets() {
    const n = colCount(), gut = Math.min(72, vw() * 0.05);
    const colW = (vw() - gut * 2) / n;
    const out = {};
    let i = 0;
    tops("new").forEach((p) => {
      const c = (i + 1) % n, row = Math.floor((i + 1) / n);
      out[p.id] = { x: gut + colW * (c + 0.5), y: 210 + row * 230 };
      kidsOf(p.id).forEach((k, j) => { out[k.id] = { x: gut + colW * (c + 0.5) + 24, y: 210 + row * 230 + 110 + j * 26 }; });
      i++;
    });
    return out;
  }
  function threadTargets() {
    const out = {}, n = Math.max(tops("new").length, 2);
    const span = vw() - 200;
    tops("new").forEach((p, i) => {
      const x = 100 + (span * i) / (n - 1);
      const y = vh() / 2 + Math.sin(i * 0.85) * Math.min(150, vh() * 0.2);
      out[p.id] = { x, y };
      kidsOf(p.id).forEach((k, j) => { out[k.id] = { x: x + 30, y: y + 120 + j * 60 }; });
    });
    return out;
  }
  function toWorld(sx, sy) { return { x: (sx - W / 2) / cam.s + cam.x, y: (sy - H / 2) / cam.s + cam.y }; }

  function remember(room) { store.setStr(LS_ROOM, room); }

  function setRoomView(id) {
    ["wallfEverything", "wallfConversations"].forEach((v) => {
      const el = document.getElementById(v);
      if (el) el.classList.toggle("is-on", v === id);
    });
  }

  function land(next) {
    mode = next;
    document.body.setAttribute("data-wallf-mode", next);
    document.querySelectorAll("[data-wf-mode]").forEach((b) => {
      b.setAttribute("aria-current", b.getAttribute("data-wf-mode") === next ? "true" : "false");
    });
    // the back button and mode toggle show/hide across this attribute
    // change, which can change the bar's own height on a narrow phone
    setTimeout(setNavOffset, 0);
    setRoomView(next === "everything" ? "wallfEverything" : next === "conversations" ? "wallfConversations" : null);
    const fieldEl = document.getElementById("wallfField");
    if (fieldEl) fieldEl.style.opacity = next === "field" ? "1" : "0";
    if (next === "everything") {
      if (window.__lenis) window.__lenis.scrollTo(0, { immediate: true }); else window.scrollTo(0, 0);
      say("Everything. Every post, pinned up.");
    }
    if (next === "conversations") { renderConversations(); const first = laid[0]; if (first) tCenterOn(first.x + first.w / 2, first.y + 140, 0.92); say("Conversations. Every answer tied to what it answers."); }
    if (next === "field") { lights.forEach((l) => { l.tx = l.fx; l.ty = l.fy; }); say("The entrance."); }
    remember(next === "field" ? null : next);
  }

  function goTo(next) {
    if (next === mode || morphing) return;
    if (panel && panel.classList.contains("is-on")) closePanel();
    if (tip) tip.classList.remove("is-on");
    hover = null;

    if (reduced()) { land(next); return; }

    if (next === "field") {
      setRoomView(null);
      lights.forEach((l) => { l.tx = l.fx; l.ty = l.fy; });
      mode = "field"; document.body.setAttribute("data-wallf-mode", "field");
      morphing = true;
      const fieldEl = document.getElementById("wallfField");
      if (fieldEl) fieldEl.style.opacity = "1";
      setTimeout(() => { morphing = false; }, 700);
      remember(null);
      say("Back at the entrance.");
      return;
    }

    if (mode !== "field") {
      setRoomView(null);
      morphing = true;
      setTimeout(() => { land(next); morphing = false; }, 200);
      return;
    }

    setRoomView(null);
    const targets = next === "everything" ? wallTargets() : threadTargets();
    lights.forEach((l) => {
      const s = targets[l.post.id];
      if (!s) return;
      const w = toWorld(s.x, s.y);
      l.tx = w.x; l.ty = w.y;
    });
    morphing = true;
    const fieldEl = document.getElementById("wallfField");
    if (fieldEl) fieldEl.style.opacity = "1";
    setTimeout(() => { if (fieldEl) fieldEl.style.opacity = "0"; }, 340);
    setTimeout(() => { land(next); morphing = false; }, 560);
  }

  document.querySelectorAll("[data-wf-mode]").forEach((b) => {
    b.addEventListener("click", () => goTo(b.getAttribute("data-wf-mode")));
  });
  document.querySelectorAll("[data-wf-go]").forEach((b) => {
    b.addEventListener("click", () => goTo(b.getAttribute("data-wf-go")));
  });
  const backBtn = document.getElementById("wallfBack");
  if (backBtn) backBtn.addEventListener("click", () => goTo("field"));

  /* ------------------------------- the write sheet ------------------------------- */

  const veil = document.getElementById("wallfVeil");
  const writeSheet = document.getElementById("wallfWrite");
  let replyTo = null;

  function openWrite(target) {
    replyTo = target || null;
    const p = replyTo ? find(replyTo) : null;
    const h = document.getElementById("wallfWriteH");
    const sub = document.getElementById("wallfWriteSub");
    const send = document.getElementById("wallfWriteSend");
    if (h) h.textContent = p ? "Answer them." : "Say something.";
    if (sub) sub.textContent = p
      ? "You are answering: " + (p.body.length > 110 ? p.body.slice(0, 110) + "…" : p.body)
      : "Something that happened. Something you noticed. Something you wish someone had told you.";
    if (send) send.textContent = p ? "Send the answer" : "Send it";
    if (veil) veil.classList.add("is-on");
    if (writeSheet) writeSheet.classList.add("is-on");
    const field = document.getElementById("wallfWriteField");
    const caution = document.getElementById("wallfWriteCaution");
    if (field && caution) window.WFGuard.watchForEdits(field, caution);
    setTimeout(() => { if (field) field.focus(); }, 120);
  }
  function closeSheets() {
    if (veil) veil.classList.remove("is-on");
    document.querySelectorAll(".wallf-sheet").forEach((s) => s.classList.remove("is-on"));
  }
  const writeBtns = document.querySelectorAll("[data-wf-write]");
  writeBtns.forEach((b) => {
    b.addEventListener("click", () => {
      if (mode === "everything") {
        const c = document.getElementById("wallfCompose");
        if (c) {
          c.classList.add("is-open");
          c.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "center" });
          const f = document.getElementById("wallfComposeField");
          if (f) f.focus();
          return;
        }
      }
      openWrite(null);
    });
  });
  const rulesBtns = document.querySelectorAll("[data-wf-rules]");
  rulesBtns.forEach((b) => {
    b.addEventListener("click", () => {
      if (veil) veil.classList.add("is-on");
      const r = document.getElementById("wallfRulesSheet");
      if (r) r.classList.add("is-on");
    });
  });
  if (veil) veil.addEventListener("click", closeSheets);
  document.body.addEventListener("click", (e) => { if (e.target.closest("[data-wf-close]")) closeSheets(); });
  const writeSend = document.getElementById("wallfWriteSend");
  if (writeSend) {
    writeSend.addEventListener("click", () => {
      const f = document.getElementById("wallfWriteField");
      const c = document.getElementById("wallfWriteCaution");
      if (!f || !f.value.trim()) { if (f) f.focus(); return; }
      const parentId = replyTo;
      guardedCompose(f, c, parentId, (post) => {
        closeSheets();
        if (mode === "field") setTimeout(() => openPanel(parentId || post.id), 380);
      });
      replyTo = null;
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (document.querySelector(".wallf-sheet.is-on")) closeSheets();
    else if (panel && panel.classList.contains("is-on")) closePanel();
    else if (mode !== "field") goTo("field");
  });

  /* ============================================================
     ONE LOOP
     ============================================================ */

  function tick() {
    const k = reduced() ? 1 : 0.09;
    lights.forEach((l) => {
      if (l.tx === undefined) { l.tx = l.fx; l.ty = l.fy; }
      l.x += (l.tx - l.x) * k;
      l.y += (l.ty - l.y) * k;
    });
    cam.x += (cam.tx - cam.x) * k;
    cam.y += (cam.ty - cam.y) * k;
    cam.s += (cam.ts - cam.s) * k;
    if (mode === "field" || morphing) drawField();

    if (mode === "conversations" && tworld) {
      if (!reduced()) { t += 0.016; drawThreads(); }
      const tk = reduced() ? 1 : 0.1;
      tcam.x += (tcam.tx - tcam.x) * tk;
      tcam.y += (tcam.ty - tcam.y) * tk;
      tcam.s += (tcam.ts - tcam.s) * tk;
      tworld.style.transform = "translate(" + tcam.x + "px," + tcam.y + "px) scale(" + tcam.s + ")";
      tworld.classList.toggle("is-far", tcam.s < 0.62);
    }
    requestAnimationFrame(tick);
  }

  /* The secondary bar (mode toggle, "Say something") docks just below the
     site's real fixed nav rather than under it. Nav height differs at the
     site's own mobile breakpoint, so this is measured, not guessed -- with a
     CSS fallback (var(--navh, 78px)) for the instant before it runs. */
  function setNavOffset() {
    const nav = document.getElementById("nav");
    if (nav) document.documentElement.style.setProperty("--navh", nav.offsetHeight + "px");
    /* The secondary bar wraps to extra rows on narrow phones (its own back
       button and mode toggle are display:none there in field mode, but
       "How this works"/"Say something" can still wrap under very narrow
       widths), so its height is not a constant either. The door's clearance
       under it was a guessed clamp() twice, wrong both times, because a
       fixed number can't track a height that changes with viewport width
       and which of the bar's buttons are showing. Measuring it is the only
       version of this that stays correct. */
    const bar = document.querySelector(".wallf-bar");
    if (bar) document.documentElement.style.setProperty("--barh", bar.offsetHeight + "px");
  }

  let rt;
  window.addEventListener("resize", () => {
    resizeCanvas();
    setNavOffset();
    clearTimeout(rt);
    rt = setTimeout(() => {
      if (cardsEl && colCount() !== cardsEl.children.length) renderEverything();
      if (mode === "conversations") fitThread();
    }, 180);
  });

  /* ------------------------------- start ------------------------------- */

  (async function start() {
    resizeCanvas();
    setNavOffset();

    // The room to resume into was already decided and stamped onto
    // <body data-wallf-mode> by the inline script at the top of body, before
    // this file even started loading -- read that back rather than deciding
    // twice, so the two can never disagree.
    const preset = document.body.getAttribute("data-wallf-mode");
    const resume = (preset === "everything" || preset === "conversations") ? preset : null;

    await load();
    renderAll();

    if (resume) {
      land(resume);
      cam.s = cam.ts = 0.62;
      cueResume();
    } else {
      cam.s = 1.5; cam.ts = 0.62;
    }
    tick();

    setInterval(async () => { if (await load()) renderAll(); }, 30000);
  })();

  function cueResume() {
    let seen;
    try { seen = store.getStr(LS_CUED); } catch (e) { seen = "1"; }
    if (seen) return;
    try { store.setStr(LS_CUED, "1"); } catch (e) {}
    const el = document.createElement("p");
    el.className = "wallf-cue";
    el.innerHTML = "Back where you left off. <b>&#8592; Entrance</b> takes you out to the field again.";
    document.body.appendChild(el);
    setTimeout(() => el.classList.add("is-on"), 60);
    setTimeout(() => el.classList.remove("is-on"), 7000);
    setTimeout(() => el.remove(), 7800);
  }
})();
