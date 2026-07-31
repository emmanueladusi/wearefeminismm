/* Shared UI behaviour for the redesigned pages.

   Three small things, all progressive enhancement: the page works with
   this file missing (accordions render open, nav links are plain anchors).

   1. Accordions  — [data-acc] wraps [data-acc-btn]/[data-acc-panel] pairs.
   2. Knowledge checks — [data-kc] question blocks with written feedback
      into an aria-live region. Never colour alone: every verdict is a word.
   3. Section nav — [data-secnav] highlights the section you are in, and
      opens + scrolls to a module when you arrive on a URL hash.

   Reduced motion is respected by using instant scroll positioning. */

(function () {
  const reduce =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.hasAttribute("data-a11y");

  /* ---------------- accordions ---------------- */

  function panelFor(btn) {
    return document.getElementById(btn.getAttribute("aria-controls"));
  }

  function setOpen(btn, open) {
    const panel = panelFor(btn);
    if (!panel) return;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    panel.hidden = !open;
  }

  function initAcc(root) {
    const btns = [...root.querySelectorAll("[data-acc-btn]")];
    const single = root.hasAttribute("data-acc-single");

    btns.forEach((btn) => {
      // start closed unless the markup asked otherwise
      setOpen(btn, btn.getAttribute("aria-expanded") === "true");

      btn.addEventListener("click", () => {
        const willOpen = btn.getAttribute("aria-expanded") !== "true";
        if (single && willOpen) btns.forEach((b) => b !== btn && setOpen(b, false));
        setOpen(btn, willOpen);
      });

      // roving arrow keys between headers, like a real disclosure list
      btn.addEventListener("keydown", (e) => {
        const i = btns.indexOf(btn);
        let next = null;
        if (e.key === "ArrowDown") next = btns[(i + 1) % btns.length];
        else if (e.key === "ArrowUp") next = btns[(i - 1 + btns.length) % btns.length];
        else if (e.key === "Home") next = btns[0];
        else if (e.key === "End") next = btns[btns.length - 1];
        if (next) { e.preventDefault(); next.focus(); }
      });
    });
  }

  document.querySelectorAll("[data-acc]").forEach(initAcc);

  /* open a module from anywhere (dashboard cards, in-page links) */
  function openTarget(id, focus) {
    const panel = document.getElementById(id);
    if (!panel) return false;
    const btn = document.querySelector('[aria-controls="' + id + '"]');
    if (btn) {
      const root = btn.closest("[data-acc]");
      if (root && root.hasAttribute("data-acc-single")) {
        root.querySelectorAll("[data-acc-btn]").forEach((b) => b !== btn && setOpen(b, false));
      }
      setOpen(btn, true);
      const top = btn.getBoundingClientRect().top + window.scrollY - 96;
      if (window.__lenis && !reduce) window.__lenis.scrollTo(top);
      else window.scrollTo({ top: top, behavior: reduce ? "auto" : "smooth" });
      if (focus) btn.focus({ preventScroll: true });
      return true;
    }
    return false;
  }
  window.__openModule = openTarget;

  document.querySelectorAll("[data-opens]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      openTarget(el.getAttribute("data-opens"), true);
    });
  });

  /* arriving on a hash that points at a closed panel: open it.
     Runs after load so layout has settled. */
  function fromHash() {
    const h = decodeURIComponent(location.hash.replace("#", ""));
    if (h) openTarget(h, false);
  }
  window.addEventListener("hashchange", fromHash);
  window.addEventListener("load", () => setTimeout(fromHash, 120));

  /* ---------------- knowledge checks ---------------- */

  document.querySelectorAll("[data-kc]").forEach((kc) => {
    const fb = kc.querySelector("[data-kc-fb]");
    const opts = [...kc.querySelectorAll("[data-kc-opt]")];

    opts.forEach((opt) => {
      opt.addEventListener("click", () => {
        const right = opt.getAttribute("data-kc-opt") === "correct";
        opts.forEach((o) => o.setAttribute("aria-pressed", o === opt ? "true" : "false"));
        if (!fb) return;
        // word first, then the explanation — colour is never the only signal
        fb.innerHTML =
          "<b>" + (right ? "✓ Correct." : "✕ Not quite.") + "</b> " +
          (opt.getAttribute("data-kc-why") || "");
      });
    });
  });

  /* ---------------- section nav ---------------- */

  const secnav = document.querySelector("[data-secnav]");
  if (secnav) {
    const links = [...secnav.querySelectorAll("a[href^='#']")];
    const targets = links
      .map((a) => ({ a: a, el: document.getElementById(a.getAttribute("href").slice(1)) }))
      .filter((t) => t.el);

    if (targets.length) {
      const mark = () => {
        const y = window.scrollY + window.innerHeight * 0.3;
        let current = targets[0];
        targets.forEach((t) => {
          const r = t.el.getBoundingClientRect();
          // a collapsed accordion panel measures 0x0 and would otherwise report
          // a position of 0, winning "current" from the top of the page
          if (!r.height && !r.width) return;
          if (r.top + window.scrollY <= y) current = t;
        });
        targets.forEach((t) =>
          t.a.setAttribute("aria-current", t === current ? "true" : "false")
        );
      };
      let ticking = false;
      window.addEventListener(
        "scroll",
        () => {
          if (ticking) return;
          ticking = true;
          requestAnimationFrame(() => { mark(); ticking = false; });
        },
        { passive: true }
      );
      mark();
    }
  }
})();

/* Reflection prompts: clicking one seeds the textarea. They are labelled as
   prompts in the markup, never presented as other people's posts. */
(function () {
  const ta = document.getElementById("wallText");
  if (!ta) return;
  document.querySelectorAll("[data-prompt]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const seed = btn.getAttribute("data-prompt");
      if (!ta.value.trim()) ta.value = seed;
      else ta.value = ta.value.replace(/\s*$/, "\n\n") + seed;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    });
  });
})();
