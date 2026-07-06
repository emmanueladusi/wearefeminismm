/* Mission flythrough — a real WebGL scroll-through-space scene.
   As you scroll the pinned #mission section, the camera flies forward
   through a field of floating iridescent shapes and light particles in
   the violet/gold palette, landing on the mission statement.

   Scrubbed: camera position is driven directly by scroll, so scrolling
   back reverses the flight. Runs only while the section is on screen.
   Falls back to a static statement if WebGL / Three.js is unavailable
   or reduced motion is requested. */

(function () {
  const section = document.getElementById("mission");
  const canvas = document.getElementById("flyCanvas");
  const line = document.getElementById("flyLine");
  const overlay = document.getElementById("flyOverlay");
  const fallback = document.querySelector(".fly__fallback");
  if (!section || !canvas) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function useFallback() {
    if (canvas) canvas.style.display = "none";
    if (line) line.style.display = "none";
    if (overlay) overlay.style.display = "none";
    if (fallback) fallback.style.display = "flex";
  }

  if (reduceMotion || typeof THREE === "undefined") {
    useFallback();
    return;
  }

  const lean =
    (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !lean, alpha: false });
  } catch {
    useFallback();
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, lean ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const DEEP = 0x2e2145;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(DEEP);
  scene.fog = new THREE.Fog(DEEP, 12, 46); // distant shapes fade in/out of the dark

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 100);

  /* ---- generated studio environment for glossy reflections ---- */
  (function buildEnv() {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 256;
    const g = c.getContext("2d");
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, "#efe6d0");
    grad.addColorStop(0.5, "#9a86c4");
    grad.addColorStop(1, "#241a38");
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 256);
    const glow = (x, y, r, col, a) => {
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, col);
      rg.addColorStop(1, "rgba(255,255,255,0)");
      g.globalAlpha = a; g.fillStyle = rg; g.fillRect(0, 0, 512, 256); g.globalAlpha = 1;
    };
    glow(120, 70, 130, "#fff4dd", 0.9);
    glow(400, 90, 110, "#ffd894", 0.8);
    glow(260, 210, 200, "#8a6fc0", 0.5);
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    scene.environment = tex;
  })();

  scene.add(new THREE.AmbientLight(0xcbb8e6, 0.6));
  const gold = new THREE.DirectionalLight(0xffe6b0, 1.3);
  gold.position.set(4, 6, 8);
  scene.add(gold);
  const lilac = new THREE.PointLight(0x9a7fd0, 2.4, 60);
  lilac.position.set(-8, -4, -10);
  scene.add(lilac);

  /* ---- the field of floating shapes ---- */
  const TRAVEL = 90;          // world units the camera flies
  const COUNT = lean ? 34 : 56;
  const geos = [
    new THREE.IcosahedronGeometry(1, 3),              // smooth orb
    new THREE.TorusGeometry(0.75, 0.16, 24, 96),      // slim clean ring
    new THREE.CapsuleGeometry(0.45, 0.9, 8, 24),      // soft pill
    new THREE.TorusKnotGeometry(0.55, 0.2, 128, 24),  // elegant knot
  ];

  const palette = [0x6a4fb0, 0x8a6fc0, 0xd9a13f, 0xe8e0f2];
  const shapes = [];
  const rand = (a, b) => a + Math.random() * (b - a);

  for (let i = 0; i < COUNT; i++) {
    const color = palette[(Math.random() * palette.length) | 0];
    const isGold = color === 0xd9a13f;
    const mat = new THREE.MeshPhysicalMaterial({
      color,
      metalness: isGold ? 1 : 0.1,
      roughness: isGold ? 0.22 : 0.12,
      clearcoat: 1,
      clearcoatRoughness: 0.2,
      iridescence: isGold ? 0 : 0.8,
      iridescenceIOR: 1.3,
      envMapIntensity: 1.2,
    });
    const mesh = new THREE.Mesh(geos[(Math.random() * geos.length) | 0], mat);
    const s = rand(0.5, 1.7);
    mesh.scale.setScalar(s);
    // spread through a tube along -Z, avoiding the very center so the
    // camera flies past shapes rather than through them
    const ang = Math.random() * Math.PI * 2;
    const rad = rand(2.2, 7.5);
    mesh.position.set(
      Math.cos(ang) * rad,
      Math.sin(ang) * rad * 0.7,
      rand(2, -TRAVEL)
    );
    mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    mesh.userData.spin = new THREE.Vector3(rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.3, 0.3));
    scene.add(mesh);
    shapes.push(mesh);
  }

  /* ---- drifting light particles for depth ---- */
  const pCount = lean ? 220 : 420;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    pPos[i * 3] = rand(-14, 14);
    pPos[i * 3 + 1] = rand(-10, 10);
    pPos[i * 3 + 2] = rand(3, -TRAVEL);
  }
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  const particles = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({ color: 0xf3e6c4, size: 0.06, transparent: true, opacity: 0.7 })
  );
  scene.add(particles);

  /* ---- sizing ---- */
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  /* ---- scrub + render ---- */
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  let mx = 0, my = 0, smx = 0, smy = 0;

  window.addEventListener(
    "mousemove",
    (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; },
    { passive: true }
  );

  function progress() {
    const rect = section.getBoundingClientRect();
    const total = rect.height - innerHeight;
    return clamp01(-rect.top / total);
  }

  let running = false;
  let last = performance.now();

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    const t = progress();
    const eased = ease(t);

    // fly forward through the field
    camera.position.z = 12 - eased * TRAVEL;
    // gentle winding + subtle mouse look for parallax
    smx += (mx - smx) * 0.05;
    smy += (my - smy) * 0.05;
    camera.position.x = Math.sin(eased * Math.PI * 2) * 1.6 + smx * 2;
    camera.position.y = Math.cos(eased * Math.PI * 1.5) * 1.1 - smy * 1.5;
    camera.lookAt(
      Math.sin(eased * Math.PI * 2 + 0.6) * 1.2,
      Math.cos(eased * Math.PI * 1.5 + 0.4) * 0.8,
      camera.position.z - 10
    );

    for (const m of shapes) {
      m.rotation.x += m.userData.spin.x * dt;
      m.rotation.y += m.userData.spin.y * dt;
    }
    particles.rotation.z += dt * 0.02;

    // guide line draws in at the start, then fades
    const lineT = clamp01(t / 0.14);
    line.style.transform = `scaleY(${lineT})`;
    line.style.opacity = String(1 - clamp01((t - 0.14) / 0.12));

    // statement arrives at the end of the flight
    const textT = clamp01((t - 0.72) / 0.24);
    overlay.style.opacity = String(textT);
    overlay.style.transform = `translateY(${28 * (1 - textT)}px) scale(${0.96 + textT * 0.04})`;

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);

  new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && !running) {
        resize();
        running = true;
        last = performance.now();
        requestAnimationFrame(frame);
      } else if (!entry.isIntersecting) {
        running = false; // stop rendering when off-screen
      }
    },
    { rootMargin: "100px" }
  ).observe(section);
})();
