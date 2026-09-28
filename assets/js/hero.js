/* =========================================================
   Hero portrait — rendered like a diffusion model sampling.
   Pure noise → 50 denoising steps → Amal. Hover to re-noise.
   One WebGL quad, renders on demand only.
   ========================================================= */
(() => {
  'use strict';

  const root = document.documentElement;
  const fig = document.getElementById('figure');
  const canvas = document.getElementById('portraitGL');
  if (!fig || !canvas) return;

  const img = fig.querySelector('.figure-img');
  const hud = {
    step: document.getElementById('hudStep'),
    seed: document.getElementById('hudSeed'),
    bar: document.getElementById('hudBar'),
    state: document.getElementById('hudState'),
    btn: document.getElementById('resample'),
  };
  const STEPS = 50;
  const TRAIL = 16;
  const reduce = root.classList.contains('reduce');

  const setHud = (step, state) => {
    if (hud.step) hud.step.textContent = String(step).padStart(2, '0');
    if (hud.bar) hud.bar.style.transform = `scaleX(${step / STEPS})`;
    if (state && hud.state) hud.state.textContent = state;
  };
  const fallback = () => {
    root.classList.remove('gl-on');
    root.classList.add('no-gl');
    setHud(STEPS, 'denoised');
    if (hud.btn) hud.btn.hidden = true;
  };

  let gl = null;
  if (!reduce) {
    try {
      gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power' });
    } catch (e) { gl = null; }
  }
  if (!gl) { fallback(); return; }

  /* ---------- shaders ---------- */
  const VERT = `
    attribute vec2 p;
    varying vec2 vUv;
    void main() { vUv = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }
  `;
  const FRAG = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uTex;
    uniform vec2 uRes;
    uniform float uNoise;
    uniform float uStep;
    uniform float uSeed;
    uniform float uDark;
    uniform vec3 uTrail[${TRAIL}];

    float h12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * .1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
      vec2 uv = vUv;
      float aspect = uRes.x / uRes.y;

      // noise level: global sampler schedule + local cursor brush
      float L = uNoise;
      vec2 pa = vec2(uv.x * aspect, uv.y);
      for (int i = 0; i < ${TRAIL}; i++) {
        vec3 t = uTrail[i];
        vec2 d = pa - vec2(t.x * aspect, t.y);
        L = max(L, t.z * exp(-dot(d, d) * 70.0));
      }
      L = clamp(L, 0.0, 1.0);

      // progressive resolution: noisy steps live in a coarse "latent" grid
      float bs = max(1.0, floor(pow(L, 1.6) * uRes.y * .022));
      vec2 cell = floor(uv * uRes / bs);
      vec2 suv = bs > 1.0 ? (cell + .5) * bs / uRes : uv;
      vec4 c = texture2D(uTex, suv);

      // warm rim light — the sun sits right behind the head
      vec2 o = 4.0 / uRes;
      float ae = .25 * (texture2D(uTex, suv + vec2(o.x, 0.)).a + texture2D(uTex, suv - vec2(o.x, 0.)).a
                      + texture2D(uTex, suv + vec2(0., o.y)).a + texture2D(uTex, suv - vec2(0., o.y)).a);
      float rim = clamp((c.a - ae) * 2.4, 0., 1.);
      float upper = 1. - smoothstep(.18, .62, uv.y);
      c.rgb += vec3(1., .66, .22) * rim * upper * mix(.45, 1.1, uDark) * c.a;

      // gaussian-ish noise per latent cell, re-rolled on every sampler step
      vec2 ns = cell + vec2(uSeed, uStep * 7.13);
      vec3 n = vec3(h12(ns), h12(ns + 17.1), h12(ns + 43.7));
      n = (n + vec3(h12(ns + 3.3), h12(ns + 9.9), h12(ns + 27.2))) * .5;
      vec3 ink = mix(vec3(.07, .075, .09), vec3(.93, .91, .87), uDark);
      vec3 paper = mix(vec3(.95, .93, .89), vec3(.08, .08, .1), uDark);
      vec3 col = mix(ink, paper, smoothstep(.2, .8, n.r));
      col = mix(col, n * 1.1, .35);
      col = mix(col, vec3(1., .6, .12), step(.8, n.g) * .85);

      // noise lives inside a soft ellipse that dissolves at its edge
      vec2 e = (uv - vec2(.5, .44)) / vec2(.52, .6);
      float m = 1. - smoothstep(.55, 1., length(e));
      float an = step(h12(ns + 91.7), m);
      vec4 noisy = vec4(col * an, an);

      vec4 outc = mix(c, noisy, L);
      outc *= 1. - smoothstep(.8, .99, uv.y);
      gl_FragColor = outc;
    }
  `;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { fallback(); return; }
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { fallback(); return; }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aP = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(aP);
  gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  ['uTex', 'uRes', 'uNoise', 'uStep', 'uSeed', 'uDark', 'uTrail'].forEach(n => { U[n] = gl.getUniformLocation(prog, n); });
  gl.uniform1i(U.uTex, 0);

  /* ---------- state ---------- */
  const trail = [];            // {x, y, t, s}
  const trailBuf = new Float32Array(TRAIL * 3);
  let ready = false;
  let visible = true;
  let raf = 0;
  let seed = 0;
  let sampleStart = -1;        // ms timestamp, -1 = not sampling
  const SAMPLE_MS = 2600;
  let lastStep = -1;
  let scrollNoise = 0;
  let drawnScrollNoise = -1;
  let dark = root.dataset.theme === 'dark' ? 1 : 0;

  // cosine noise schedule: sqrt(1 - alpha_bar(t))
  const schedule = (p) => {
    if (p >= 1) return 0;
    const t = 1 - p, s = .008;
    return Math.sin(((t + s) / (1 + s)) * Math.PI / 2);
  };

  const resize = () => {
    const r = fig.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2, (1465 * 1.1) / r.height);
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      kick();
    }
  };

  const startSampling = () => {
    seed = Math.floor(Math.random() * 9000) + 1000;
    if (hud.seed) hud.seed.textContent = seed;
    sampleStart = performance.now();
    lastStep = -1;
    setHud(0, 'sampling');
    kick();
  };

  function update(now) {
    let busy = false;
    let noise = 0;
    let step = STEPS;

    if (sampleStart >= 0) {
      const p = Math.min(1, (now - sampleStart) / SAMPLE_MS);
      step = Math.min(STEPS, Math.floor(p * STEPS));
      noise = schedule(step / STEPS);
      if (step !== lastStep) {
        lastStep = step;
        setHud(step, step >= STEPS ? 'denoised ✓' : 'sampling');
      }
      if (p >= 1) sampleStart = -1; else busy = true;
    }

    // decay cursor trail
    for (let i = trail.length - 1; i >= 0; i--) {
      const age = (now - trail[i].t) / 900;
      trail[i].s = age >= 1 ? 0 : .95 * Math.pow(1 - age, 1.4);
      if (trail[i].s <= 0) trail.splice(i, 1);
    }
    trailBuf.fill(0);
    for (let i = 0; i < trail.length && i < TRAIL; i++) {
      trailBuf[i * 3] = trail[i].x;
      trailBuf[i * 3 + 1] = trail[i].y;
      trailBuf[i * 3 + 2] = trail[i].s;
    }
    if (trail.length) busy = true;

    noise = Math.max(noise, scrollNoise);
    drawnScrollNoise = scrollNoise;
    return { busy, noise, step };
  }

  function draw(noise, step) {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uNoise, noise);
    // while sampling the noise re-rolls per step; afterwards the cursor brush flickers on its own clock
    gl.uniform1f(U.uStep, sampleStart >= 0 ? step : Math.floor(performance.now() / 70) % 997);
    gl.uniform1f(U.uSeed, seed % 997);
    gl.uniform1f(U.uDark, dark);
    gl.uniform3fv(U.uTrail, trailBuf);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function frame(now) {
    raf = 0;
    if (!ready) return;
    const { busy, noise, step } = update(now);
    draw(noise, step);
    if (busy && visible) raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (!raf && ready && visible) raf = requestAnimationFrame(frame);
  }

  /* ---------- texture ---------- */
  const tex = gl.createTexture();
  const source = new Image();
  source.decoding = 'async';
  source.onload = () => {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    ready = true;
    root.classList.add('gl-on');
    resize();
    // first frame is pure noise, then sample once the intro starts
    draw(1, 0);
    setTimeout(startSampling, 350);
  };
  source.onerror = fallback;
  source.src = img ? img.currentSrc || img.src : 'assets/img/amal-cutout.webp';

  /* ---------- interaction ---------- */
  const toUv = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  let lastPush = 0;
  fig.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const now = performance.now();
    const p = toUv(e);
    const last = trail[trail.length - 1];
    if (last && now - lastPush < 24 && Math.hypot(p.x - last.x, p.y - last.y) < .015) return;
    lastPush = now;
    trail.push({ x: p.x, y: p.y, t: now, s: .95 });
    if (trail.length > TRAIL) trail.shift();
    kick();
  }, { passive: true });

  fig.addEventListener('pointerdown', (e) => {
    const now = performance.now();
    const p = toUv(e);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      trail.push({ x: p.x + Math.cos(a) * .05, y: p.y + Math.sin(a) * .035, t: now, s: 1 });
    }
    while (trail.length > TRAIL) trail.shift();
    kick();
  });

  if (hud.btn) hud.btn.addEventListener('click', startSampling);

  // dissolve back into latent noise as the hero scrolls away
  const hero = document.getElementById('top');
  const onScroll = () => {
    const h = hero ? hero.offsetHeight : window.innerHeight;
    const p = window.scrollY / h;
    const t = Math.min(1, Math.max(0, (p - .22) / .7));
    scrollNoise = t * t * (3 - 2 * t) * .9;
    if (Math.abs(scrollNoise - drawnScrollNoise) > .002) kick();
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible) kick();
  }).observe(fig);

  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(fig);
  else window.addEventListener('resize', resize);

  new MutationObserver(() => {
    dark = root.dataset.theme === 'dark' ? 1 : 0;
    kick();
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); ready = false; fallback(); });
})();
