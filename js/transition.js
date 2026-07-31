/* Blob page transition — leaving only.

   Click an internal page link and a deep-violet blob swells up from the
   bottom of the screen, the wordmark surfaces, then the browser navigates;
   the next page's preloader curtain (same violet) plays the arrival. One
   organic wipe instead of a hard cut, and the two halves read as one move.

   In-page anchors keep their Lenis glide (scroll.js). Modified clicks,
   external links, downloads and mailto are left alone. Reduced motion or
   accessible mode: no overlay, instant navigation. */

(function () {
  const reduce =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.hasAttribute("data-a11y");
  if (reduce) return;

  const pt = document.createElement("div");
  pt.className = "pt";
  pt.setAttribute("aria-hidden", "true");
  pt.innerHTML = '<div class="pt__blob"></div><p class="pt__mark">wearefeminismm</p>';
  document.body.appendChild(pt);

  let leaving = false;

  document.addEventListener(
    "click",
    (e) => {
      if (leaving || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest("a[href]");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.hash) return; // in-page glide
      e.preventDefault();
      leaving = true;
      document.body.classList.add("page-exit");
      setTimeout(() => { location.href = a.href; }, 480);
    },
    true
  );

  // back/forward from bfcache restores the old page mid-blob — reset it
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) {
      leaving = false;
      document.body.classList.remove("page-exit");
    }
  });
})();
