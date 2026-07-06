/* Pillars deck — ported from the uploaded ExpertiseCards demo.
   Section pins for 3 viewport heights:
     Phase 1 (first third): stacked deck fans out to four positions.
     Phase 2 (staggered middle): each card flips on the Y axis to
     reveal its back, straightening as it turns.
   Scrubbed by scroll via GSAP ScrollTrigger, riding the Lenis glide.

   Reduced motion / no GSAP: section becomes a static fanned grid
   showing the informative back faces. */

(function () {
  const section = document.getElementById("pillars");
  if (!section) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const narrow = window.innerWidth < 720; // fan positions overflow on phones

  if (narrow || reduceMotion || typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") {
    section.classList.add("ec-static");
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  const cards = gsap.utils.toArray(".ec-card");
  const positions = [14, 38, 62, 86];
  const rotations = [-15, -7.5, 7.5, 15];
  const totalScrollHeight = () => window.innerHeight * 3;

  ScrollTrigger.create({
    trigger: section,
    start: "top top",
    end: () => `+=${totalScrollHeight()}`,
    pin: true,
    pinType: "fixed",
    anticipatePin: 1,
    pinSpacing: true,
  });

  // Phase 1: fan the deck out
  cards.forEach((card, i) => {
    gsap.to(card, {
      left: `${positions[i]}%`,
      rotation: rotations[i],
      ease: "none",
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: () => `+=${window.innerHeight}`,
        scrub: 0.5,
      },
    });
  });

  // Phase 2: staggered flip
  cards.forEach((card, i) => {
    const frontEl = card.querySelector(".ec-card-front");
    const backEl = card.querySelector(".ec-card-back");
    const staggerOffset = i * 0.05;
    const startOffset = 1 / 3 + staggerOffset;
    const endOffset = 2 / 3 + staggerOffset;

    ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: () => `+=${totalScrollHeight()}`,
      scrub: 1,
      onUpdate: (self) => {
        // clamp so fast scrolls can't strand a card mid-flip
        const p = Math.max(0, Math.min(1, (self.progress - startOffset) / (1 / 3)));
        frontEl.style.transform = `rotateY(${-180 * p}deg)`;
        backEl.style.transform = `rotateY(${180 - 180 * p}deg)`;
        // phase 1's fan tween owns the card transform until the flip window opens
        if (self.progress >= startOffset) {
          card.style.transform = `translate(-50%, -50%) rotate(${rotations[i] * (1 - p)}deg)`;
        }
      },
    });
  });
})();
