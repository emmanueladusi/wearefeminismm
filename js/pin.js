/* Pinned scenes — the real "journey, not a scroll".

   Each narrative section (data-pin) is pinned to the viewport by GSAP
   ScrollTrigger: it holds DEAD STILL while you scroll, so the page stops
   appearing to travel, then recedes + dissolves into the next held frame.
   Combined with the continuous colour morph behind it, the spine of the site
   reads as a sequence of frames you move THROUGH, not a page you scroll down.

   Two kinds of pinned scene:
     • plain (hero): a slow dolly through the frame, then an exit dissolve.
     • step slide (data-steps="SEL"): the section is sized to one screen
       (.pin-slide) and its matched items are revealed ONE AT A TIME as you
       scroll through the hold, then the whole frame dissolves. This is how the
       tall editorial sections (paths, grounding) become held frames without
       stranding content — you scroll and the items arrive, the page itself
       staying still.

   The Wall and Pulse stay on native scroll so their form and poll remain fully
   usable. #ask, #pillars and #mission pin themselves elsewhere.

   Skipped on narrow screens and under prefers-reduced-motion. A plain scene
   taller than the viewport is left unpinned so nothing is stranded. */

(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const narrow = window.matchMedia("(max-width: 860px)").matches;
  if (reduce || narrow) return;
  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;

  gsap.registerPlugin(ScrollTrigger);

  const HOLD = "+=85%"; // scroll distance each frame is held before handing off

  document.querySelectorAll("[data-pin]").forEach((sec) => {
    const steps = sec.dataset.steps ? Array.from(sec.querySelectorAll(sec.dataset.steps)) : null;
    const isSlide = steps && steps.length;

    // plain scenes must already fit a screen; step-slides are forced to fit
    // via .pin-slide, so they're allowed even when their natural height is tall.
    if (!isSlide && sec.scrollHeight > window.innerHeight * 1.2) return;

    sec.style.transformOrigin = "center center";
    if (isSlide) sec.classList.add("pin-slide");

    const content = Array.from(sec.children).filter(
      (el) => el.tagName !== "CANVAS" && el.tagName !== "SVG"
    );

    ScrollTrigger.create({
      trigger: sec,
      start: "top top",
      end: HOLD,
      pin: true,
      pinType: "fixed",
      pinSpacing: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    });

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: { trigger: sec, start: "top top", end: HOLD, scrub: 0.5 },
    });

    if (isSlide) {
      // reveal each item in turn as you scroll through the hold. Items start
      // hidden; the non-step content (eyebrow, help line) stays visible as the
      // anchor of the frame.
      const span = 0.62 / steps.length;      // reveals occupy the first ~60%
      steps.forEach((el, i) => {
        tl.fromTo(
          el,
          { opacity: 0, y: 46, filter: "blur(7px)" },
          { opacity: 1, y: 0, filter: "blur(0px)", ease: "power2.out", duration: span * 0.9 },
          0.06 + i * span
        );
      });
      // then the whole frame recedes + dissolves into the next
      tl.to(content, { yPercent: -12, opacity: 0, filter: "blur(8px)", stagger: 0.04, duration: 0.28 }, 0.78);
    } else {
      // plain scene: constant dolly through the frame, then exit dissolve.
      tl.fromTo(sec, { scale: 1.04 }, { scale: 0.96 }, 0);
      tl.to(content, { yPercent: -14, opacity: 0, filter: "blur(7px)", stagger: 0.05, duration: 0.34 }, 0.66);
    }
  });

  // let pins settle the layout, then re-measure everything (incl. the colour
  // morph's offsets) against the new pin spacers.
  ScrollTrigger.refresh();
})();
