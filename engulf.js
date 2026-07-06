/* Ask section — pinned via a tall scroll-track + sticky stage, the same
   technique as the #mission 3D flythrough (CSS `position: sticky` on the
   stage inside a tall `.askpin`; progress read from the section's scroll
   offset each frame — no GSAP pin). Staged across the track:

     0.00-0.08  static: question held, no glow (the resting state)
     0.08-0.28  edge glow fades in around the section perimeter
     0.20-0.42  "Hey — what is feminism?" fades out
     0.28-0.62  glow holds alone — "answering" the question
     0.62-0.80  glow fades out
     0.80-1.00  blank hold: empty, back to paper, reserved for later

   The glow is a WebGL fragment shader (Three.js): domain-warped fbm noise
   in an Apple-Intelligence palette forming an edge/perimeter frame that
   breathes on its own clock, while SCROLL controls its reveal. Screen-
   blended over the veil so it reads as emitted light.

   Fallbacks:
     - no WebGL      -> animated CSS-gradient edge glow (.askpin__fallback)
     - reduced motion -> static question, no effect. */

(function () {
  const section = document.getElementById("ask");
  if (!section) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    section.classList.add("askpin--static");
    return;
  }

  const stage = section.querySelector(".askpin__stage");
  const line = section.querySelector(".askpin__line");
  const canvas = document.getElementById("siriGlow");
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  /* ============================================================
     WebGL Siri glow
     ============================================================ */
  function createGlow(cv) {
    if (typeof THREE === "undefined") return null;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    } catch (e) {
      return null;
    }
    if (!renderer.getContext()) return null;

    renderer.setClearColor(0x000000, 0); // transparent — glow composites over the paper

    const DPR = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(DPR);

    const scene = new THREE.Scene();
    const camera = new THREE.Camera(); // full-screen quad in clip space, no transform
    const uniforms = {
      uTime: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uReveal: { value: 0 },
    };

    const vertexShader = `
      void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
    `;

    const fragmentShader = `
      precision highp float;
      uniform vec2  uRes;
      uniform float uTime;
      uniform float uReveal;

      // --- value noise + fbm ---------------------------------
      vec2 hash2(vec2 p){
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return fract(sin(p) * 43758.5453) * 2.0 - 1.0;
      }
      float noise(vec2 p){
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float a = dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0));
        float b = dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
        float c = dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
        float d = dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }
      float fbm(vec2 p){
        float v = 0.0, a = 0.5;
        mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
        for (int i = 0; i < 5; i++){ v += a * noise(p); p = m * p; a *= 0.5; }
        return v;
      }

      // signed distance to a rounded rectangle (b = half-size, r = corner radius)
      float sdRoundRect(vec2 p, vec2 b, float r){
        vec2 q = abs(p) - b + r;
        return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
      }

      void main(){
        // aspect-correct, centered coordinates
        vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;

        // a very gentle drift — alive, not busy
        uv += 0.02 * vec2(sin(uTime * 0.15), cos(uTime * 0.12));

        // rounded-rectangle frame hugging the section edges
        float aspect = uRes.x / uRes.y;
        vec2 b = vec2(aspect * 0.5, 0.5) - 0.00;
        float sd = sdRoundRect(uv, b, 0.05);

        // SOFT, EVEN glow centred on the frame line — calm like the Oryzo
        // reference. A gaussian band means the centre stays fully clear
        // (paper shows through) with no muddy fill or conic spokes. Only a
        // whisper of fbm so the thickness breathes gently around the border.
        float wobble = 0.012 * fbm(uv * 1.3 + vec2(0.0, uTime * 0.05));
        float w = 0.04 + wobble;
        float mask = exp(-(sd * sd) / (w * w));
        mask += 0.25 * smoothstep(0.0, -0.18, sd) * mask; // a touch of inward bloom
        mask = clamp(mask, 0.0, 1.0);

        // smooth rainbow around the border, slowly rotating (Oryzo-style),
        // slightly desaturated + lifted toward white so it reads as calm,
        // soft light rather than a harsh aurora.
        float ang = atan(uv.y, uv.x) / 6.2831853;      // -0.5 .. 0.5
        float hue = ang + 0.5 + uTime * 0.015;
        vec3 col = 0.5 + 0.5 * cos(6.2831853 * (hue + vec3(0.0, 0.33, 0.67)));
        col = mix(vec3(dot(col, vec3(0.333))), col, 0.90); // ease saturation a little
        col = mix(col, vec3(1.0), 0.2);                   // soft & luminous

        float breath = 0.92 + 0.05 * sin(uTime * 0.3);

        // alpha = the soft band; transparent centre (paper shows through).
        // Premultiplied; overall level kept low so the glow stays calm.
        float a = clamp(mask * uReveal * breath * 0.7, 0.0, 1.0);
        gl_FragColor = vec4(col * a, a);
      }
    `;

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      blending: THREE.NormalBlending,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);

    function resize() {
      const w = cv.clientWidth || window.innerWidth;
      const h = cv.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      uniforms.uRes.value.set(w * DPR, h * DPR);
    }
    resize();

    return {
      resize,
      setReveal: (v) => { uniforms.uReveal.value = v; },
      render: (elapsed) => {
        uniforms.uTime.value = elapsed;
        renderer.render(scene, camera);
      },
    };
  }

  const glow = createGlow(canvas);
  if (glow) stage.style.setProperty("--fallback", "0"); // hide the CSS fallback

  /* ---- progress: scroll offset within the tall track (0..1),
     identical to the #mission 3D section's approach ---- */
  function progress() {
    const rect = section.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    return total > 0 ? clamp01(-rect.top / total) : 0;
  }

  /* ---- staged sequence driven by progress (see header) ---- */
  function apply(p) {
    let reveal;
    if (p < 0.08) reveal = 0;
    else if (p < 0.28) reveal = (p - 0.08) / 0.20;      // fade in
    else if (p < 1) reveal = 1;                       // hold
    else if (p < 0.80) reveal = 1 - (p - 0.1) / 0.18;   // fade out
    else reveal = 0;                                     // blank hold

    const textFade = clamp01((p - 0.20) / 0.22);         // gone by ~0.42

    line.style.opacity = (1 - textFade).toFixed(3);
    stage.style.setProperty("--reveal", reveal.toFixed(3));
    stage.style.setProperty("--darken", "0"); // no dark veil — glow sits on the paper
    if (glow) glow.setReveal(reveal);
  }

  /* ---- rAF loop: runs only while the section is on screen ---- */
  let running = false;
  const startTime = performance.now();

  function frame(now) {
    if (!running) return;
    apply(progress());
    if (glow) glow.render((now - startTime) / 1000);
    requestAnimationFrame(frame);
  }

  new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && !running) {
        if (glow) glow.resize(); // ensure correct canvas size now it's on screen
        running = true;
        requestAnimationFrame(frame);
      } else if (!entry.isIntersecting) {
        running = false;   // stop rendering when off-screen
        apply(progress()); // settle the vars at the boundary
      }
    },
    { threshold: 0 }
  ).observe(section);

  apply(progress()); // initial resting state before any scroll
  window.addEventListener("resize", () => glow && glow.resize());
})();
