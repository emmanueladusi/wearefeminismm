/* The signature — the doubled m in "wearefeminismm" is Emmanuel.
   Tint the final glyph gold so the extra m reads as intentional, not a typo,
   and reveal a short note on hover. Home only; waits for the wordmark (built
   asynchronously by heroReveal.js) to exist first. */
(function () {
  var host = document.getElementById("brandmarkWord");
  if (!host) return;

  function wire() {
    var glyphs = host.querySelectorAll(".bmc-glyph");
    if (!glyphs.length) return false;
    var last = glyphs[glyphs.length - 1];          // the extra m
    if (last.dataset.sig) return true;
    last.dataset.sig = "1";
    last.classList.add("bmc-glyph--sig");
    last.style.pointerEvents = "auto";
    last.style.cursor = "help";
    last.setAttribute("tabindex", "0");
    last.setAttribute("role", "img");
    last.setAttribute("aria-label", "The second m is for Emmanuel");

    var tip = document.createElement("div");
    tip.className = "sig-tip";
    tip.setAttribute("role", "tooltip");
    tip.textContent = "Two m’s, on purpose.";   // placeholder wording — easy to swap
    document.body.appendChild(tip);

    function show() {
      var r = last.getBoundingClientRect();
      tip.style.left = (r.left + r.width / 2) + "px";
      tip.style.top = r.top + "px";
      tip.classList.add("is-on");
    }
    function hide() { tip.classList.remove("is-on"); }
    last.addEventListener("pointerenter", show);
    last.addEventListener("pointerleave", hide);
    last.addEventListener("focus", show);
    last.addEventListener("blur", hide);
    return true;
  }

  if (wire()) return;
  var mo = new MutationObserver(function () { if (wire()) mo.disconnect(); });
  mo.observe(host, { childList: true, subtree: true });
  setTimeout(function () { mo.disconnect(); }, 15000);
})();
