/* Extra WebGL moments — spreads the Lusion feel beyond the hero:
   1. Grounding gem: an iridescent shape floating beside the pull
      quotes, rotated by scroll with a slow idle spin.
   2. Wall backdrop: drifting light particles + faint shapes behind
      the story wall, so the dark section feels like deep space.
   Each scene renders only while its section is on screen, and both
   are skipped on reduced motion, missing WebGL, or (for the gem)
   narrow screens. */

(function () {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion || typeof THREE === "undefined") return;

  const lean =
    (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);

  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  /* shared little studio environment for reflections */
  function makeEnv() {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 128;
    const g = c.getContext("2d");
    const grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, "#f2ead8");
    grad.addColorStop(0.55, "#9a86c4");
    grad.addColorStop(1, "#241a38");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 128);
    const glow = (x, y, r, col, a) => {
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, col);
      rg.addColorStop(1, "rgba(255,255,255,0)");
      g.globalAlpha = a; g.fillStyle = rg; g.fillRect(0, 0, 256, 128); g.globalAlpha = 1;
    };
    glow(60, 34, 66, "#fff4dd", 0.9);
    glow(200, 44, 56, "#ffd894", 0.8);
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  const env = makeEnv();

  /* run a scene only while its host section is visible */
  function visibilityLoop(section, render) {
    let running = false;
    let last = performance.now();

    function frame(now) {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      render(dt);
      requestAnimationFrame(frame);
    }

    new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !running) {
          running = true;
          last = performance.now();
          requestAnimationFrame(frame);
        } else if (!entry.isIntersecting) {
          running = false;
        }
      },
      { rootMargin: "80px" }
    ).observe(section);
  }

  /* =====================================================
     1. Grounding gem
     ===================================================== */
  (function gem() {
    const section = document.getElementById("grounding");
    const canvas = document.getElementById("gemCanvas");
    if (!section || !canvas) return;
    if (window.matchMedia("(max-width: 900px)").matches) {
      canvas.style.display = "none";
      return;
    }

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !lean });
    } catch { canvas.style.display = "none"; return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, lean ? 1.5 : 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.environment = env;
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 30);
    camera.position.z = 6;

    scene.add(new THREE.AmbientLight(0xe8e0f2, 0.7));
    const key = new THREE.DirectionalLight(0xffe6b0, 1.6);
    key.position.set(3, 4, 5);
    scene.add(key);

    const gemMesh = new THREE.Mesh(
      new THREE.TorusKnotGeometry(1.15, 0.4, 220, 36),
      new THREE.MeshPhysicalMaterial({
        color: 0x6a4fb0,
        metalness: 0.15,
        roughness: 0.1,
        clearcoat: 1,
        clearcoatRoughness: 0.15,
        iridescence: 0.9,
        iridescenceIOR: 1.3,
        envMapIntensity: 1.3,
      })
    );
    scene.add(gemMesh);

    // a thin gold ring orbiting the gem
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.35, 0.035, 10, 64),
      new THREE.MeshStandardMaterial({ color: 0xd9a13f, metalness: 1, roughness: 0.25 })
    );
    ring.rotation.x = Math.PI / 2.4;
    scene.add(ring);

    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener("resize", resize);

    function progress() {
      const r = section.getBoundingClientRect();
      return clamp01((innerHeight - r.top) / (innerHeight + r.height));
    }

    let idle = 0;
    visibilityLoop(section, (dt) => {
      idle += dt;
      const t = progress();
      gemMesh.rotation.y = t * Math.PI * 2.2 + idle * 0.18;
      gemMesh.rotation.x = 0.35 + Math.sin(idle * 0.5) * 0.08;
      gemMesh.position.y = Math.sin(idle * 0.8) * 0.14;
      ring.rotation.z = t * Math.PI + idle * 0.1;
      renderer.render(scene, camera);
    });
  })();

  /* =====================================================
     2. Wall backdrop — deep-space drift behind the stories
     ===================================================== */
  (function wallSpace() {
    const section = document.getElementById("wall");
    const canvas = document.getElementById("wallCanvas");
    if (!section || !canvas) return;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: false });
    } catch { canvas.style.display = "none"; return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const DEEP = 0x2e2145;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(DEEP);
    scene.fog = new THREE.Fog(DEEP, 6, 26);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 40);
    camera.position.z = 10;

    scene.add(new THREE.AmbientLight(0xcbb8e6, 0.5));
    const gold = new THREE.PointLight(0xffd894, 2.2, 40);
    gold.position.set(6, 4, 4);
    scene.add(gold);

    /* faint shapes drifting far behind the posts */
    const shapes = [];
    const geos = [
      new THREE.IcosahedronGeometry(1, 3),              // smooth orb
      new THREE.CapsuleGeometry(0.5, 1, 8, 24),         // soft pill
      new THREE.TorusGeometry(0.7, 0.18, 24, 96),       // slim clean ring
    ];
    const COUNT = lean ? 7 : 12;
    for (let i = 0; i < COUNT; i++) {
      const isGold = Math.random() < 0.3;
      const m = new THREE.Mesh(
        geos[(Math.random() * geos.length) | 0],
        new THREE.MeshStandardMaterial({
          color: isGold ? 0xd9a13f : 0x6a4fb0,
          metalness: isGold ? 0.9 : 0.3,
          roughness: 0.35,
          transparent: true,
          opacity: 0.34,
          envMap: env,
          envMapIntensity: 0.7,
        })
      );
      m.scale.setScalar(rand(0.5, 1.4));
      m.position.set(rand(-11, 11), rand(-7, 7), rand(-14, -4));
      m.rotation.set(rand(0, 6), rand(0, 6), 0);
      m.userData.spin = rand(-0.15, 0.15);
      m.userData.driftY = rand(0.08, 0.22);
      m.userData.phase = rand(0, Math.PI * 2);
      scene.add(m);
      shapes.push(m);
    }

    /* light dust */
    const pCount = lean ? 160 : 300;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      pPos[i * 3] = rand(-13, 13);
      pPos[i * 3 + 1] = rand(-8, 8);
      pPos[i * 3 + 2] = rand(-16, 2);
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const dust = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({ color: 0xf3e6c4, size: 0.05, transparent: true, opacity: 0.55 })
    );
    scene.add(dust);

    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener("resize", resize);

    let idle = 0;
    visibilityLoop(section, (dt) => {
      idle += dt;
      /* slow scroll parallax: camera slides as the section passes */
      const r = section.getBoundingClientRect();
      const t = clamp01((innerHeight - r.top) / (innerHeight + r.height));
      camera.position.y = (t - 0.5) * -2.4;

      shapes.forEach((m) => {
        m.rotation.y += m.userData.spin * dt;
        m.rotation.x += m.userData.spin * 0.6 * dt;
        m.position.y += Math.sin(idle * m.userData.driftY + m.userData.phase) * 0.0035;
      });
      dust.rotation.z += dt * 0.015;

      renderer.render(scene, camera);
    });
  })();
})();
