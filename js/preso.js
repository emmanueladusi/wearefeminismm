/* PRESO — scroll-driven kinetic-typography slideshow on Home.
   ------------------------------------------------------------------
   The .preso section is tall (one viewport of scroll per scene) with a
   position:sticky stage, so it pins while you scroll through it. This
   script maps scroll progress → the active scene, so the story can't be
   scrolled past and missed, and the viewer sets the pace. No timers.

   Each time a new scene becomes active its entrance animation is
   re-triggered (reflow), so scrolling back up replays it too. Runs on a
   rAF-throttled scroll listener; degrades cleanly (sticky + scene 1 show
   even if this never runs). Photos: edit the PHOTOS map below. */

(function () {
  const root = document.getElementById("preso");
  if (!root) return;
  const scenes = Array.from(root.querySelectorAll(".scene"));
  if (!scenes.length) return;

  root.style.setProperty("--scenes", scenes.length); // one viewport per scene

  /* ---------- photos (swap these for real shots) ---------- */
  const PHOTOS = {
    vancouver: "img/preso/vancouver-1.jpg?v=1",   // skyline — inside the VANCOUVER letters
    moment: "img/preso/vancouver-2.jpg?v=1",      // the SFU handshake
    ypar: "img/preso/ypar-stage.jpg?v=1",         // on stage at YPAR — the "Findings" slide
    team: "img/preso/team.jpg?v=1",               // the team at the "ready · unconventional · fearless" wall
    room: "img/preso/room.jpg?v=1",               // spoken-word under the spotlight
    stage: null,                                  // still awaiting the "Background Information" export

  };
  function placeholder(label) {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#4a3568"/><stop offset=".55" stop-color="#a8459e"/>' +
      '<stop offset="1" stop-color="#d9a13f"/></linearGradient></defs>' +
      '<rect width="900" height="1200" fill="url(#g)"/>' +
      '<text x="450" y="600" fill="rgba(250,246,239,.85)" font-family="monospace" font-size="44" text-anchor="middle" letter-spacing="6">' +
      label.toUpperCase() + "</text>" +
      '<text x="450" y="660" fill="rgba(250,246,239,.55)" font-family="monospace" font-size="26" text-anchor="middle" letter-spacing="4">drop photo here</text>' +
      "</svg>";
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }
  root.querySelectorAll("[data-photo]").forEach((el) => {
    const key = el.dataset.photo;
    el.style.backgroundImage = "url('" + (PHOTOS[key] || placeholder(key)) + "')";
  });

  /* ---------- scene selection by scroll ---------- */
  const hudIdx = root.querySelector("#presoIdx");
  const hudFill = root.querySelector("#presoFill");
  const pad = (n) => String(n + 1).padStart(2, "0");
  let cur = -1;

  function activate(i) {
    if (i === cur) return;
    cur = i;
    scenes.forEach((s, k) => {
      if (k === i) {
        // re-trigger the entrance animation so every arrival plays it
        s.classList.remove("is-on"); void s.offsetWidth; s.classList.add("is-on");
      } else {
        s.classList.remove("is-on");
      }
    });
    if (hudIdx) hudIdx.textContent = pad(i) + " / " + pad(scenes.length - 1);
  }

  function measure() {
    const rect = root.getBoundingClientRect();
    const total = root.offsetHeight - window.innerHeight;      // scrollable distance while pinned
    const scrolled = Math.min(Math.max(-rect.top, 0), Math.max(total, 1));
    const p = total > 0 ? scrolled / total : 0;
    const idx = Math.min(scenes.length - 1, Math.floor(p * scenes.length));
    activate(idx);
    if (hudFill) hudFill.style.width = (p * 100).toFixed(1) + "%";
  }

  let ticking = false;
  function schedule() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { measure(); ticking = false; });
  }
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  // Lenis scrolls natively, so the window 'scroll' event already fires;
  // this is just a belt-and-suspenders hook if a Lenis instance is exposed.
  if (window.lenis && typeof window.lenis.on === "function") window.lenis.on("scroll", schedule);

  measure(); // set the opening state
})();
