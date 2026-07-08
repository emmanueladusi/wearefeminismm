/* AppleIntelligenceGlow — vanilla edition.
   ------------------------------------------------------------------
   The Siri-style animated rainbow border glow, as a self-contained,
   framework-free component (the vanilla twin of AppleIntelligenceGlow.tsx).
   Injects its own stylesheet once, then lets you wrap any element:

     // programmatic
     const glow = AppleIntelligenceGlow.attach(cardEl, { radius: 28, duration: 7, active: true });
     glow.setActive(false);   // fade out + pause  ("AI idle")
     glow.setActive(true);    // fade in  + spin   ("AI thinking/listening")
     glow.destroy();

     // or declaratively — auto-attached on load:
     <div data-aig data-aig-radius="28" data-aig-duration="7" data-aig-active="true"> … </div>

   Three stacked layers (sharp edge / mid glow / diffuse bloom) share ONE
   rotating conic gradient, each masked to a ring that hugs the edge and
   corners. Blur lives on the outer layer, the mask on the inner ring, so the
   glow spreads softly past the edge instead of hard-clipping to a line.
   Content stays crisp (glow sits at z-index -1 inside an isolated context).
   Respects prefers-reduced-motion. */

(function () {
  if (window.AppleIntelligenceGlow) return; // already loaded

  var STYLE_ID = "apple-intelligence-glow-styles";
  var CSS = [
    "@property --aig-angle{syntax:'<angle>';inherits:false;initial-value:0deg;}",
    ".aig{position:relative;isolation:isolate;border-radius:var(--aig-radius,24px);",
    "--aig-conic:conic-gradient(from var(--aig-angle),#30D5C8,#7B61FF,#FF3CAC,#FFB86B,#6EE7B7,#30D5C8);}",
    /* glow container sits BEHIND the element's own content (z-index -1 inside
       the isolated context) so children stay crisp without any markup change */
    ".aig__glows{position:absolute;inset:0;border-radius:inherit;pointer-events:none;",
    "z-index:-1;opacity:1;transition:opacity .6s ease;}",
    ".aig[data-active='false'] .aig__glows{opacity:0;}",
    /* each layer blurs its child ring (blur out here, mask in the ring) */
    ".aig__layer{position:absolute;inset:calc(-1*var(--aig-bleed));",
    "border-radius:calc(var(--aig-radius,24px) + var(--aig-bleed));",
    "filter:blur(var(--aig-blur));opacity:var(--aig-opacity);will-change:transform,opacity;}",
    /* the rotating conic gradient, masked to a ring that follows the radius */
    ".aig__ring{position:absolute;inset:0;border-radius:inherit;box-sizing:border-box;",
    "padding:var(--aig-thickness);background:var(--aig-conic);",
    "-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);",
    "mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);",
    "-webkit-mask-composite:xor;mask-composite:exclude;",
    "animation:aig-spin var(--aig-duration,7s) linear infinite;}",
    /* (a) sharp edge  (b) mid glow  (c) diffuse outward bloom */
    ".aig__sharp{--aig-bleed:0px;--aig-blur:3px;--aig-opacity:1;--aig-thickness:2px;}",
    ".aig__mid{--aig-bleed:6px;--aig-blur:20px;--aig-opacity:.85;--aig-thickness:3px;}",
    ".aig__bloom{--aig-bleed:50px;--aig-blur:64px;--aig-opacity:.42;--aig-thickness:10px;",
    "animation:aig-breathe 4s ease-in-out infinite alternate;}",
    ".aig[data-active='false'] .aig__ring,.aig[data-active='false'] .aig__bloom{animation-play-state:paused;}",
    "@keyframes aig-spin{to{--aig-angle:360deg;}}",
    "@keyframes aig-breathe{from{opacity:calc(var(--aig-opacity)*.6);transform:scale(.99);}",
    "to{opacity:var(--aig-opacity);transform:scale(1.03);}}",
    "@media (prefers-reduced-motion:reduce){.aig__ring{animation:none;}.aig__bloom{animation:none;}}",
  ].join("");

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  function attach(el, opts) {
    if (!el) return null;
    if (el.__aig) return el.__aig; // idempotent
    opts = opts || {};
    injectStyles();

    var radius = opts.radius != null ? opts.radius : 24;
    var duration = opts.duration != null ? opts.duration : 7;
    var active = opts.active !== false;

    el.classList.add("aig");
    el.style.setProperty("--aig-radius", radius + "px");
    el.style.setProperty("--aig-duration", duration + "s");
    el.setAttribute("data-active", active ? "true" : "false");

    var glows = document.createElement("div");
    glows.className = "aig__glows";
    glows.setAttribute("aria-hidden", "true");
    glows.innerHTML =
      '<div class="aig__layer aig__bloom"><span class="aig__ring"></span></div>' +
      '<div class="aig__layer aig__mid"><span class="aig__ring"></span></div>' +
      '<div class="aig__layer aig__sharp"><span class="aig__ring"></span></div>';
    el.insertBefore(glows, el.firstChild);

    var handle = {
      el: el,
      setActive: function (v) { el.setAttribute("data-active", v ? "true" : "false"); },
      setRadius: function (r) { el.style.setProperty("--aig-radius", r + "px"); },
      setDuration: function (d) { el.style.setProperty("--aig-duration", d + "s"); },
      destroy: function () {
        glows.remove();
        el.classList.remove("aig");
        el.removeAttribute("data-active");
        el.style.removeProperty("--aig-radius");
        el.style.removeProperty("--aig-duration");
        delete el.__aig;
      },
    };
    el.__aig = handle;
    return handle;
  }

  function setActive(el, v) {
    if (el && el.__aig) el.__aig.setActive(v);
  }

  // declarative auto-init: <element data-aig data-aig-radius data-aig-duration data-aig-active>
  function autoInit(root) {
    (root || document).querySelectorAll("[data-aig]").forEach(function (el) {
      attach(el, {
        radius: el.dataset.aigRadius ? parseFloat(el.dataset.aigRadius) : undefined,
        duration: el.dataset.aigDuration ? parseFloat(el.dataset.aigDuration) : undefined,
        active: el.dataset.aigActive !== "false",
      });
    });
  }

  window.AppleIntelligenceGlow = { attach: attach, setActive: setActive, autoInit: autoInit };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { autoInit(); });
  } else {
    autoInit();
  }
})();
