/* Prototype chrome shared by all five wall directions.
   Builds the switcher bar so the five can be compared in one click, and
   provides the small helpers each direction needs (time-ago, escaping, a
   local store so posting actually does something). None of this is meant to
   ship: it is here so the designs can be judged on feel, not on plumbing. */
(function () {
  var PROTOS = [
    { file: "a-pinwall.html",  n: "A", name: "Pin Wall" },
    { file: "b-nightfield.html", n: "B", name: "Night Field" },
    { file: "c-letters.html",  n: "C", name: "Letters" },
    { file: "d-chamber.html",  n: "D", name: "Chamber" },
    { file: "e-thread.html",   n: "E", name: "Thread" },
    { file: "f-combined.html", n: "F", name: "Combined" },
  ];

  function here() {
    var p = location.pathname.split("/").pop();
    return p || "index.html";
  }

  /* Prototype chrome, not design. Deliberately styled like the switcher bar
     rather than like the wall it sits on, so it never gets mistaken for part
     of the thing being judged. */
  function buildHint() {
    if (here() === "index.html") return;
    try { if (sessionStorage.getItem("wf-proto-hint") === "off") return; } catch (e) {}
    var h = document.createElement("div");
    h.className = "protohint";
    h.innerHTML =
      "<span><b>Try it:</b> write something, then hit <b>Approve it</b> on your own note to " +
      "watch it land on the wall. Answer any post to see how a thread reads.</span>" +
      '<button type="button" aria-label="Hide this note">&#10005;</button>';
    h.querySelector("button").addEventListener("click", function () {
      h.remove();
      try { sessionStorage.setItem("wf-proto-hint", "off"); } catch (e) {}
    });
    document.body.appendChild(h);
  }

  function buildBar() {
    buildHint();
    var bar = document.createElement("div");
    bar.className = "protobar";
    bar.innerHTML =
      '<a class="protobar__home" href="index.html">Five walls</a>' +
      '<div class="protobar__set">' +
      PROTOS.map(function (p) {
        var on = p.file === here();
        return '<a class="protobar__item' + (on ? " is-on" : "") + '" href="' + p.file + '"' +
          (on ? ' aria-current="page"' : "") + '><b>' + p.n + '</b> ' + p.name + "</a>";
      }).join("") +
      "</div>" +
      '<span class="protobar__tag">prototype</span>';
    document.body.appendChild(bar);
  }

  var css = document.createElement("style");
  css.textContent =
    ".protobar{position:fixed;left:50%;transform:translateX(-50%);bottom:14px;z-index:9999;" +
    "display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:999px;" +
    "background:rgba(24,16,14,.86);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);" +
    "box-shadow:0 12px 40px rgba(0,0,0,.4),0 0 0 1px rgba(255,255,255,.09) inset;" +
    "font:500 12px/1 -apple-system,BlinkMacSystemFont,'SF Pro Text',Helvetica,Arial,sans-serif;" +
    "max-width:calc(100vw - 24px);overflow-x:auto;scrollbar-width:none}" +
    ".protobar::-webkit-scrollbar{display:none}" +
    ".protobar__set{display:flex;gap:2px}" +
    ".protobar__home{color:#e9dedb;text-decoration:none;padding:7px 10px;border-radius:999px;white-space:nowrap;opacity:.72}" +
    ".protobar__home:hover{opacity:1;background:rgba(255,255,255,.08)}" +
    ".protobar__item{color:#e9dedb;text-decoration:none;padding:7px 11px;border-radius:999px;white-space:nowrap;opacity:.7;transition:background .18s,opacity .18s}" +
    ".protobar__item b{font-weight:700;opacity:.55;margin-right:3px}" +
    ".protobar__item:hover{opacity:1;background:rgba(255,255,255,.08)}" +
    ".protobar__item.is-on{opacity:1;background:#ea7393;color:#2a1c18}" +
    ".protobar__item.is-on b{opacity:.6}" +
    ".protobar__tag{color:#e9dedb;opacity:.35;padding:0 8px 0 4px;letter-spacing:.08em;text-transform:uppercase;font-size:10px;white-space:nowrap}" +
    "@media (max-width:620px){.protobar__tag,.protobar__home{display:none}}" +
    ".protohint{position:fixed;left:50%;transform:translateX(-50%);bottom:66px;z-index:9998;" +
    "display:flex;align-items:center;gap:10px;padding:11px 8px 11px 16px;border-radius:14px;" +
    "background:rgba(24,16,14,.86);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);" +
    "box-shadow:0 12px 40px rgba(0,0,0,.4),0 0 0 1px rgba(255,255,255,.09) inset;color:#e9dedb;" +
    "font:400 12.5px/1.5 -apple-system,BlinkMacSystemFont,'SF Pro Text',Helvetica,Arial,sans-serif;" +
    "max-width:calc(100vw - 24px);width:max-content}" +
    ".protohint b{font-weight:600;color:#fff}" +
    ".protohint button{border:0;background:rgba(255,255,255,.08);color:#e9dedb;width:26px;height:26px;" +
    "border-radius:50%;cursor:pointer;font-size:12px;line-height:1;flex:none}" +
    ".protohint button:hover{background:rgba(255,255,255,.2)}" +
    "@media (max-width:720px){.protohint{bottom:62px;font-size:11.5px;max-width:calc(100vw - 20px)}}";
  document.head.appendChild(css);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", buildBar);
  else buildBar();

  /* ------------------------------ helpers ------------------------------ */

  window.WP = {
    esc: function (s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    },
    // minutes ago -> the phrasing the real wall uses
    ago: function (mins) {
      if (mins < 1) return "just now";
      if (mins < 60) return mins + (mins === 1 ? " minute ago" : " minutes ago");
      var h = Math.floor(mins / 60);
      if (h < 24) return h + (h === 1 ? " hour ago" : " hours ago");
      var d = Math.floor(h / 24);
      return d + (d === 1 ? " day ago" : " days ago");
    },
    // deterministic pseudo-random from a string, so card angles never reshuffle
    seedRand: function (str) {
      var h = 2166136261;
      for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
      return ((h >>> 0) % 10000) / 10000;
    },
    reduced: function () {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    },
    /* Every prototype shares this: your own post appears at once, marked as
       waiting, and never counts as public. That rule is the wall, not a
       detail, so each direction has to show it somehow. */
    makePost: function (body, parentId) {
      return {
        id: "m" + Math.random().toString(36).slice(2, 8),
        parentId: parentId || "",
        ago: 0, support: 0, body: body, mine: true, pending: true,
      };
    },
  };
})();
