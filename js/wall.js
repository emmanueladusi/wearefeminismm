/* The shared wall — wall.html
   ------------------------------------------------------------------------
   A feed with threaded replies, sorting, and one supportive reaction. Shaped
   after Reddit deliberately, minus the part of Reddit that ranks people
   against each other: there is no downvote and no score to lose. Posts here
   are things like "something I noticed at school this week", written by
   students aged about 13 to 19, and a button meaning "you are wrong to feel
   that" is not a thing this site should hand anybody.

   NOTHING IS PUBLIC UNTIL A HUMAN APPROVES IT. The endpoint writes every post
   as pending and only ever serves approved rows; this file cannot publish
   anything, which is the point. A writer sees their own post immediately,
   marked as waiting, held in this browser until it comes back from the feed
   approved. That way the form never appears to swallow what they wrote.

   Identity: a random device token in localStorage, used only so you can
   delete your own post and cannot support the same post twice. No name, no
   account, nothing that survives clearing your browser. */

(function () {
  // ↓↓↓ paste your deployed Apps Script /exec URL here to go live ↓↓↓
  const DATA_URL = "";

  const feedEl = document.getElementById("wallFeed");
  if (!feedEl) return;

  const form = document.getElementById("wallCompose");
  const field = document.getElementById("wallText");
  const caution = document.getElementById("wallCaution");
  const status = document.getElementById("wallStatus");
  const countEl = document.getElementById("wallCount");
  const sortEl = document.getElementById("wallSort");
  const emptyEl = document.getElementById("wallEmpty");
  const offlineEl = document.getElementById("wallOffline");

  const MAX_LEN = 1200;
  const LS_DEVICE = "wf-wall-device";
  const LS_MINE = "wf-wall-mine";     // my own posts, incl. ones still pending

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
  };

  /* A token, not an identity. It never leaves with a name attached and the
     server never returns it to anyone. Clearing your browser loses it, which
     costs you the ability to delete old posts and nothing else. */
  let device = store.get(LS_DEVICE, null);
  if (!device) {
    device = "d" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    store.set(LS_DEVICE, device);
  }

  let posts = [];        // approved, from the server
  let mine = store.get(LS_MINE, []);   // my own, including pending ones
  let supported = store.get("wf-wall-supported", []);
  let live = !!DATA_URL;

  const say = (msg) => { if (status) status.textContent = msg; };

  /* ------------------------------ transport ------------------------------
     Apps Script cannot answer a CORS preflight, so posts go out as
     text/plain. The body is still JSON; only the header is a convenience. */

  async function send(payload) {
    if (!live) return demoSend(payload);
    const res = await fetch(DATA_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(Object.assign({ device: device }, payload)),
    });
    return res.json();
  }

  async function load() {
    if (!live) { posts = demoFeed(); return true; }
    try {
      const res = await fetch(DATA_URL + "?t=" + Date.now(), { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "bad response");
      posts = data.posts || [];
      if (offlineEl) offlineEl.hidden = true;
      return true;
    } catch (e) {
      console.warn("wall: could not load", e);
      if (offlineEl) offlineEl.hidden = false;
      return false;
    }
  }

  /* ------------------------------ demo store ------------------------------
     With no endpoint deployed the page still has to be usable and honest, so
     it runs against this browser only and SAYS SO on screen. Nothing here is
     shared with anyone; it exists so the wall can be looked at and clicked
     through before the backend is wired. */

  const LS_DEMO = "wf-wall-demo";
  function demoFeed() {
    return store.get(LS_DEMO, []).filter((p) => p.status === "approved");
  }
  function demoSend(payload) {
    const all = store.get(LS_DEMO, []);
    if (payload.action === "post") {
      const p = {
        id: "x" + Math.random().toString(36).slice(2, 10),
        parentId: payload.parentId || "",
        at: new Date().toISOString(),
        body: payload.body,
        support: 0,
        status: "pending",     // same rule as the real thing: never auto-public
        device: device,
      };
      all.push(p);
      store.set(LS_DEMO, all);
      return Promise.resolve({ ok: true, pending: true, post: p });
    }
    if (payload.action === "support") {
      const p = all.find((x) => x.id === payload.id);
      if (p) { p.support = (p.support || 0) + 1; store.set(LS_DEMO, all); }
      return Promise.resolve({ ok: true, support: p ? p.support : 0 });
    }
    if (payload.action === "remove") {
      const p = all.find((x) => x.id === payload.id);
      if (p) { p.status = "removed"; store.set(LS_DEMO, all); }
      return Promise.resolve({ ok: true });
    }
    return Promise.resolve({ ok: true });
  }

  /* ------------------------------- render ------------------------------- */

  function when(iso) {
    const t = new Date(iso).getTime();
    if (!t) return "";
    const mins = Math.floor((Date.now() - t) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + (mins === 1 ? " minute ago" : " minutes ago");
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + (hrs === 1 ? " hour ago" : " hours ago");
    const days = Math.floor(hrs / 24);
    if (days < 30) return days + (days === 1 ? " day ago" : " days ago");
    return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  }

  // approved posts from the server, plus my own pending ones, deduped by id
  function everything() {
    const byId = new Map();
    posts.forEach((p) => byId.set(p.id, Object.assign({ status: "approved" }, p)));
    mine.forEach((p) => { if (!byId.has(p.id) && p.status !== "removed") byId.set(p.id, p); });
    return [...byId.values()];
  }

  /* A reply to a reply is still a reply to the post.

     Threads here indent once and only once, so a grandchild had nowhere to
     render: every reply card carries its own Reply button, but only top-level
     posts were given children. Anything written into a reply's reply was
     sent, stored, and then drawn NOWHERE, while the status line said "Sent."
     Not even its own author could see it.

     So a reply is reparented to its top-level ancestor. It happens at submit
     AND at render, because the second one is what rescues rows already sitting
     in a sheet from before this fix. */
  function rootOf(id, byId) {
    let cur = byId.get(id);
    const guard = new Set();          // a malformed cycle must not hang the page
    while (cur && cur.parentId && !guard.has(cur.id)) {
      guard.add(cur.id);
      const up = byId.get(cur.parentId);
      if (!up) break;                 // parent was removed: treat this as the root
      cur = up;
    }
    return cur ? cur.id : "";
  }

  function sortTop(list) {
    const how = sortEl ? sortEl.value : "new";
    const copy = list.slice();
    if (how === "supported") {
      copy.sort((a, b) => (b.support || 0) - (a.support || 0) ||
                          new Date(b.at) - new Date(a.at));
    } else {
      copy.sort((a, b) => new Date(b.at) - new Date(a.at));
    }
    return copy;
  }

  function postHTML(p, replies) {
    const isMine = mine.some((m) => m.id === p.id);
    const pending = p.status === "pending";
    const didSupport = supported.indexOf(p.id) !== -1;

    return (
      '<li class="wpost' + (pending ? " wpost--pending" : "") + '" data-id="' + esc(p.id) + '">' +
      (pending
        ? '<p class="wpost__flag">Waiting to be approved. Only you can see this.</p>'
        : "") +
      '<p class="wpost__body">' + esc(p.body).replace(/\n+/g, "<br>") + "</p>" +
      '<div class="wpost__foot">' +
      '<span class="wpost__when">' + esc(when(p.at)) + "</span>" +
      (pending ? "" :
        '<button class="wact wact--support' + (didSupport ? " is-on" : "") +
        '" type="button" data-support="' + esc(p.id) + '"' + (didSupport ? " disabled" : "") + ">" +
        '<span aria-hidden="true">♡</span> <span class="wact__n">' + (p.support || 0) + "</span>" +
        '<span class="visually-hidden"> people found this helpful. Mark as helpful</span></button>' +
        '<button class="wact" type="button" data-reply="' + esc(p.id) + '">Reply' +
        (replies.length ? ' <span class="wact__n">' + replies.length + "</span>" : "") + "</button>") +
      (isMine ? '<button class="wact wact--quiet" type="button" data-remove="' + esc(p.id) + '">Take it down</button>' : "") +
      (pending || isMine ? "" :
        '<button class="wact wact--quiet" type="button" data-report="' + esc(p.id) + '">Report</button>') +
      "</div>" +
      '<div class="wreply" data-replybox="' + esc(p.id) + '" hidden></div>' +
      (replies.length
        ? '<ul class="wthread">' + replies.map((r) => postHTML(r, [])).join("") + "</ul>"
        : "") +
      "</li>"
    );
  }

  function render() {
    const all = everything();
    const byId = new Map(all.map((p) => [p.id, p]));
    const tops = sortTop(all.filter((p) => !p.parentId));
    // grouped by top-level ancestor, so a reply-to-a-reply still surfaces
    const kids = (id) =>
      all
        .filter((p) => p.parentId && rootOf(p.parentId, byId) === id)
        .sort((a, b) => new Date(a.at) - new Date(b.at));

    feedEl.innerHTML = tops.map((p) => postHTML(p, kids(p.id))).join("");

    if (emptyEl) emptyEl.hidden = tops.length !== 0;
    if (countEl) {
      const n = all.filter((p) => p.status === "approved").length;
      countEl.textContent = n === 1 ? "1 post" : n + " posts";
    }
  }

  /* ------------------------------ actions ------------------------------ */

  function rememberMine(p) {
    mine.push(p);
    if (mine.length > 200) mine = mine.slice(-200);
    store.set(LS_MINE, mine);
  }

  async function submit(text, parentId, cautionEl, fieldEl) {
    if (text.length > MAX_LEN) { say("That is longer than the wall accepts."); return; }
    // send it against the top-level post, never against another reply
    let target = "";
    if (parentId) {
      const byId = new Map(everything().map((p) => [p.id, p]));
      target = rootOf(parentId, byId) || parentId;
    }
    say("Sending…");
    let res;
    try { res = await send({ action: "post", body: text, parentId: target }); }
    catch (e) { say("Could not send that. Check your connection and try again."); return; }

    if (!res.ok) {
      say(res.error === "slow down"
        ? "Give it " + (res.retryIn || 20) + " seconds before posting again."
        : "That did not send. Try again in a moment.");
      return;
    }
    rememberMine(Object.assign({ status: "pending" }, res.post));
    fieldEl.value = "";
    if (cautionEl) { cautionEl.hidden = true; cautionEl.dataset.armed = "false"; }
    render();
    say("Sent. It will appear on the wall once it has been approved.");
  }

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      window.WFGuard.guardedSubmit(field, caution, (text) => submit(text, "", caution, field));
    });
    window.WFGuard.watchForEdits(field, caution);
  }

  feedEl.addEventListener("click", async (e) => {
    const sup = e.target.closest("[data-support]");
    if (sup) {
      const id = sup.getAttribute("data-support");
      if (supported.indexOf(id) !== -1) return;
      supported.push(id);
      store.set("wf-wall-supported", supported);
      const p = posts.find((x) => x.id === id);
      if (p) p.support = (p.support || 0) + 1;
      render();
      try { await send({ action: "support", id: id }); } catch (err) {}
      say("Marked as helpful.");
      return;
    }

    const rep = e.target.closest("[data-reply]");
    if (rep) { openReply(rep.getAttribute("data-reply")); return; }

    const rem = e.target.closest("[data-remove]");
    if (rem) {
      const id = rem.getAttribute("data-remove");
      mine = mine.filter((m) => m.id !== id);
      store.set(LS_MINE, mine);
      posts = posts.filter((p) => p.id !== id);
      render();
      try { await send({ action: "remove", id: id }); } catch (err) {}
      say("Taken down.");
      return;
    }

    const rpt = e.target.closest("[data-report]");
    if (rpt) {
      const id = rpt.getAttribute("data-report");
      posts = posts.filter((p) => p.id !== id);   // out of your sight at once
      render();
      try { await send({ action: "report", id: id }); } catch (err) {}
      say("Reported, and hidden from the wall until someone reviews it.");
      return;
    }
  });

  /* one reply box open at a time: several half-written replies down a thread
     is how you lose the one you meant to send */
  function openReply(id) {
    feedEl.querySelectorAll("[data-replybox]").forEach((b) => {
      if (b.getAttribute("data-replybox") !== id) { b.hidden = true; b.innerHTML = ""; }
    });
    const box = feedEl.querySelector('[data-replybox="' + CSS.escape(id) + '"]');
    if (!box) return;
    if (!box.hidden) { box.hidden = true; box.innerHTML = ""; return; }

    box.hidden = false;
    box.innerHTML =
      '<form class="wreply__form">' +
      '<label class="visually-hidden" for="r-' + esc(id) + '">Write a reply</label>' +
      '<textarea id="r-' + esc(id) + '" class="wreply__field" rows="3" maxlength="' + MAX_LEN +
      '" placeholder="Say something to them."></textarea>' +
      '<p class="caution" role="status" hidden></p>' +
      '<div class="wreply__actions">' +
      '<button class="cta cta--quiet" type="button" data-cancel>Cancel</button>' +
      '<button class="cta" type="submit">Reply</button>' +
      "</div></form>";

    const f = box.querySelector("textarea");
    const c = box.querySelector(".caution");
    window.WFGuard.watchForEdits(f, c);
    f.focus();

    box.querySelector("[data-cancel]").addEventListener("click", () => {
      box.hidden = true; box.innerHTML = "";
    });
    box.querySelector("form").addEventListener("submit", (ev) => {
      ev.preventDefault();
      window.WFGuard.guardedSubmit(f, c, (text) => submit(text, id, c, f));
    });
  }

  if (sortEl) sortEl.addEventListener("change", render);

  /* ------------------------------- start ------------------------------- */

  (async function start() {
    if (!live && offlineEl) {
      offlineEl.hidden = false;
      offlineEl.querySelector("[data-offline-msg]").textContent =
        "This wall has no server yet, so nothing here is shared: posts stay in this browser only. " +
        "It is here so the page can be tried out before it is connected.";
    }
    await load();
    render();
    if (live) setInterval(async () => { if (await load()) render(); }, 30000);
  })();
})();
