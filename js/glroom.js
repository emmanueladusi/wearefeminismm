/* =====================================================================
   GLROOM · the gallery's rooms, rendered on the GPU

   WHY THIS EXISTS
   The DOM gallery moves its camera with translateZ under perspective.
   That is a continuous screen-space SCALE change on every card, and
   Chromium answers a scale change by re-rasterizing the card's tiles on
   the CPU and re-uploading them. On the directory hang it is worse
   still: layoutReel interpolates each cover's WIDTH and HEIGHT every
   frame, and a resize is the one thing no raster survives — the 72px
   blur, the filter stack and the background-size:cover bitmap all redraw
   at ~50vw. That is the lag, and it is structural, not a tuning problem.

   WHAT THIS DOES
   Paints every card ONCE into a texture, then moves textured quads. A
   frame becomes a few lerps, some uniform writes and one draw. The
   browser's style/layout/paint/raster pipeline is idle while travelling.

   THE CONTRACT WITH THE DOM — read this before changing anything
   The DOM is still the source of truth. Every .piece and .cover is still
   built by the existing code, still in the accessibility tree, still
   focusable, still carries its listeners, its aria and its quiz. This
   module only DRAWS. Specifically:

     · positions come from the custom properties LAYOUT[kind] already
       writes (--px/--py/--pz/--pry). The layouts are not reimplemented
       here, so corridor/orbit/field/feed stay 1:1 by construction and a
       change to LAYOUT moves the GL room too.
     · a raycast hit forwards a real click() to the element behind it, so
       openDetail, answerQuiz, markViewed and progress run untouched.
     · DOM focus drives the GL highlight (focusin), so Tab and screen
       readers behave exactly as they did.
     · the DOM room is made visually invisible but NOT display:none and
       NOT aria-hidden, because that is what keeps it focusable and
       readable to assistive tech.

   WHEN IT DOES NOT RUN
   Touch, reduced motion, and machines with no WebGL never activate it —
   those paths keep the DOM renderer, which already handles them (touch
   has its own scroll-snap rails; reduced motion has the calm view). So
   the gallery loses no capability by adopting this.
   ===================================================================== */
(function (root) {
  'use strict';

  var GL = {
    ok: false,        // WebGL present and the scene built
    active: false,    // currently driving a room
    renderer: null, scene: null, camera: null,
    world: null,      // mirrors #stage .world
    items: [],        // {el, mesh, group, shadow, kind, px,py,pz,pry}
    _ray: null, _ndc: null, _hover: -1, _focus: -1,
    _dpr: Math.min(window.devicePixelRatio || 1, 2),
    _persp: 1300,     // .room{perspective:1300px}
    _roomEl: null, _kind: null, _ringA: 0
  };

  /* =================================================================
     THE ENVIRONMENT, IN THE SAME CANVAS

     This is the part that decides whether travel feels smooth, and it is
     the one thing the standalone prototype had that the first integration
     did not. The room's wall is eleven FULLSCREEN DOM layers — plaster
     fibre, grain, two sets of linework, light, spot, arch, floor,
     vignette — and six of them re-transform on every cursor frame. Even
     with the artwork on the GPU, the compositor still had to blend all
     eleven over the canvas every single frame, and a second WebGL context
     was drawing the wall beside it.

     So the environment moves in here: one canvas, one context, layers as
     fullscreen-triangle shaders, cursor parallax as uniform writes. The
     DOM stack is hidden while this runs (body.glroom in Gallery.html) and
     comes straight back when it does not — it is still what touch,
     reduced motion and no-WebGL see.

     Everything is read from the live DOM and tokens rather than copied,
     so a palette change, a room retint or an edit to the linework paths
     still shows up here with no second source to keep in step.
     ================================================================= */
  var ENV = { layers: [], ok: false, _t0: 0 };

  var FS_VERT = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.9999,1.0); }';
  function fsGeo(THREE) {
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    return g;
  }
  function rgbOf(v, fb) {
    var t = String(v || '').trim(), m = t.match(/^#([0-9a-f]{6})$/i);
    if (m) return [parseInt(m[1].slice(0, 2), 16) / 255, parseInt(m[1].slice(2, 4), 16) / 255,
                   parseInt(m[1].slice(4, 6), 16) / 255];
    m = t.match(/rgba?\(([^)]+)\)/i);
    if (m) { var p = m[1].split(','); return [p[0] / 255, p[1] / 255, p[2] / 255]; }
    return fb;
  }
  function envLayer(THREE, mat, order) {
    mat.depthWrite = false; mat.depthTest = false;
    var m = new THREE.Mesh(ENV.geo, mat);
    m.frustumCulled = false; m.renderOrder = order;
    GL.scene.add(m); ENV.layers.push(m);
    return m;
  }
  function texFromCanvas(THREE, cv, repeat) {
    var t = new THREE.CanvasTexture(cv);
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  /* the two generated tiles the page already made into data URIs */
  function tileCanvas(url, size) {
    var cv = document.createElement('canvas'); cv.width = cv.height = size;
    var im = new Image();
    im.onload = function () { cv.getContext('2d').drawImage(im, 0, 0, size, size); if (cv._tex) cv._tex.needsUpdate = true; };
    im.src = String(url).replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
    return cv;
  }

  ENV.build = function () {
    var THREE = window.THREE;
    ENV.geo = ENV.geo || fsGeo(THREE);
    ENV._t0 = performance.now();

    /* ---- 1 · the wall. glProg's fragment shader, verbatim, so the room
       curves exactly as it does today and no text is ever distorted. --- */
    ENV.wall = new THREE.ShaderMaterial({
      uniforms: {
        r: { value: new THREE.Vector2(1, 1) }, t: { value: 0 },
        k: { value: 0.075 }, os: { value: 1.08 },
        wTop: { value: new THREE.Vector3(0.141, 0.094, 0.204) },
        wBot: { value: new THREE.Vector3(0.031, 0.024, 0.051) },
        wGlow: { value: new THREE.Vector3(0.43, 0.29, 0.66) },
        fall: { value: 0.346 }
      },
      vertexShader: FS_VERT,
      fragmentShader:
        'precision mediump float;uniform vec2 r;uniform float t;uniform float k;uniform float os;' +
        'uniform vec3 wTop;uniform vec3 wBot;uniform vec3 wGlow;uniform float fall;' +
        'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}' +
        'void main(){vec2 uv=gl_FragCoord.xy/r;' +
        'vec2 c=(uv-.5)*vec2(r.x/r.y,1.0);' +
        'float rr=dot(c,c);' +
        'vec2 warp=c*(1.0+k*rr+k*.35*rr*rr)/os;' +
        'vec2 buv=warp/vec2(r.x/r.y,1.0)+.5;' +
        'float rw=dot(warp,warp);' +
        'vec3 col=mix(wBot,wTop,smoothstep(.0,1.,buv.y));' +
        'vec2 g1=vec2(.5+.22*sin(t*.11),1.06);' +
        'vec2 g2=vec2(.24+.1*sin(t*.07+2.),.18+.06*cos(t*.09));' +
        'vec2 g3=vec2(.8+.08*cos(t*.06),.3);' +
        'col+=wGlow*.16*exp(-11.*distance(buv,g1));' +
        'col+=wGlow*.20*exp(-7.*distance(buv,g2));' +
        'col+=wGlow*.13*exp(-9.*distance(buv,g3));' +
        'col*=1.-rw*fall;' +
        'col+=(h(gl_FragCoord.xy)-.5)*.024;' +
        'gl_FragColor=vec4(col,1.);}'
    });
    envLayer(THREE, ENV.wall, -100);

    /* ---- 2/3 · fibre and grain, from the tiles the page generated ---- */
    var cs = getComputedStyle(document.documentElement);
    var fCv = tileCanvas(cs.getPropertyValue('--fibre-url'), 256);
    var gCv = tileCanvas(cs.getPropertyValue('--grain-url'), 128);
    ENV.fibreTex = texFromCanvas(THREE, fCv, true); fCv._tex = ENV.fibreTex;
    ENV.grainTex = texFromCanvas(THREE, gCv, true); gCv._tex = ENV.grainTex;

    ENV.fibre = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: { map: { value: ENV.fibreTex }, r: { value: new THREE.Vector2(1, 1) },
                  off: { value: new THREE.Vector2(0, 0) }, tile: { value: 230 }, alpha: { value: 0.05 } },
      vertexShader: FS_VERT,
      fragmentShader:
        'precision mediump float;varying vec2 vUv;uniform sampler2D map;uniform vec2 r,off;uniform float tile,alpha;' +
        'void main(){vec2 px=(gl_FragCoord.xy-r*.5)/1.04+r*.5;px-=vec2(off.x,-off.y);' +
        'vec3 c=texture2D(map,px/tile).rgb;' +
        'float rad=length(vec2((vUv.x-.5)/.72,(vUv.y-.5)/.62));' +
        'gl_FragColor=vec4(c,alpha*smoothstep(.08,.78,rad));}'
    });
    envLayer(THREE, ENV.fibre, -90);

    ENV.grain = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: { map: { value: ENV.grainTex }, tile: { value: 150 }, alpha: { value: 0.05 } },
      vertexShader: FS_VERT,
      fragmentShader:
        'precision mediump float;uniform sampler2D map;uniform float tile,alpha;' +
        'void main(){gl_FragColor=vec4(texture2D(map,gl_FragCoord.xy/tile).rgb,alpha);}'
    });
    envLayer(THREE, ENV.grain, -80);

    /* ---- 4 · the linework, read out of the SVGs already in the page,
       so the gestures stay one composition with one source. ---------- */
    ENV.farCv = document.createElement('canvas');
    ENV.nearCv = document.createElement('canvas');
    ENV.far = lineMat(THREE, ENV.farCv);
    ENV.near = lineMat(THREE, ENV.nearCv);
    envLayer(THREE, ENV.far, -70);
    envLayer(THREE, ENV.near, 100);          /* the near gesture crosses IN FRONT */

    /* ---- 5..9 · light, spot, arch, floor, vignette ------------------ */
    ENV.lightCv = document.createElement('canvas');
    ENV.archCv = document.createElement('canvas');
    ENV.floorCv = document.createElement('canvas');
    ENV.vigCv = document.createElement('canvas');
    ENV.light = paintedMat(THREE, ENV.lightCv, true);
    envLayer(THREE, ENV.light, -60);
    ENV.spot = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: { p: { value: new THREE.Vector2(0.5, 0.5) }, k: { value: 0 } },
      vertexShader: FS_VERT,
      fragmentShader:
        'precision mediump float;varying vec2 vUv;uniform vec2 p;uniform float k;' +
        'void main(){vec2 uv=vec2(vUv.x,1.-vUv.y);vec2 d=(uv-p)/vec2(.46,.40);' +
        'gl_FragColor=vec4(1.,.973,.910,k*.09*max(0.,1.-smoothstep(0.,.72,length(d))));}'
    });
    envLayer(THREE, ENV.spot, -50);
    ENV.arch = paintedMat(THREE, ENV.archCv, true);
    envLayer(THREE, ENV.arch, -40);
    ENV.floor = paintedMat(THREE, ENV.floorCv, false);
    envLayer(THREE, ENV.floor, -30);
    ENV.vig = paintedMat(THREE, ENV.vigCv, false);
    envLayer(THREE, ENV.vig, -20);

    ENV.ok = true;
    ENV.repaint();
  };

  function lineMat(THREE, cv) {
    return new THREE.ShaderMaterial({
      transparent: true,
      uniforms: { map: { value: texFromCanvas(THREE, cv) }, r: { value: new THREE.Vector2(1, 1) },
                  off: { value: new THREE.Vector2(0, 0) }, alpha: { value: 0.62 } },
      vertexShader: FS_VERT,
      fragmentShader:
        'precision mediump float;uniform sampler2D map;uniform vec2 r,off;uniform float alpha;' +
        'void main(){vec4 c=texture2D(map,(gl_FragCoord.xy-vec2(off.x,-off.y))/r);' +
        'gl_FragColor=vec4(c.rgb,c.a*alpha);}'
    });
  }
  function paintedMat(THREE, cv, parallax) {
    return new THREE.ShaderMaterial({
      transparent: true,
      uniforms: { map: { value: texFromCanvas(THREE, cv) }, r: { value: new THREE.Vector2(1, 1) },
                  off: { value: new THREE.Vector2(0, 0) } },
      vertexShader: FS_VERT,
      fragmentShader:
        'precision mediump float;uniform sampler2D map;uniform vec2 r,off;' +
        'void main(){gl_FragColor=texture2D(map,(gl_FragCoord.xy-vec2(off.x,-off.y))/r);}'
    });
  }

  /* Repaint the token-driven layers. Runs on room change and resize —
     never per frame, which is the whole point. */
  ENV.repaint = function () {
    if (!ENV.ok) return;
    var cs = getComputedStyle(document.documentElement);
    var g = document.getElementById('gallery');
    var gs = g ? getComputedStyle(g) : cs;
    var top = rgbOf(cs.getPropertyValue('--gallery-wall'), [0.30, 0.21, 0.46]);
    var bot = rgbOf(cs.getPropertyValue('--gallery-black'), [0.13, 0.09, 0.19]);
    var glow = rgbOf(gs.getPropertyValue('--room-glow'), [0.55, 0.45, 0.76]);
    var lum = top[0] * 0.299 + top[1] * 0.587 + top[2] * 0.114;
    var kk = Math.max(0.12, 1 - lum);
    ENV.wall.uniforms.wTop.value.set(top[0], top[1], top[2]);
    ENV.wall.uniforms.wBot.value.set(bot[0], bot[1], bot[2]);
    ENV.wall.uniforms.wGlow.value.set(glow[0] * kk, glow[1] * kk, glow[2] * kk);
    ENV.wall.uniforms.fall.value = 0.10 + 0.28 * (1 - lum);
    ENV.wall.uniforms.k.value = parseFloat(cs.getPropertyValue('--lens-distortion')) || 0.075;
    ENV.wall.uniforms.os.value = parseFloat(cs.getPropertyValue('--environment-overscan')) || 1.08;
    ENV.fibre.uniforms.alpha.value = parseFloat(cs.getPropertyValue('--gallery-fibre-opacity')) || 0.05;
    ENV.grain.uniforms.alpha.value = parseFloat(cs.getPropertyValue('--grain-opacity')) || 0.05;
    ENV.paintLines(); ENV.paintPools(gs);
  };

  ENV.paintLines = function () {
    [['--far', ENV.farCv, ENV.far], ['--near', ENV.nearCv, ENV.near]].forEach(function (set) {
      var sel = set[0] === '--far' ? '.glines--far' : '.glines--near';
      var host = document.querySelector(sel);
      var cv = set[1], c = cv.getContext('2d');
      c.clearRect(0, 0, cv.width, cv.height);
      if (!host) return;
      var paths = host.querySelectorAll('path');
      var s = Math.max(cv.width / 1600, cv.height / 900);
      c.save();
      c.translate((cv.width - 1600 * s) / 2, (cv.height - 900 * s) / 2);
      c.scale(s, s);
      c.lineCap = 'round'; c.lineJoin = 'round';
      for (var i = 0; i < paths.length; i++) {
        var p = paths[i], pcs = getComputedStyle(p);
        c.strokeStyle = pcs.stroke && pcs.stroke !== 'none' ? pcs.stroke : '#6d4a94';
        c.lineWidth = parseFloat(pcs.strokeWidth) || 1.2;
        c.globalAlpha = parseFloat(pcs.opacity);
        if (isNaN(c.globalAlpha)) c.globalAlpha = 0.35;
        try { c.stroke(new Path2D(p.getAttribute('d'))); } catch (e) {}
      }
      c.restore(); c.globalAlpha = 1;
      set[2].uniforms.map.value.needsUpdate = true;
    });
  };

  ENV.paintPools = function (gs) {
    var vig = (getComputedStyle(document.documentElement).getPropertyValue('--v-vig-rgb') || '8,6,13').trim();
    var num = function (n, d) { var v = parseFloat(gs.getPropertyValue(n)); return isNaN(v) ? d : v; };
    var li = num('--gallery-light-intensity', 1.12);
    var vs = num('--vignette-strength', 0.9);
    var vc = num('--vignette-corner-opacity', 0.82);
    var ve = num('--vignette-edge-opacity', 0.6);
    var vw = num('--vignette-centre-width', 52) / 100;

    var pool = function (c, w, h, x, y, rx, ry, col) {
      var g = c.createRadialGradient(x * w, y * h, 0, x * w, y * h, rx * w);
      g.addColorStop(0, col); g.addColorStop(0.73, 'rgba(0,0,0,0)');
      c.save(); c.translate(x * w, y * h); c.scale(1, (ry * h) / (rx * w)); c.translate(-x * w, -y * h);
      c.fillStyle = g; c.fillRect(-w, -h * 2, w * 3, h * 5); c.restore();
    };
    // light
    var c1 = ENV.lightCv.getContext('2d'), W = ENV.lightCv.width, H = ENV.lightCv.height;
    c1.clearRect(0, 0, W, H);
    pool(c1, W, H, 0.5, -0.06, 0.46, 0.34, 'rgba(255,246,228,' + (0.13 * li) + ')');
    pool(c1, W, H, 0.12, 0.42, 0.34, 0.30, 'rgba(178,150,224,' + (0.10 * li) + ')');
    pool(c1, W, H, 0.88, 0.56, 0.30, 0.28, 'rgba(217,161,63,' + (0.07 * li) + ')');
    ENV.light.uniforms.map.value.needsUpdate = true;
    // arch
    var c2 = ENV.archCv.getContext('2d'); W = ENV.archCv.width; H = ENV.archCv.height;
    c2.clearRect(0, 0, W, H);
    var lg = c2.createLinearGradient(0, 0, 0, H);
    lg.addColorStop(0, 'rgba(' + vig + ',0)'); lg.addColorStop(0.62, 'rgba(' + vig + ',0)');
    lg.addColorStop(0.71, 'rgba(' + vig + ',.05)'); lg.addColorStop(0.74, 'rgba(' + vig + ',.11)');
    lg.addColorStop(0.78, 'rgba(' + vig + ',.045)'); lg.addColorStop(0.92, 'rgba(' + vig + ',0)');
    c2.fillStyle = lg; c2.fillRect(0, 0, W, H);
    pool(c2, W, H, 0.5, 0.76, 0.6, 0.22, 'rgba(255,250,240,.11)');
    pool(c2, W, H, 0, 0, 0.56, 0.40, 'rgba(' + vig + ',.11)');
    pool(c2, W, H, 1, 0, 0.56, 0.40, 'rgba(' + vig + ',.10)');
    ENV.arch.uniforms.map.value.needsUpdate = true;
    // floor
    var c3 = ENV.floorCv.getContext('2d'); W = ENV.floorCv.width; H = ENV.floorCv.height;
    c3.clearRect(0, 0, W, H);
    var deep = (getComputedStyle(document.documentElement).getPropertyValue('--wall-deep') || 'rgba(20,12,34,.55)').trim();
    var top2 = H * 0.66;
    var fg = c3.createLinearGradient(0, top2, 0, H);
    fg.addColorStop(0, 'rgba(20,12,34,0)'); fg.addColorStop(1, deep);
    c3.fillStyle = fg; c3.fillRect(0, top2, W, H - top2);
    pool(c3, W, H, 0.5, 1, 0.3, (H - top2) / H, 'rgba(217,161,63,.05)');
    ENV.floor.uniforms.map.value.needsUpdate = true;
    // vignette
    var c4 = ENV.vigCv.getContext('2d'); W = ENV.vigCv.width; H = ENV.vigCv.height;
    c4.clearRect(0, 0, W, H);
    var rx = W * vw, ry = H * (vw + 0.14);
    var rg = c4.createRadialGradient(W * 0.5, H * 0.46, 0, W * 0.5, H * 0.46, rx);
    rg.addColorStop(0, 'rgba(' + vig + ',0)'); rg.addColorStop(0.66, 'rgba(' + vig + ',0)');
    rg.addColorStop(0.9, 'rgba(' + vig + ',' + (0.30 * vc * vs) + ')');
    rg.addColorStop(1, 'rgba(' + vig + ',' + (0.80 * vc * vs) + ')');
    c4.save(); c4.translate(W * 0.5, H * 0.46); c4.scale(1, ry / rx); c4.translate(-W * 0.5, -H * 0.46);
    c4.fillStyle = rg; c4.fillRect(-W, -H * 2, W * 3, H * 5); c4.restore();
    var ea = 0.62 * ve * vs;
    var eg = c4.createLinearGradient(0, 0, W, 0);
    eg.addColorStop(0, 'rgba(' + vig + ',' + ea + ')'); eg.addColorStop(0.17, 'rgba(' + vig + ',0)');
    eg.addColorStop(0.83, 'rgba(' + vig + ',0)'); eg.addColorStop(1, 'rgba(' + vig + ',' + ea + ')');
    c4.fillStyle = eg; c4.fillRect(0, 0, W, H);
    ENV.vig.uniforms.map.value.needsUpdate = true;
  };

  ENV.resize = function (bw, bh) {
    if (!ENV.ok) return;
    [ENV.wall, ENV.fibre, ENV.far, ENV.near, ENV.light, ENV.arch, ENV.floor, ENV.vig].forEach(function (m) {
      if (m.uniforms.r) m.uniforms.r.value.set(bw, bh);
    });
    ENV.fibre.uniforms.tile.value = 230 * GL._dpr;
    ENV.grain.uniforms.tile.value = 150 * GL._dpr;
    ENV.farCv.width = bw; ENV.farCv.height = bh;
    ENV.nearCv.width = bw; ENV.nearCv.height = bh;
    [ENV.lightCv, ENV.archCv, ENV.floorCv, ENV.vigCv].forEach(function (cv) {
      cv.width = Math.round(bw / 2); cv.height = Math.round(bh / 2);
    });
    ENV.repaint();
  };

  /* Per frame: the cursor pair, and the clock. Each layer applies its own
     magnitude — the CSS numbers, verbatim — as a uniform rather than as a
     transform on a composited element. */
  ENV.frame = function (mx, my, now) {
    if (!ENV.ok) return;
    ENV.wall.uniforms.t.value = (now - ENV._t0) / 1000;
    ENV.fibre.uniforms.off.value.set(mx * 11.44, my * 7.28);
    ENV.light.uniforms.off.value.set(mx * -14, my * -8);
    ENV.arch.uniforms.off.value.set(0, my * 5);
    ENV.far.uniforms.off.value.set(mx * 12, my * 12 * 0.55);
    ENV.near.uniforms.off.value.set(mx * 26, my * 26 * 0.55);
  };
  ENV.aim = function (x, y, on) {
    if (!ENV.ok) return;
    ENV.spot.uniforms.p.value.set(x, y);
    ENV.spot.uniforms.k.value = on ? 1 : 0;
  };
  GL.env = ENV;

  /* ---- capability gate -------------------------------------------- */
  function webglOK() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
                (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }

  /* =================================================================
     CARD PAINTING
     One generic painter, driven by what the element actually contains,
     rather than eight hand-written ones. It reads the same child classes
     the stylesheet does, so a copy change in WAVES/LENSES/SCHOLARS shows
     up here with no edit — which is the property that matters, because
     Janelle's edits land in those objects.
     ================================================================= */
  var TEX_SCALE = 2;                       // texture px per CSS px
  var GRAIN = null;

  function grainTile() {
    if (GRAIN) return GRAIN;
    var g = document.createElement('canvas'); g.width = g.height = 110;
    var gc = g.getContext('2d'), d = gc.createImageData(110, 110);
    for (var i = 0; i < d.data.length; i += 4) {
      var v = Math.random() * 255 | 0;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 13;  /* ≈.05 */
    }
    gc.putImageData(d, 0, 0); GRAIN = g; return g;
  }
  function rr(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function wrap(c, text, x, y, maxW, lh) {
    var words = String(text).split(/\s+/), line = '', yy = y;
    for (var i = 0; i < words.length; i++) {
      var t = line ? line + ' ' + words[i] : words[i];
      if (c.measureText(t).width > maxW && line) { c.fillText(line, x, yy); line = words[i]; yy += lh; }
      else line = t;
    }
    if (line) c.fillText(line, x, yy);
    return yy + lh;
  }
  function lines(c, text, maxW) {
    var words = String(text).split(/\s+/), line = '', n = 1;
    for (var i = 0; i < words.length; i++) {
      var t = line ? line + ' ' + words[i] : words[i];
      if (c.measureText(t).width > maxW && line) { n++; line = words[i]; } else line = t;
    }
    return n;
  }
  function tracked(c, text, x, y, tr) {
    var xx = x;
    for (var i = 0; i < text.length; i++) { c.fillText(text[i], xx, y); xx += c.measureText(text[i]).width + tr; }
  }
  function txt(el, sel) { var n = el.querySelector(sel); return n ? n.textContent.trim() : ''; }

  /* Read the live tokens so a palette change repaints the cards too. */
  function tok(name, fb) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fb;
  }

  /* The card stock: the .frame recipe in 2D — gradient paper, gold hair
     border, 6px room-colour inset ring then a gold line, gold datum rule,
     paper grain. Every room type shares it, which is what makes the three
     categories read as one exhibition. */
  function drawStock(c, W, H, opts) {
    var room = tok('--room', '#171021'), gold = tok('--gold', '#d9a13f');
    rr(c, 0, 0, W, H, 14);
    var bg = c.createLinearGradient(0, 0, W * 0.06, H);
    if (opts.stock === 'lens') { bg.addColorStop(0, '#fcf8f1'); bg.addColorStop(1, '#f2ebdd'); }
    else if (opts.stock === 'scholar') { bg.addColorStop(0, '#fcfaf6'); bg.addColorStop(1, '#eee9f4'); }
    else { bg.addColorStop(0, '#fbf7ef'); bg.addColorStop(1, '#ede4d2'); }
    c.fillStyle = bg; c.fill();

    c.save(); rr(c, 0, 0, W, H, 14); c.clip();
    c.strokeStyle = room; c.lineWidth = 12; rr(c, 0, 0, W, H, 14); c.stroke();
    c.strokeStyle = opts.stock === 'lens' ? 'rgba(168,146,212,.42)'
                  : opts.stock === 'scholar' ? 'rgba(176,152,226,.36)'
                  : 'rgba(217,161,63,.4)';
    c.lineWidth = 1.4; rr(c, 6.5, 6.5, W - 13, H - 13, 9); c.stroke();
    c.restore();
    c.strokeStyle = opts.stock === 'lens' ? 'rgba(150,128,196,.5)'
                  : opts.stock === 'scholar' ? 'rgba(176,152,226,.46)'
                  : 'rgba(217,161,63,.5)';
    c.lineWidth = 1; rr(c, 0.5, 0.5, W - 1, H - 1, 14); c.stroke();

    /* the chronological accent: only the history rooms carry it */
    if (opts.datum) {
      var P = opts.pad;
      var dg = c.createLinearGradient(P, 0, W - P, 0);
      dg.addColorStop(0, gold); dg.addColorStop(1, 'rgba(217,161,63,.12)');
      c.fillStyle = dg; c.fillRect(P, P - 7, W - P * 2, 1);
    }
  }
  function drawGrain(c, W, H, alpha) {
    c.globalCompositeOperation = 'overlay';
    rr(c, 0, 0, W, H, 14); c.save(); c.clip();
    c.globalAlpha = alpha == null ? 1 : alpha;
    c.fillStyle = c.createPattern(grainTile(), 'repeat'); c.fillRect(0, 0, W, H);
    c.restore(); c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  /* The lens glyphs, redrawn small — the .lensviz bars/stack/knot. */
  function drawLensViz(c, x, y, w, h, kind) {
    var violet = tok('--violet', '#4a3568'), gold = tok('--gold', '#d9a13f');
    c.save();
    rr(c, x, y, w, h, 8); c.fillStyle = 'rgba(74,53,104,.08)'; c.fill();
    c.translate(x + w / 2, y + h / 2);
    c.fillStyle = violet;
    if (kind === 'bar') { rr(c, -48, -6, 96, 12, 6); c.fill(); }
    else if (kind === 'stack') {
      var ws = [110, 72, 88, 52], op = [1, .75, .6, .45];
      for (var i = 0; i < 4; i++) {
        c.globalAlpha = op[i];
        rr(c, -ws[i] / 2, -22.5 + i * 15, ws[i], 9, 4.5); c.fill();
      }
      c.globalAlpha = 1;
    } else {                              /* knot */
      var rot = [24, -24, 0], o2 = [1, .75, .55];
      for (var j = 0; j < 3; j++) {
        c.save(); c.rotate(rot[j] * Math.PI / 180); c.globalAlpha = o2[j];
        rr(c, -50, -4.5, 100, 9, 4.5); c.fill(); c.restore();
      }
      c.globalAlpha = 1; c.fillStyle = gold;
      c.beginPath(); c.arc(0, 0, 9, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  /* Paint one .piece. Measures first so the texture is exactly the card,
     then draws. Returns {canvas,w,h} in CSS px. */
  function paintPiece(el, cssW) {
    var isLens = el.classList.contains('piece--lens');
    var isQuiz = el.classList.contains('piece--quiz');
    var isSch  = el.classList.contains('piece--scholar');
    var W = Math.round(cssW), P = isSch ? 12 : 22, s = TEX_SCALE;
    var ink = tok('--ink', '#241a3e'), dim = tok('--ink-dim', '#6c6480');
    var violet = tok('--violet', '#4a3568'), gold = tok('--gold', '#d9a13f');
    var probe = document.createElement('canvas').getContext('2d');
    var inner = W - P * 2;

    var img = el.querySelector('.piece__img img, .scholar__photo img');
    var year = txt(el, '.piece__year') || txt(el, '.eyebrow');
    var title = txt(el, '.piece__title') || txt(el, '.lens__name') || txt(el, '.scholar__name');
    var blurb = txt(el, '.piece__blurb') || txt(el, '.scholar__role');
    var hint = txt(el, '.piece__hint');
    var lensKind = null, lensCap = '';
    if (isLens) {
      var viz = el.querySelector('.lensviz');
      lensKind = viz ? (viz.querySelector('.lv-stack') ? 'stack'
                      : viz.querySelector('.lv-knot') ? 'knot' : 'bar') : 'bar';
      lensCap = txt(el, '.lv-cap');
    }
    var qOpts = isQuiz ? Array.prototype.map.call(el.querySelectorAll('.quiz__opt'),
                          function (b) { return b.textContent.trim(); }) : null;
    var qQ = isQuiz ? txt(el, '.quiz__q') : '';

    /* --- measure --- */
    var y = P + 8;
    if (isLens) y += 92 + 10;
    if (img) y += (isSch ? inner * 2 / 3 : inner * 9 / 16) + (isSch ? 10 : 14);
    if (year) y += 11.2 * 1.1 + 6;
    probe.font = '600 ' + (isSch ? 16.8 : 21) + 'px ' + tok('--serif', 'Georgia, serif');
    var tl = title ? lines(probe, title, inner) : 0;
    y += tl * (isSch ? 20 : 25) + (isSch ? 4 : 8);
    probe.font = '400 ' + (isSch ? 12.5 : 14.4) + 'px ' + tok('--sans', 'sans-serif');
    var bl = blurb ? lines(probe, blurb, inner) : 0;
    y += bl * (isSch ? 17 : 22) + (isSch ? 0 : 12);
    if (lensCap) y += 8 + 10;
    if (hint) y += 12 + 11.8;
    var optH = [];
    if (isQuiz) {
      probe.font = '600 18.4px ' + tok('--serif', 'Georgia, serif');
      y = P + 8 + 26 + lines(probe, qQ, inner) * 24 + 10;
      probe.font = '400 14.4px ' + tok('--sans', 'sans-serif');
      for (var k = 0; k < qOpts.length; k++) {
        var n = lines(probe, qOpts[k], inner - 28); optH.push(n * 20 + 16); y += n * 20 + 16 + 8;
      }
    }
    var H = Math.ceil(y + P);

    /* --- paint --- */
    var cv = document.createElement('canvas');
    cv.width = W * s; cv.height = H * s;
    var c = cv.getContext('2d'); c.scale(s, s);
    drawStock(c, W, H, {
      stock: isLens ? 'lens' : isSch ? 'scholar' : 'card',
      datum: !isLens && !isSch, pad: P
    });

    var yy = P + 8;
    if (isLens) { drawLensViz(c, P, yy, inner, 92, lensKind); yy += 92 + 10; }
    if (img) {
      var ih = isSch ? inner * 2 / 3 : inner * 9 / 16;
      c.save(); rr(c, P, yy, inner, ih, 8); c.clip();
      c.fillStyle = tok('--violet-deep', '#2e2145'); c.fillRect(P, yy, inner, ih);
      if (img.complete && img.naturalWidth) {
        var r2 = Math.max(inner / img.naturalWidth, ih / img.naturalHeight);
        var dw = img.naturalWidth * r2, dh = img.naturalHeight * r2;
        /* honour object-position where the markup sets one */
        var op = (img.style.objectPosition || getComputedStyle(img).objectPosition || '50% 50%').split(/\s+/);
        var fx = parsePos(op[0]), fy = parsePos(op[1] == null ? op[0] : op[1]);
        c.drawImage(img, P + (inner - dw) * fx, yy + (ih - dh) * fy, dw, dh);
      }
      c.restore();
      yy += ih + (isSch ? 10 : 14);
    }
    if (isQuiz) {
      c.fillStyle = gold; c.font = '600 11.2px ' + tok('--sans', 'sans-serif');
      tracked(c, (txt(el, '.eyebrow') || 'QUICK CHECK').toUpperCase(), P, yy + 10, 0.055 * 11.2);
      yy += 26;
      c.fillStyle = ink; c.font = '600 18.4px ' + tok('--serif', 'Georgia, serif');
      yy = wrap(c, qQ, P, yy + 16, inner, 24) + 2;
      c.font = '400 14.4px ' + tok('--sans', 'sans-serif');
      for (var q = 0; q < qOpts.length; q++) {
        c.strokeStyle = 'rgba(74,53,104,.3)'; c.lineWidth = 1;
        rr(c, P, yy, inner, optH[q], 10); c.stroke();
        c.fillStyle = ink; wrap(c, qOpts[q], P + 14, yy + 20, inner - 28, 20);
        yy += optH[q] + 8;
      }
    } else {
      if (year) {
        c.fillStyle = violet; c.font = '600 11.2px ' + tok('--sans', 'sans-serif');
        tracked(c, year.toUpperCase(), P, yy + 10, 0.055 * 11.2);
        yy += 11.2 * 1.1 + 6;
      }
      if (title) {
        c.fillStyle = ink;
        c.font = '600 ' + (isSch ? 16.8 : 21) + 'px ' + tok('--serif', 'Georgia, serif');
        yy = wrap(c, title, P, yy + (isSch ? 14 : 18), inner, isSch ? 20 : 25) - (isSch ? 20 : 25) + (isSch ? 4 : 8);
      }
      if (blurb) {
        c.fillStyle = dim;
        c.font = '400 ' + (isSch ? 12.5 : 14.4) + 'px ' + tok('--sans', 'sans-serif');
        yy = wrap(c, blurb, P, yy + (isSch ? 12 : 14), inner, isSch ? 17 : 22) - (isSch ? 17 : 22) + (isSch ? 0 : 12);
      }
      if (lensCap) {
        c.fillStyle = dim; c.font = '600 9.9px ' + tok('--sans', 'sans-serif');
        var cw = c.measureText(lensCap.toUpperCase()).width + lensCap.length * 0.545;
        tracked(c, lensCap.toUpperCase(), P + (inner - cw) / 2, yy + 14, 0.055 * 9.9);
        yy += 8 + 10;
      }
      if (hint) {
        c.fillStyle = gold; c.font = '600 11.8px ' + tok('--sans', 'sans-serif');
        c.fillText(hint, P, yy + 12);
      }
    }
    drawGrain(c, W, H, isSch ? 0.6 : 1);
    return { canvas: cv, w: W, h: H };
  }
  function parsePos(v) {
    if (!v) return 0.5;
    if (v === 'left' || v === 'top') return 0;
    if (v === 'right' || v === 'bottom') return 1;
    if (v === 'center') return 0.5;
    var n = parseFloat(v);
    return isNaN(n) ? 0.5 : Math.max(0, Math.min(1, n / 100));
  }

  /* =================================================================
     SHADOW · one pre-blurred sprite, reused. The DOM cards each carry a
     72px-blur box-shadow; that blur is exactly what re-rasterizes on a
     scale change, so it becomes a texture here and costs nothing.
     ================================================================= */
  var SHADOW = null;
  function shadowTex(THREE) {
    if (SHADOW) return SHADOW;
    var cv = document.createElement('canvas'); cv.width = cv.height = 256;
    var c = cv.getContext('2d');
    var g = c.createRadialGradient(128, 116, 18, 128, 128, 126);
    g.addColorStop(0, 'rgba(5,2,12,.55)'); g.addColorStop(1, 'rgba(5,2,12,0)');
    c.fillStyle = g; c.fillRect(0, 0, 256, 256);
    SHADOW = new THREE.CanvasTexture(cv);
    SHADOW.colorSpace = THREE.SRGBColorSpace;
    return SHADOW;
  }

  /* =================================================================
     SETUP
     ================================================================= */
  GL.init = function (canvas) {
    if (!window.THREE || !webglOK()) return false;
    var THREE = window.THREE;
    try {
      GL.renderer = new THREE.WebGLRenderer({
        canvas: canvas, antialias: true, alpha: true,
        powerPreference: 'high-performance'
      });
    } catch (e) { return false; }
    GL.renderer.setPixelRatio(GL._dpr);
    GL.renderer.setClearColor(0x000000, 0);      /* the shader wall shows through */
    GL.scene = new THREE.Scene();
    GL.camera = new THREE.PerspectiveCamera(40, 1, 40, 20000);
    GL.world = new THREE.Group();
    GL.scene.add(GL.world);
    GL._ray = new THREE.Raycaster();
    GL._ndc = new THREE.Vector2(-2, -2);
    GL.ok = true;
    try { ENV.build(); } catch (e) { ENV.ok = false; }
    GL.resize();
    return true;
  };

  GL.resize = function () {
    if (!GL.ok) return;
    var w = window.innerWidth, h = window.innerHeight;
    GL.renderer.setSize(w, h, false);
    GL.camera.aspect = w / h;
    /* the CSS perspective, converted to a field of view, so the GL room
       projects exactly like the DOM room it replaces */
    GL.camera.fov = 2 * Math.atan((h / 2) / GL._persp) * 180 / Math.PI;
    GL.camera.position.set(0, 0, GL._persp);
    GL.camera.updateProjectionMatrix();
    ENV.resize(Math.round(w * GL._dpr), Math.round(h * GL._dpr));
  };

  /* Read a piece's placement out of the custom properties LAYOUT wrote.
     This is the whole reason the layouts are not duplicated here. */
  function readPlace(el) {
    var cs = getComputedStyle(el);
    var n = function (p) { return parseFloat(cs.getPropertyValue(p)) || 0; };
    return { px: n('--px'), py: n('--py'), pz: n('--pz'), pry: n('--pry') };
  }

  /* Build the GL mirror of a room. Called after the DOM room is built and
     laid out, so every piece has a real width and its custom properties
     are resolved. */
  GL.buildRoom = function (roomEl, kind, pieces) {
    if (!GL.ok) return;
    var THREE = window.THREE;
    GL.clear();
    GL._roomEl = roomEl; GL._kind = kind;

    for (var i = 0; i < pieces.length; i++) {
      var el = pieces[i].elm || pieces[i];
      /* offsetWidth, NOT getBoundingClientRect().width. The pieces hang in
         a perspective scene, so the bounding box is the PROJECTED size —
         a card at -780px reports ~106px instead of its real 520 — and
         painting the texture at that size gave the far cards a blurry,
         under-resolved stock that sharpened as you walked toward them.
         offsetWidth is the layout width, which is what the card actually
         is before the camera has an opinion about it. */
      var cssW = el.offsetWidth || parseFloat(getComputedStyle(el).width) || 420;
      var painted;
      try { painted = paintPiece(el, cssW); }
      catch (e) { continue; }            /* one bad card must not kill the room */

      var tex = new THREE.CanvasTexture(painted.canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(8, GL.renderer.capabilities.getMaxAnisotropy());
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      var mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
      var mesh = new THREE.Mesh(new THREE.PlaneGeometry(painted.w, painted.h), mat);

      var sh = new THREE.Mesh(
        new THREE.PlaneGeometry(painted.w * 1.5, painted.h * 1.5),
        new THREE.MeshBasicMaterial({ map: shadowTex(THREE), transparent: true, depthWrite: false }));
      sh.position.set(0, -painted.h * 0.10, -40);

      var g = new THREE.Group();
      g.add(sh); g.add(mesh);
      GL.world.add(g);

      var place = readPlace(el);
      GL.items.push({
        el: el, mesh: mesh, group: g, shadow: sh, idx: i,
        w: painted.w, h: painted.h,
        px: place.px, py: place.py, pz: place.pz, pry: place.pry,
        op: 1, hover: 0
      });
      mesh.userData.glIndex = GL.items.length - 1;
      /* DOM focus drives the GL highlight, so Tab still lights the work
         a keyboard visitor is standing in front of */
      el.addEventListener('focus', onDomFocus, true);
      el.addEventListener('blur', onDomBlur, true);
    }
    GL.place();
    GL.active = GL.items.length > 0;
    if (GL.active) {
      roomEl.classList.add('gl-on');
      try {
        GL.renderer.compile(GL.scene, GL.camera);
        for (var k = 0; k < GL.items.length; k++) GL.renderer.initTexture(GL.items[k].mesh.material.map);
        GL.renderer.initTexture(shadowTex(THREE));
      } catch (e) {}
    }
    return GL.active;
  };

  function onDomFocus(e) {
    for (var i = 0; i < GL.items.length; i++) if (GL.items[i].el === e.currentTarget) { GL._focus = i; return; }
  }
  function onDomBlur() { GL._focus = -1; }

  /* Re-read placements after a resize: LAYOUT rewrites the custom
     properties (the wall offset is viewport-dependent), and the cards are
     repainted because their CSS width changed. */
  GL.relayout = function (pieces) {
    if (!GL.ok || !GL.active) return;
    for (var i = 0; i < GL.items.length; i++) {
      var it = GL.items[i], p = readPlace(it.el);
      it.px = p.px; it.py = p.py; it.pz = p.pz; it.pry = p.pry;
    }
    GL.place();
  };

  /* Static placement — everything that does not change per frame. CSS y
     runs downward and rotateY turns about a y-down axis, so both flip. */
  GL.place = function () {
    for (var i = 0; i < GL.items.length; i++) {
      var it = GL.items[i];
      it.group.position.set(it.px, -it.py, it.pz);
      it.group.rotation.y = -it.pry * Math.PI / 180;
    }
  };

  /* =================================================================
     PER FRAME
     `st` is the gallery's own state, passed in rather than reached for,
     so this module has no opinion about where the camera comes from.
       st.camZ   the camera scalar the room's branch already computes
       st.lookX/Y  the smoothed cursor pair
       st.opacity(i)  the room's own fade curve, unchanged
       st.ringA  orbit only: the ring's angle in degrees
     ================================================================= */
  GL.frame = function (st) {
    if (!GL.ok) return;
    /* The environment is drawn even when no room is mounted — it IS the
       room's wall, and the directory stands in front of it too. */
    ENV.frame(st.lookX || 0, st.lookY || 0, st.now || performance.now());
    if (!GL.active) { GL.renderer.render(GL.scene, GL.camera); return; }
    var TUNE = st.tune || { camRotY: 3.5, camRotX: 2, camTX: 20, camTY: 14 };
    var lookY = -st.lookX * TUNE.camRotY * Math.PI / 180;
    var lookX = -st.lookY * TUNE.camRotX * Math.PI / 180;
    GL.world.rotation.set(-lookX, -lookY, 0, 'YXZ');
    GL.world.position.set(st.worldX || 0, -(st.worldY || 0), st.worldZ || 0);

    /* the orbit room turns the ring, not the visitor */
    if (GL._kind === 'orbit') {
      var a = (st.ringA || 0) * Math.PI / 180;
      for (var r = 0; r < GL.items.length; r++) {
        var itr = GL.items[r];
        var ang = -itr.pry * Math.PI / 180 - a;
        itr.group.position.set(Math.sin(ang) * -itr.pz, -itr.py, -Math.cos(ang) * -itr.pz);
        itr.group.rotation.y = ang;
      }
    }

    for (var i = 0; i < GL.items.length; i++) {
      var it = GL.items[i];
      var o = st.opacity ? st.opacity(i) : 1;
      it.op = o;
      it.mesh.material.opacity = o;
      it.shadow.material.opacity = o * 0.8;
      it.mesh.visible = it.shadow.visible = o > 0.004;
      /* hover/focus lift — the .frame scale(1.03) the DOM does on hover */
      var want = (i === GL._hover || i === GL._focus) && o > 0.25 ? 1 : 0;
      it.hover += (want - it.hover) * 0.18;
      var s = 1 + it.hover * 0.03;
      it.group.scale.setScalar(s);
    }
    GL.renderer.render(GL.scene, GL.camera);
  };

  /* =================================================================
     POINTER · raycast, then hand the event to the real element, so every
     existing listener (openDetail, answerQuiz, setReel) still runs.
     ================================================================= */
  GL.pointerMove = function (x, y) {
    if (!GL.ok || !GL.active) return -1;
    GL._ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    GL._ray.setFromCamera(GL._ndc, GL.camera);
    var meshes = [];
    for (var i = 0; i < GL.items.length; i++) if (GL.items[i].op > 0.25) meshes.push(GL.items[i].mesh);
    var hit = GL._ray.intersectObjects(meshes, false);
    GL._hover = hit.length ? hit[0].object.userData.glIndex : -1;
    return GL._hover;
  };
  GL.hoveredEl = function () {
    return GL._hover >= 0 && GL.items[GL._hover] ? GL.items[GL._hover].el : null;
  };
  /* Where a work actually is ON SCREEN. The wall spotlight aims at the
     piece it is lighting, and it used to read that from the element's
     bounding box — which stops moving the moment the camera lives here.
     Projecting the mesh centre gives the same answer for the room the
     visitor is really looking at. Returns 0..1 of the viewport. */
  GL.screenPos = function (i) {
    var it = GL.items[i];
    if (!it || !window.THREE) return null;
    var v = new window.THREE.Vector3();
    it.group.updateWorldMatrix(true, false);
    v.setFromMatrixPosition(it.group.matrixWorld).project(GL.camera);
    return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
  };
  GL.click = function () {
    var el = GL.hoveredEl();
    if (el) { el.click(); return true; }
    return false;
  };

  /* =================================================================
     TEARDOWN · textures and geometries are GPU memory, and this gallery
     is already tight on it (see the tile-eviction note in Gallery.html).
     Every room change disposes rather than leaking.
     ================================================================= */
  /* called when the room, its category tint or the palette changes */
  GL.retint = function () { try { ENV.repaint(); } catch (e) {} };

  GL.clear = function () {
    if (!GL.ok) return;
    for (var i = 0; i < GL.items.length; i++) {
      var it = GL.items[i];
      it.el.removeEventListener('focus', onDomFocus, true);
      it.el.removeEventListener('blur', onDomBlur, true);
      it.mesh.geometry.dispose();
      if (it.mesh.material.map) it.mesh.material.map.dispose();
      it.mesh.material.dispose();
      it.shadow.geometry.dispose(); it.shadow.material.dispose();
      GL.world.remove(it.group);
    }
    GL.items.length = 0;
    GL._hover = GL._focus = -1;
    GL.active = false;
    if (GL._roomEl) GL._roomEl.classList.remove('gl-on');
    GL._roomEl = null; GL._kind = null;
  };

  root.GLRoom = GL;
})(window);
