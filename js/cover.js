/* The gallery holds while #about rises over it.

   One measurement, not a scroll loop. A sticky section that is TALLER than the
   viewport has to be offset by (viewportHeight - itsOwnHeight) for its bottom
   edge to be what stays on screen, and CSS has no way to say "minus my own
   height". So this writes that one number into --hold on .cover-stack and gets
   out of the way. Nothing here runs on scroll; the hold itself is done by the
   compositor via position: sticky.

   The custom property is set on .cover-stack rather than :root deliberately:
   an inherited custom property on an ancestor invalidates style for its whole
   subtree, and there is no reason for that subtree to be the entire page. */
(function () {
  var stack = document.querySelector(".cover-stack");
  if (!stack) return;
  var section = stack.querySelector(".popculture");
  if (!section) return;

  function measure() {
    stack.style.setProperty("--hold", (window.innerHeight - section.offsetHeight) + "px");
  }

  measure();
  window.addEventListener("resize", measure, { passive: true });
  // fonts and lazy images change the section's height after first paint
  window.addEventListener("load", measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
})();
