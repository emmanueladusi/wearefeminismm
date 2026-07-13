/* Pillars deck — plain static grid, no pin/fan/flip choreography.
   (Previously a scroll-pinned fan-and-flip deck; retired in favor of a
   straight-to-the-text layout. See css/styles.css .ec-static rules.) */

(function () {
  const section = document.getElementById("pillars");
  if (!section) return;
  section.classList.add("ec-static");
})();
