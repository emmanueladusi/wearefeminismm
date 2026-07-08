/* Site-wide smooth scrolling — the Lusion/Oryzo glide.

   Lenis interpolates the window's scroll position, so every existing
   scroll-driven effect (progress line, reveals, mission flythrough,
   wall parallax) keeps working — they all read window.scrollY, which
   Lenis still drives. ScrollTrigger is kept in sync for the pinned
   card deck. Anchor links route through lenis.scrollTo so in-page
   navigation glides too.

   Skipped entirely under prefers-reduced-motion (native scroll). */

(function () {
  // always begin at the top — browser scroll-restore lands mid-page after a
  // reload, which desyncs the pinned scenes (they'd stick at opacity 0).
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.scrollTo(0, 0);
  window.addEventListener("load", () => window.scrollTo(0, 0));

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || typeof Lenis === "undefined") return;

  const lenis = new Lenis({
    duration: 1.5,          // heavier glide — the page eases in like a journey, not clicks down
    smoothWheel: true,
    wheelMultiplier: 0.9,   // a touch slower per notch so travel feels deliberate
    touchMultiplier: 1.4,
  });

  if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    // pins measure the page after Lenis owns scrolling; refresh once ready
    requestAnimationFrame(() => ScrollTrigger.refresh());
  } else {
    // fallback ticker if GSAP failed to load
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  }

  // glide to in-page anchors instead of jumping
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const target = document.querySelector(a.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: 0 });
    });
  });

  window.__lenis = lenis;
})();
