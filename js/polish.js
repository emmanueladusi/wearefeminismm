/* Polish layer — preloader, custom cursor, magnetic elements.
   All fine-pointer effects are skipped on touch devices and
   under prefers-reduced-motion. */

(function () {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* =====================================================
     Preloader — counter climbs while assets load, then the
     violet curtain lifts and the hero reveal begins.
     ===================================================== */
  (function preloader() {
    const pre = document.getElementById("preloader");
    if (!pre) return;

    // Only run the intro curtain on the first page of a visit. On later
    // navigations within the same session (switching Home/Learn/…), drop
    // straight into the page instead of replaying the loader every time.
    let visited = false;
    try {
      visited = !!sessionStorage.getItem("wf_visited");
      sessionStorage.setItem("wf_visited", "1");
    } catch (e) {}
    if (visited) {
      pre.remove();
      document.body.classList.remove("is-loading");
      return;
    }

    if (reduceMotion) {
      pre.remove();
      document.body.classList.remove("is-loading");
      return;
    }

    const countEl = document.getElementById("preCount");
    const barEl = document.getElementById("preBar");
    let progress = 0;
    let loaded = document.readyState === "complete";
    let done = false;

    window.addEventListener("load", () => (loaded = true));

    function finish() {
      if (done) return;
      done = true;
      countEl.textContent = "100";
      barEl.style.transform = "scaleX(1)";
      setTimeout(() => {
        pre.classList.add("is-done");
        document.body.classList.remove("is-loading"); // hero lines start now
        setTimeout(() => pre.remove(), 1000);
      }, 250);
    }

    const tick = setInterval(() => {
      // creep toward 92 while loading, sprint to 100 once loaded
      const target = loaded ? 100 : 92;
      progress = Math.min(target, progress + (loaded ? 6 : 1.4 + Math.random() * 2));
      countEl.textContent = String(Math.floor(progress));
      barEl.style.transform = `scaleX(${progress / 100})`;
      if (progress >= 100) {
        clearInterval(tick);
        finish();
      }
    }, 30);

    setTimeout(finish, 4500); // never trap anyone behind the curtain
  })();

  /* =====================================================
     Custom cursor — gold dot tracks instantly, ring lerps
     behind it and swells over anything interactive.
     ===================================================== */
  (function cursor() {
    if (reduceMotion || !finePointer) return;
    const dot = document.getElementById("cursorDot");
    const ring = document.getElementById("cursorRing");
    if (!dot || !ring) return;

    document.body.classList.add("has-cursor");

    const HOVERABLE =
      "a, button, .pathway, .pulse__option, .post__action, [data-magnetic]";
    let x = innerWidth / 2, y = innerHeight / 2;
    let rx = x, ry = y;
    let seen = false;

    window.addEventListener(
      "mousemove",
      (e) => {
        x = e.clientX;
        y = e.clientY;
        if (!seen) {
          seen = true;
          rx = x; ry = y;
          dot.style.opacity = "1";
          ring.style.opacity = "1";
        }
        ring.classList.toggle("is-hover", !!e.target.closest(HOVERABLE));
        const onText = e.target.closest("input, textarea");
        dot.style.opacity = onText ? "0" : "1";
        ring.style.opacity = onText ? "0" : "1";
      },
      { passive: true }
    );

    window.addEventListener("mousedown", () => ring.classList.add("is-down"));
    window.addEventListener("mouseup", () => ring.classList.remove("is-down"));
    document.documentElement.addEventListener("mouseleave", () => {
      dot.style.opacity = "0";
      ring.style.opacity = "0";
    });

    (function trail() {
      rx += (x - rx) * 0.16;
      ry += (y - ry) * 0.16;
      dot.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;
      requestAnimationFrame(trail);
    })();
  })();

  /* =====================================================
     Magnetic elements — nav links, CTAs and buttons lean
     toward the cursor and spring back on leave.
     ===================================================== */
  (function magnetic() {
    if (reduceMotion || !finePointer) return;

    document.querySelectorAll("[data-magnetic]").forEach((el) => {
      // Top-nav items stay perfectly aligned — the magnetic pull would nudge
      // each one toward the cursor by a different amount and make the evenly
      // spaced links look unevenly spaced.
      if (el.closest(".nav")) return;
      const strength = el.classList.contains("btn") ? 0.38 : 0.28;

      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const mx = (e.clientX - r.left - r.width / 2) * strength;
        const my = (e.clientY - r.top - r.height / 2) * strength;
        el.style.transition = "transform 0.12s ease-out";
        el.style.transform = `translate(${mx}px, ${my}px)`;
      });

      el.addEventListener("mouseleave", () => {
        el.style.transition = "transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)";
        el.style.transform = "";
      });
    });
  })();
})();
