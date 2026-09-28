/* =========================================================
   Live project sketches — one tiny canvas simulation per
   project. Only canvases on screen are drawn.
   ========================================================= */
(() => {
  'use strict';

  const reduce = document.documentElement.classList.contains('reduce');
  const canvases = [...document.querySelectorAll('canvas[data-sketch]')];
  if (!canvases.length) return;

  /* ---------- palette + helpers ---------- */
  const BG = '#111216';
  const P = (a) => `rgba(239,236,228,${a})`;
  const SUN = '#ffb81f';
  const SUN2 = '#ff6a1a';
  const SUNA = (a) => `rgba(255,184,31,${a})`;
  const MONO = '"JetBrains Mono", ui-monospace, monospace';
  const GLYPHS = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const eout = (t) => 1 - Math.pow(1 - t, 3);
  const rnd = (seed) => { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  const font = (ctx, px, w = 500) => { ctx.font = `${w} ${px}px ${MONO}`; };
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function brackets(ctx, x, y, w, h, color, len, lw = 1.5) {
    len = Math.min(len, w * .4, h * .4);
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y);
    ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len);
    ctx.moveTo(x + w, y + h - len); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - len, y + h);
    ctx.moveTo(x + len, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - len);
    ctx.stroke();
  }
  function tag(ctx, str, x, y, bg, fg, px = 10) {
    font(ctx, px);
    const tw = ctx.measureText(str).width;
    const hh = px + 7;
    ctx.fillStyle = bg;
    ctx.fillRect(x, y - hh, tw + 10, hh);
    ctx.fillStyle = fg;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(str, x + 5, y - hh / 2 + .5);
  }
  function text(ctx, str, x, y, color, px = 10, align = 'left') {
    font(ctx, px);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
    ctx.textAlign = 'left';
  }
  // fit a dw×dh design box under the 38px "live" tag band, centered
  function fit(ctx, w, h, dw, dh) {
    const top = 40, bottom = 10, side = 12;
    const aw = w - side * 2, ah = h - top - bottom;
    const s = Math.max(.1, Math.min(aw / dw, ah / dh));
    ctx.translate((w - dw * s) / 2, top + (ah - dh * s) / 2);
    ctx.scale(s, s);
  }
  const bez = (x0, y0, x1, y1, x2, y2, x3, y3, t) => {
    const u = 1 - t;
    return [
      u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
      u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
    ];
  };
  const bez2 = (a, c, b, t) => {
    const u = 1 - t;
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
  };

  function makeBg(w, h, dpr) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(h * dpr));
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    g.fillStyle = BG;
    g.fillRect(0, 0, w, h);
    g.fillStyle = P(.085);
    const st = 18;
    for (let x = st / 2; x < w; x += st) for (let y = st / 2; y < h; y += st) g.fillRect(x - .6, y - .6, 1.2, 1.2);
    const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .2, w / 2, h / 2, Math.max(w, h) * .75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,.4)');
    g.fillStyle = vg;
    g.fillRect(0, 0, w, h);
    return c;
  }

  /* ---------- little characters ---------- */
  function drawChar(ctx, x, ground, t) {
    const hop = Math.abs(Math.sin(t * 3.2));
    const squash = hop < .16 ? (1 - hop / .16) * .16 : 0;
    const y = ground - hop * 30;
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath();
    ctx.ellipse(x, ground + 2, 22 * (1 - hop * .45), 4, 0, 0, Math.PI * 2);
    ctx.fill();
    const bw = 22 * (1 + squash), bh = 24 * (1 - squash);
    ctx.fillStyle = '#efece4';
    ctx.beginPath();
    ctx.ellipse(x, y - bh, bw, bh, 0, 0, Math.PI * 2);
    ctx.fill();
    // sprout — the character's identity mark, kept consistent frame to frame
    ctx.strokeStyle = '#efece4';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x, y - bh * 2 + 1);
    ctx.quadraticCurveTo(x + 2, y - bh * 2 - 10, x + 7, y - bh * 2 - 12);
    ctx.stroke();
    ctx.fillStyle = SUN;
    ctx.beginPath();
    ctx.ellipse(x + 10, y - bh * 2 - 13, 6, 3.4, -.5, 0, Math.PI * 2);
    ctx.fill();
    const look = Math.sin(t * 1.1) * 3;
    ctx.fillStyle = BG;
    ctx.beginPath();
    ctx.arc(x - 7 + look, y - bh * 1.15, 2.8, 0, Math.PI * 2);
    ctx.arc(x + 7 + look, y - bh * 1.15, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,106,26,.75)';
    ctx.beginPath();
    ctx.arc(x - 13 + look * .5, y - bh * .8, 3.2, 0, Math.PI * 2);
    ctx.arc(x + 13 + look * .5, y - bh * .8, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function buildFace() {
    const zf = (x, y) => Math.sqrt(Math.max(0, 1 - (x / .56) ** 2 - (y / .78) ** 2)) * .42;
    const p3 = (x, y, dz = 0) => [x, y, zf(x, y) + dz];
    const groups = [];
    const jaw = [];
    for (let i = 0; i <= 16; i++) { const a = Math.PI - Math.PI * i / 16; jaw.push(p3(.46 * Math.cos(a), .08 + .5 * Math.sin(a))); }
    groups.push({ pts: jaw });
    [-1, 1].forEach((sd) => {
      const b = [];
      for (let i = 0; i < 5; i++) { const f = i / 4; b.push(p3(sd * (.07 + f * .27), -.2 - Math.sin(f * Math.PI) * .05)); }
      groups.push({ pts: b });
    });
    [-1, 1].forEach((sd) => {
      const e = [];
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; e.push(p3(sd * .19 + Math.cos(a) * .085, -.08 + Math.sin(a) * .035)); }
      groups.push({ pts: e, closed: true, key: true });
    });
    groups.push({ pts: [p3(0, -.14, .02), p3(0, -.06, .06), p3(0, .02, .1), p3(0, .1, .14)] });
    groups.push({ pts: [p3(-.08, .15, .04), p3(-.04, .17, .07), p3(0, .18, .09), p3(.04, .17, .07), p3(.08, .15, .04)] });
    const mo = [];
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; mo.push(p3(Math.cos(a) * .15, .33 + Math.sin(a) * .055)); }
    groups.push({ pts: mo, closed: true });
    return { groups, noseTip: p3(0, .1, .14) };
  }

  function drawItem(ctx, kind, hl) {
    ctx.beginPath();
    switch (kind) {
      case 0: ctx.arc(0, 0, 8.5, 0, Math.PI * 2); break;
      case 1: ctx.rect(-7.5, -7.5, 15, 15); break;
      case 2: ctx.moveTo(0, -9); ctx.lineTo(8.5, 7); ctx.lineTo(-8.5, 7); ctx.closePath(); break;
      case 3: ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.moveTo(4, 0); ctx.arc(0, 0, 4, 0, Math.PI * 2); break;
      case 4: ctx.moveTo(-7, -7); ctx.lineTo(7, 7); ctx.moveTo(7, -7); ctx.lineTo(-7, 7); break;
      default: // mug
        rr(ctx, -9, -8, 13, 16, 3);
        ctx.moveTo(4, -4);
        ctx.arc(5, 0, 4.5, -Math.PI / 2, Math.PI / 2);
        if (hl) { ctx.fillStyle = SUNA(.3); ctx.fill(); }
    }
    ctx.stroke();
  }

  /* =========================================================
     The sketches: (ctx, w, h, t seconds, state)
     ========================================================= */
  const S = {
    /* 01 — Object detection ------------------------------------------ */
    detect(ctx, w, h, t, s) {
      if (!s.o) {
        const kinds = ['car', 'person', 'bike', 'car', 'person', 'dog'];
        s.o = kinds.map((k, i) => ({ k, lane: i, sp: .03 + rnd(i + 1) * .04, ph: rnd(i + 9), conf: .86 + rnd(i + 20) * .12, b: null }));
      }
      const hy = h * .3;
      ctx.strokeStyle = P(.07);
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = -8; i <= 8; i++) { ctx.moveTo(w / 2 + i * w * .015, hy); ctx.lineTo(w / 2 + i * w * .22, h); }
      for (let j = 0; j < 8; j++) { const f = ((j / 8) + t * .08) % 1; const yy = hy + (h - hy) * f * f; ctx.moveTo(0, yy); ctx.lineTo(w, yy); }
      ctx.stroke();
      ctx.strokeStyle = P(.2);
      ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(w, hy); ctx.stroke();

      const u = Math.min(h / 300, w / 380);
      for (const o of s.o) {
        const f = .16 + o.lane * .135;
        const ly = hy + (h - hy) * f;
        const b = 26 * (.5 + f * .9) * u;
        const dir = o.lane % 2 ? -1 : 1;
        const x = (((o.ph + t * o.sp * dir) % 1) + 1) % 1;
        const px = (x * 1.3 - .15) * w;
        const sw = Math.sin(t * 7 + o.ph * 20) * .28 * b;
        let box;
        ctx.strokeStyle = P(.62);
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        if (o.k === 'car') {
          rr(ctx, px - 1.2 * b, ly - .95 * b, 2.4 * b, .7 * b, .2 * b);
          ctx.moveTo(px - .75 * b, ly - .95 * b); ctx.lineTo(px - .45 * b, ly - 1.42 * b);
          ctx.lineTo(px + .5 * b, ly - 1.42 * b); ctx.lineTo(px + .8 * b, ly - .95 * b);
          ctx.moveTo(px - .44 * b, ly - .25 * b); ctx.arc(px - .7 * b, ly - .25 * b, .26 * b, 0, Math.PI * 2);
          ctx.moveTo(px + .96 * b, ly - .25 * b); ctx.arc(px + .7 * b, ly - .25 * b, .26 * b, 0, Math.PI * 2);
          box = [px - 1.3 * b, ly - 1.55 * b, 2.6 * b, 1.55 * b];
        } else if (o.k === 'person') {
          ctx.moveTo(px + .2 * b, ly - 1.95 * b); ctx.arc(px, ly - 1.95 * b, .2 * b, 0, Math.PI * 2);
          ctx.moveTo(px, ly - 1.72 * b); ctx.lineTo(px, ly - .95 * b);
          ctx.moveTo(px, ly - .95 * b); ctx.lineTo(px + sw, ly);
          ctx.moveTo(px, ly - .95 * b); ctx.lineTo(px - sw, ly);
          ctx.moveTo(px, ly - 1.55 * b); ctx.lineTo(px - sw * .8, ly - 1.1 * b);
          ctx.moveTo(px, ly - 1.55 * b); ctx.lineTo(px + sw * .8, ly - 1.1 * b);
          box = [px - .55 * b, ly - 2.25 * b, 1.1 * b, 2.25 * b];
        } else if (o.k === 'bike') {
          ctx.moveTo(px - .25 * b, ly - .35 * b); ctx.arc(px - .6 * b, ly - .35 * b, .35 * b, 0, Math.PI * 2);
          ctx.moveTo(px + .95 * b, ly - .35 * b); ctx.arc(px + .6 * b, ly - .35 * b, .35 * b, 0, Math.PI * 2);
          ctx.moveTo(px - .6 * b, ly - .35 * b); ctx.lineTo(px - .1 * b, ly - .95 * b); ctx.lineTo(px + .6 * b, ly - .35 * b);
          ctx.moveTo(px - .1 * b, ly - .95 * b); ctx.lineTo(px + .45 * b, ly - 1.05 * b);
          ctx.moveTo(px + .07 * b, ly - 1.75 * b); ctx.arc(px - .1 * b, ly - 1.75 * b, .17 * b, 0, Math.PI * 2);
          ctx.moveTo(px - .15 * b, ly - 1.55 * b); ctx.lineTo(px - .2 * b, ly - .98 * b);
          ctx.moveTo(px - .15 * b, ly - 1.4 * b); ctx.lineTo(px + .42 * b, ly - 1.08 * b);
          box = [px - 1.02 * b, ly - 2 * b, 2.04 * b, 2 * b];
        } else {
          ctx.ellipse(px, ly - .55 * b, .55 * b, .22 * b, 0, 0, Math.PI * 2);
          ctx.moveTo(px + (.62 + .18) * b * dir, ly - .82 * b); ctx.arc(px + .62 * b * dir, ly - .82 * b, .18 * b, 0, Math.PI * 2);
          ctx.moveTo(px - .35 * b, ly - .4 * b); ctx.lineTo(px - .35 * b + sw * .5, ly);
          ctx.moveTo(px + .35 * b, ly - .4 * b); ctx.lineTo(px + .35 * b - sw * .5, ly);
          ctx.moveTo(px - .55 * b * dir, ly - .6 * b); ctx.lineTo(px - .85 * b * dir, ly - .95 * b);
          box = [px - .95 * b, ly - 1.1 * b, 1.9 * b, 1.1 * b];
        }
        ctx.stroke();
        // real detectors jitter a little frame to frame
        const jt = Math.floor(t * 9) + o.lane * 17;
        o.b = box.map((v, k) => v + (rnd(jt + k * 3.3) - .5) * (k < 2 ? 2.4 : 3.2));
        const col = o.k === 'person' ? SUN : o.k === 'car' ? P(.92) : SUN2;
        const cf = o.conf + Math.sin(t * 3 + o.lane) * .015;
        brackets(ctx, o.b[0], o.b[1], o.b[2], o.b[3], col, 9, 1.5);
        tag(ctx, `${o.k} ${cf.toFixed(2)}`, o.b[0] - .75, o.b[1], col, BG, 9);
      }
      text(ctx, 'yolov8n · 640×640', 14, h - 14, P(.45), 10);
      text(ctx, `${30 + Math.round(Math.sin(t * 1.3) * 2)} fps · ${s.o.length} objects`, w - 14, h - 14, P(.45), 10, 'right');
    },

    /* 02 — License plate recognition --------------------------------- */
    plate(ctx, w, h, t) {
      const plates = ['KL 07 BZ 4821', 'KL 41 C 2090', 'KL 07 CU 5517', 'KL 39 F 7733', 'KL 11 AR 3104'];
      const cyc = 4.4;
      const k = Math.floor(t / cyc) % plates.length;
      const p = (t % cyc) / cyc;
      const str = plates[k];
      fit(ctx, w, h, 360, 270);

      ctx.strokeStyle = P(.18);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      rr(ctx, 30, 40, 300, 168, 46);
      ctx.moveTo(70, 42); ctx.lineTo(104, 2); ctx.lineTo(256, 2); ctx.lineTo(290, 42);
      ctx.stroke();
      ctx.beginPath(); rr(ctx, 48, 74, 70, 26, 10); rr(ctx, 242, 74, 70, 26, 10);
      ctx.fillStyle = P(.05); ctx.fill(); ctx.strokeStyle = P(.3); ctx.stroke();
      ctx.fillStyle = SUNA(.5 + Math.sin(t * 2) * .2);
      ctx.beginPath(); ctx.arc(70, 87, 6, 0, Math.PI * 2); ctx.arc(290, 87, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = P(.14);
      ctx.beginPath();
      for (let i = 0; i < 3; i++) { ctx.moveTo(134, 80 + i * 8); ctx.lineTo(226, 80 + i * 8); }
      ctx.stroke();
      ctx.beginPath(); rr(ctx, 44, 204, 50, 26, 8); rr(ctx, 266, 204, 50, 26, 8); ctx.fillStyle = P(.07); ctx.fill();

      const pw = 196, ph = 44, px = 180 - pw / 2, py = 128;
      ctx.beginPath(); rr(ctx, px, py, pw, ph, 6); ctx.fillStyle = '#efece4'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#121317';
      ctx.beginPath(); rr(ctx, px + 3.5, py + 3.5, pw - 7, ph - 7, 4); ctx.stroke();

      const scan = clamp((p - .12) / .5);
      const sx = lerp(px - 6, px + pw + 6, scan);
      font(ctx, 21, 700);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      const cw = (pw - 20) / str.length;
      let read = '';
      for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (ch === ' ') continue;
        const x = px + 10 + cw * (i + .5);
        if (x < sx) { ctx.fillStyle = '#121317'; ctx.fillText(ch, x, py + ph / 2 + 1); read += ch; }
        else {
          ctx.fillStyle = 'rgba(18,19,23,.26)';
          ctx.fillText(GLYPHS[Math.floor(rnd(Math.floor(t * 16) + i * 7) * GLYPHS.length)], x, py + ph / 2 + 1);
        }
      }
      ctx.textAlign = 'left';
      if (scan > 0 && scan < 1) {
        const gr = ctx.createLinearGradient(sx - 40, 0, sx, 0);
        gr.addColorStop(0, SUNA(0));
        gr.addColorStop(1, SUNA(.45));
        ctx.fillStyle = gr;
        ctx.fillRect(sx - 40, py - 10, 40, ph + 20);
        ctx.fillStyle = SUN;
        ctx.fillRect(sx - 1, py - 14, 2, ph + 28);
      }
      const ep = eout(clamp(p / .14));
      const pad = lerp(60, 8, ep);
      brackets(ctx, px - pad, py - pad * .6, pw + pad * 2, ph + pad * 1.2, SUN, 12, 2);
      if (ep > .9) tag(ctx, 'plate 0.98', px - pad, py - pad * .6, SUN, BG, 10);

      text(ctx, 'ocr ›', 30, 262, P(.5), 12);
      text(ctx, read, 76, 262, P(.95), 12);
      font(ctx, 12);
      if (Math.floor(t * 2.5) % 2) { ctx.fillStyle = SUN; ctx.fillRect(78 + ctx.measureText(read).width, 252, 6, 12); }
      if (p > .66) text(ctx, '✓ gate open', 330, 262, SUN, 12, 'right');
    },

    /* 03 — RAG chatbot ------------------------------------------------ */
    chat(ctx, w, h, t) {
      const cyc = 7.5, c = Math.floor(t / cyc), p = t % cyc;
      fit(ctx, w, h, 360, 270);
      const fade = p > 7 ? 1 - (p - 7) / .5 : 1;
      text(ctx, 'docs · 1,284 chunks', 0, 10, P(.45), 9.5);
      const h1 = c % 6;
      let h2 = (c * 3 + 2) % 6; if (h2 === h1) h2 = (h1 + 3) % 6;
      const hl = [h1, h2];
      const dx = 0, dw = 108, dy0 = 22, dh = 34;
      for (let i = 0; i < 6; i++) {
        const y = dy0 + i * (dh + 7);
        const on = hl.includes(i) && p > 1.3 && p < 7;
        ctx.beginPath(); rr(ctx, dx, y, dw, dh, 7);
        ctx.fillStyle = on ? SUNA(.14) : P(.04); ctx.fill();
        ctx.strokeStyle = on ? SUN : P(.14); ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = on ? SUNA(.85) : P(.2);
        ctx.fillRect(dx + 10, y + 11, 40 + rnd(i * 3.1) * 50, 3);
        ctx.fillRect(dx + 10, y + 20, 26 + rnd(i * 7.7) * 56, 3);
      }

      ctx.globalAlpha = fade;
      const qs = ['reset gate cam 2?', 'fps on the edge box?', 'who entered at 9am?'];
      const q = qs[c % qs.length];
      if (p > .3) {
        const a = eout(clamp((p - .3) / .5));
        font(ctx, 11);
        const bw = ctx.measureText(q).width + 24;
        const bx = 360 - bw + (1 - a) * 24;
        ctx.globalAlpha = fade * a;
        ctx.beginPath(); rr(ctx, bx, 22, bw, 30, 13); ctx.fillStyle = '#efece4'; ctx.fill();
        ctx.fillStyle = BG; ctx.textBaseline = 'middle'; ctx.fillText(q, bx + 12, 37.5);
        ctx.globalAlpha = fade;
      }
      const ax = 146, ay = 76;
      if (p > 1.3) {
        const rp = clamp((p - 1.3) / 1.1);
        hl.forEach((i, n) => {
          const y = dy0 + i * (dh + 7) + dh / 2;
          const x0 = dx + dw, x1 = ax, y1 = ay + 18;
          ctx.strokeStyle = SUNA(.4); ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
          ctx.beginPath(); ctx.moveTo(x0, y); ctx.bezierCurveTo(x0 + 24, y, x1 - 24, y1, x1, y1); ctx.stroke();
          ctx.setLineDash([]);
          if (rp < 1) {
            const pt = bez(x0, y, x0 + 24, y, x1 - 24, y1, x1, y1, clamp(rp * 1.25 - n * .25));
            ctx.fillStyle = SUN; ctx.beginPath(); ctx.arc(pt[0], pt[1], 3, 0, Math.PI * 2); ctx.fill();
          }
        });
        if (p < 2.6) text(ctx, 'retrieving · top-k 2', ax + 4, ay - 6, SUN, 9.5);
      }
      if (p > 2.4) {
        const n = Math.floor(clamp((p - 2.4) / 3) * 28);
        const bw = 214, bx = ax;
        const toks = [];
        let x = bx + 12, y = ay + 13;
        for (let i = 0; i < n; i++) {
          const tw = 10 + rnd(i * 1.7 + c) * 26;
          if (x + tw > bx + bw - 12) { x = bx + 12; y += 14; }
          toks.push([x, y, tw]);
          x += tw + 5;
        }
        const bh = (toks.length ? toks[toks.length - 1][1] - ay : 0) + 22;
        ctx.beginPath(); rr(ctx, bx, ay, bw, bh, 13); ctx.fillStyle = '#1c1d23'; ctx.fill();
        ctx.strokeStyle = P(.12); ctx.stroke();
        toks.forEach((tk, i) => { ctx.fillStyle = i === toks.length - 1 ? SUN : P(.62); ctx.fillRect(tk[0], tk[1], tk[2], 5); });
        if (p > 5.6) {
          ctx.globalAlpha = fade * eout(clamp((p - 5.6) / .4));
          font(ctx, 9);
          ctx.strokeStyle = SUN; ctx.fillStyle = SUN; ctx.textBaseline = 'middle';
          ['[1] manual.pdf', '[2] faq.md'].forEach((cit, i) => {
            const cx = bx + i * 96, cy = ay + bh + 10;
            ctx.beginPath(); rr(ctx, cx, cy, 90, 20, 10); ctx.stroke();
            ctx.fillText(cit, cx + 9, cy + 10.5);
          });
        }
      }
      ctx.globalAlpha = 1;
      text(ctx, 'llm · memory on', 360, 268, P(.4), 9.5, 'right');
    },

    /* 04 — Face recognition ------------------------------------------ */
    face(ctx, w, h, t, s) {
      if (!s.lm) s.lm = buildFace();
      fit(ctx, w, h, 370, 270);
      const cx = 112, cy = 120, SC = 142;
      const yaw = Math.sin(t * .7) * .38, pitch = Math.sin(t * .45) * .12;
      const cyw = Math.cos(yaw), syw = Math.sin(yaw);
      const proj = (pt) => [cx + (pt[0] * cyw + pt[2] * syw) * SC, cy + (pt[1] + pt[2] * pitch * .6) * SC];

      ctx.lineWidth = 1;
      ctx.strokeStyle = P(.07);
      ctx.beginPath();
      const nose = proj(s.lm.noseTip);
      s.lm.groups[0].pts.forEach((pt, i) => { if (i % 2) return; const q = proj(pt); ctx.moveTo(nose[0], nose[1]); ctx.lineTo(q[0], q[1]); });
      ctx.stroke();
      ctx.strokeStyle = P(.3);
      for (const g of s.lm.groups) {
        ctx.beginPath();
        g.pts.forEach((pt, i) => { const q = proj(pt); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
        if (g.closed) ctx.closePath();
        ctx.stroke();
      }
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const g of s.lm.groups) for (const pt of g.pts) {
        const q = proj(pt);
        ctx.fillStyle = g.key ? SUN : P(.92);
        ctx.fillRect(q[0] - 1.4, q[1] - 1.4, 2.8, 2.8);
        x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]);
      }
      const bx = x0 - 20, by = y0 - 38, bw = x1 - x0 + 40, bh = y1 - y0 + 54;
      ctx.fillStyle = SUNA(.55);
      ctx.fillRect(bx + 4, lerp(by, by + bh, (t * .5) % 1), bw - 8, 1.2);
      brackets(ctx, bx, by, bw, bh, SUN, 12, 1.8);
      tag(ctx, 'face 0.99', bx, by, SUN, BG, 9.5);

      const ex = 244, ey = 6;
      text(ctx, 'embedding · 128-d', ex, ey + 4, P(.5), 9);
      for (let i = 0; i < 24; i++) {
        const v = .5 + .5 * Math.sin(i * 2.3 + 1.1) * Math.cos(i * .7);
        const hh = 6 + (v + Math.sin(t * 3 + i) * .06) * 38;
        ctx.fillStyle = i % 5 === 0 ? SUN : P(.55);
        ctx.fillRect(ex + i * 5, ey + 58 - hh, 3, hh);
      }
      text(ctx, 'gallery', ex, ey + 84, P(.5), 9);
      const m = Math.floor(t / 2.4) % 4;
      for (let i = 0; i < 4; i++) {
        const gx = ex + (i % 2) * 60, gy = ey + 94 + Math.floor(i / 2) * 60;
        ctx.beginPath(); rr(ctx, gx, gy, 52, 52, 10);
        ctx.fillStyle = P(.05); ctx.fill();
        ctx.strokeStyle = i === m ? SUN : P(.14); ctx.lineWidth = i === m ? 1.8 : 1; ctx.stroke();
        ctx.fillStyle = i === m ? SUN : P(.3);
        ctx.beginPath(); ctx.arc(gx + 26, gy + 22, 8.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(gx + 26, gy + 50, 16, Math.PI, 0); ctx.fill();
      }
      const ids = ['0042', '0107', '0233', '0318'];
      text(ctx, `match → ID ${ids[m]} · 0.9${7 - m}`, ex, ey + 232, SUN, 9.5);
    },

    /* 05 — Video generation ------------------------------------------ */
    video(ctx, w, h, t) {
      fit(ctx, w, h, 480, 280);
      const fx = 20, fy = 0, fw = 440, fh = 158;
      ctx.beginPath(); rr(ctx, fx, fy, fw, fh, 10); ctx.fillStyle = '#17181d'; ctx.fill();
      ctx.strokeStyle = P(.14); ctx.lineWidth = 1; ctx.stroke();
      ctx.save();
      ctx.beginPath(); rr(ctx, fx, fy, fw, fh, 10); ctx.clip();
      ctx.fillStyle = SUNA(.92);
      ctx.beginPath(); ctx.arc(fx + fw * .76, fy + fh * .4, 32, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#20212a';
      ctx.beginPath();
      ctx.moveTo(fx, fy + fh);
      ctx.quadraticCurveTo(fx + fw * .3, fy + fh * .52, fx + fw * .58, fy + fh * .8);
      ctx.quadraticCurveTo(fx + fw * .8, fy + fh * .6, fx + fw, fy + fh * .74);
      ctx.lineTo(fx + fw, fy + fh);
      ctx.fill();
      drawChar(ctx, fx + fw * .38 + Math.sin(t * 1.1) * 70, fy + fh * .88, t);
      ctx.restore();
      text(ctx, `frame ${String(Math.floor(t * 24) % 120).padStart(3, '0')} / 120`, fx + 12, fy + fh - 12, P(.6), 9.5);
      text(ctx, 'char_ref ✓ locked', fx + fw - 12, fy + 20, SUN, 9.5, 'right');

      const sy = 180, th = 44, n = 6, gap = 6, tw = (fw - gap * (n - 1)) / n;
      const cur = Math.floor(t * 3) % n;
      ctx.fillStyle = P(.14);
      for (let x = fx + 2; x < fx + fw; x += 12) { ctx.fillRect(x, sy - 8, 5, 3); ctx.fillRect(x, sy + th + 5, 5, 3); }
      for (let i = 0; i < n; i++) {
        const x = fx + i * (tw + gap);
        ctx.beginPath(); rr(ctx, x, sy, tw, th, 5); ctx.fillStyle = '#17181d'; ctx.fill();
        ctx.strokeStyle = i === cur ? SUN : P(.12); ctx.lineWidth = i === cur ? 1.6 : 1; ctx.stroke();
        ctx.save();
        ctx.beginPath(); rr(ctx, x, sy, tw, th, 5); ctx.clip();
        ctx.translate(x + tw / 2, sy + th * .9);
        ctx.scale(.4, .4);
        drawChar(ctx, 0, 0, i * .45);
        ctx.restore();
      }
      const wy = 256, nb = 72, bw = fw / nb, play = (t * .22) % 1;
      for (let i = 0; i < nb; i++) {
        const a = Math.abs(Math.sin(i * .55 + t * 5) * Math.sin(i * .13 + t * 1.2)) * 18 + 2;
        ctx.fillStyle = i / nb < play ? SUN : P(.28);
        ctx.fillRect(fx + i * bw, wy - a / 2, Math.max(1, bw - 2), a);
      }
      ctx.fillStyle = P(.9);
      ctx.fillRect(fx + play * fw, wy - 16, 1.5, 32);
      text(ctx, '♪ vocals · malayalam', fx, 280, P(.4), 9);
      text(ctx, 'image → video → audio', fx + fw, 280, P(.4), 9, 'right');
    },

    /* 06 — Multi-camera person tracking ------------------------------ */
    people(ctx, w, h, t, s) {
      if (!s.p) {
        const cols = [SUN, P(.92), SUN2, '#9fb4ff'];
        s.p = [0, 1, 2, 3].map((i) => ({ id: i + 1, lane: i / 3, sp: .1 + rnd(i + 3) * .07, ph: rnd(i + 11) * 2.3, tr: [], lg: -9, col: cols[i] }));
      }
      fit(ctx, w, h, 380, 270);
      const px0 = 0, py0 = 0, pw = 184, ph = 222, gap = 12;
      for (let c = 0; c < 2; c++) {
        const x = px0 + c * (pw + gap);
        ctx.beginPath(); rr(ctx, x, py0, pw, ph, 9); ctx.fillStyle = '#16171c'; ctx.fill();
        ctx.strokeStyle = P(.12); ctx.lineWidth = 1; ctx.stroke();
        ctx.strokeStyle = P(.06);
        ctx.beginPath();
        for (let i = 1; i < 6; i++) { const yy = py0 + ph * (.3 + i * i * .022); ctx.moveTo(x, yy); ctx.lineTo(x + pw, yy); }
        ctx.stroke();
        text(ctx, `CAM 0${c + 1}`, x + 10, py0 + 18, P(.55), 9);
        if (Math.floor(t * 1.5) % 2) { ctx.fillStyle = '#ff4d3a'; ctx.beginPath(); ctx.arc(x + pw - 14, py0 + 15, 3, 0, Math.PI * 2); ctx.fill(); }
      }
      for (const p of s.p) {
        const g = ((p.ph + t * p.sp) % 2.3) - .15;
        if (g < p.lg || g - p.lg > .08) p.tr.length = 0;
        p.lg = g;
        const cam = g < 1 ? 0 : 1;
        const lx = g - cam;
        const panelX = px0 + cam * (pw + gap);
        const x = panelX + lx * pw;
        const y = py0 + ph * (.42 + p.lane * .48);
        p.tr.push([x, y, cam]);
        if (p.tr.length > 46) p.tr.shift();
        ctx.save();
        ctx.beginPath(); rr(ctx, panelX, py0, pw, ph, 9); ctx.clip();
        for (let i = 0; i < p.tr.length; i++) {
          const q = p.tr[i];
          if (q[2] !== cam || i % 2) continue;
          ctx.fillStyle = p.col;
          ctx.globalAlpha = (i / p.tr.length) * .5;
          ctx.fillRect(q[0] - 1, q[1] - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
        const b = 15 + p.lane * 9;
        const sw = Math.sin(t * 8 + p.id * 2) * b * .3;
        ctx.strokeStyle = P(.78); ctx.lineWidth = 1.3; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x + b * .26, y - b * 2.05); ctx.arc(x, y - b * 2.05, b * .26, 0, Math.PI * 2);
        ctx.moveTo(x, y - b * 1.76); ctx.lineTo(x, y - b * .95);
        ctx.moveTo(x, y - b * .95); ctx.lineTo(x + sw, y);
        ctx.moveTo(x, y - b * .95); ctx.lineTo(x - sw, y);
        ctx.moveTo(x, y - b * 1.55); ctx.lineTo(x - sw * .7, y - b * 1.05);
        ctx.moveTo(x, y - b * 1.55); ctx.lineTo(x + sw * .7, y - b * 1.05);
        ctx.stroke();
        brackets(ctx, x - b * .62, y - b * 2.5, b * 1.24, b * 2.6, p.col, 5, 1.4);
        tag(ctx, `ID 0${p.id}`, x - b * .62, y - b * 2.5, p.col, BG, 8);
        ctx.restore();
        if (g > .92 && g < 1.14) {
          ctx.strokeStyle = SUNA(.85); ctx.lineWidth = 1.2; ctx.setLineDash([2, 3]);
          ctx.beginPath(); ctx.moveTo(px0 + pw - 6, y - b); ctx.quadraticCurveTo(px0 + pw + gap / 2, y - b - 34, px0 + pw + gap + 6, y - b); ctx.stroke();
          ctx.setLineDash([]);
          tag(ctx, 're-id ✓', px0 + pw - 26, y - b - 30, SUN, BG, 8);
        }
      }
      text(ctx, 'deepsort · re-id · 4 tracks', 0, 262, P(.45), 9.5);
      text(ctx, `handoffs ${String(Math.floor(t / 3.1) + 12).padStart(3, '0')}`, 380, 262, P(.45), 9.5, 'right');
    },

    /* 07 — Floor map tracking (homography) --------------------------- */
    floor(ctx, w, h, t, s) {
      const n = 12;
      if (!s.a) {
        s.a = [0, 1, 2, 3, 4].map((i) => ({ f1: .21 + rnd(i) * .2, f2: .17 + rnd(i + 5) * .2, p1: rnd(i + 9) * 6, p2: rnd(i + 14) * 6, tr: [] }));
        s.heat = new Float32Array(n * n);
      }
      fit(ctx, w, h, 480, 262);
      const Q = [[62, 30], [206, 30], [236, 214], [28, 214]];
      const quad = (u, v) => {
        const vp = Math.pow(v, 1.45);
        const tx = lerp(Q[0][0], Q[1][0], u), bx = lerp(Q[3][0], Q[2][0], u);
        const ty = lerp(Q[0][1], Q[1][1], u), by = lerp(Q[3][1], Q[2][1], u);
        return [lerp(tx, bx, vp), lerp(ty, by, vp)];
      };
      ctx.strokeStyle = P(.12); ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const f = i / 6;
        let a = quad(f, 0), b = quad(f, 1);
        ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
        a = quad(0, f); b = quad(1, f);
        ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      }
      ctx.stroke();
      ctx.strokeStyle = P(.32);
      ctx.beginPath(); Q.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); ctx.stroke();

      const M = { x: 292, y: 30, s: 184 };
      const cs = M.s / n;
      for (let i = 0; i < n * n; i++) {
        const v = s.heat[i];
        if (v > .02) { ctx.fillStyle = SUNA(Math.min(.55, v * .55)); ctx.fillRect(M.x + (i % n) * cs, M.y + Math.floor(i / n) * cs, cs - 1, cs - 1); }
        s.heat[i] *= .996;
      }
      ctx.strokeStyle = P(.06);
      ctx.beginPath();
      for (let i = 1; i < n; i++) { ctx.moveTo(M.x + i * cs, M.y); ctx.lineTo(M.x + i * cs, M.y + M.s); ctx.moveTo(M.x, M.y + i * cs); ctx.lineTo(M.x + M.s, M.y + i * cs); }
      ctx.stroke();
      ctx.strokeStyle = P(.4); ctx.lineWidth = 1.4;
      ctx.strokeRect(M.x, M.y, M.s, M.s);
      ctx.lineWidth = 2.4; ctx.strokeStyle = P(.28);
      ctx.beginPath();
      ctx.moveTo(M.x + M.s * .55, M.y); ctx.lineTo(M.x + M.s * .55, M.y + M.s * .38);
      ctx.moveTo(M.x, M.y + M.s * .7); ctx.lineTo(M.x + M.s * .34, M.y + M.s * .7);
      ctx.stroke();
      const MC = [[M.x, M.y], [M.x + M.s, M.y], [M.x + M.s, M.y + M.s], [M.x, M.y + M.s]];
      ctx.setLineDash([2, 5]); ctx.strokeStyle = P(.12); ctx.lineWidth = 1;
      ctx.beginPath(); Q.forEach((q, i) => { ctx.moveTo(q[0], q[1]); ctx.lineTo(MC[i][0], MC[i][1]); }); ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath(); rr(ctx, 246, 112, 34, 22, 11); ctx.fillStyle = BG; ctx.fill(); ctx.strokeStyle = SUN; ctx.stroke();
      text(ctx, 'H', 263, 127, SUN, 11, 'center');

      s.a.forEach((a, i) => {
        const u = .5 + .42 * Math.sin(t * a.f1 + a.p1) * Math.cos(t * a.f2 * .7 + a.p2 * .5);
        const v = .5 + .42 * Math.cos(t * a.f2 + a.p2) * Math.sin(t * a.f1 * .6 + a.p1 * .3 + 1);
        const col = i === 0 ? SUN : i === 1 ? SUN2 : P(.9);
        const trc = i === 0 ? SUNA(.45) : i === 1 ? 'rgba(255,106,26,.45)' : P(.25);
        const [qx, qy] = quad(u, v);
        const sc = .55 + Math.pow(v, 1.45) * .75;
        ctx.strokeStyle = col; ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(qx, qy); ctx.lineTo(qx, qy - 15 * sc);
        ctx.moveTo(qx + 3.4 * sc, qy - 18.5 * sc); ctx.arc(qx, qy - 18.5 * sc, 3.4 * sc, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.ellipse(qx, qy, 5 * sc, 2 * sc, 0, 0, Math.PI * 2); ctx.fill();
        brackets(ctx, qx - 8 * sc, qy - 25 * sc, 16 * sc, 27 * sc, col, 4, 1);
        const mx = M.x + u * M.s, my = M.y + v * M.s;
        const lt = a.tr[a.tr.length - 1];
        if (lt && Math.hypot(lt[0] - mx, lt[1] - my) > 14) a.tr.length = 0;
        a.tr.push([mx, my]);
        if (a.tr.length > 60) a.tr.shift();
        ctx.strokeStyle = trc; ctx.lineWidth = 1.2;
        ctx.beginPath(); a.tr.forEach((q, k) => (k ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(mx, my, 3.4, 0, Math.PI * 2); ctx.fill();
        const ci = Math.min(n - 1, Math.floor(u * n)) + Math.min(n - 1, Math.floor(v * n)) * n;
        s.heat[ci] = Math.min(1, s.heat[ci] + .03);
      });
      text(ctx, 'camera view · cam_03', 28, 246, P(.45), 9.5);
      text(ctx, 'floor plan · live', M.x, 246, P(.45), 9.5);
      text(ctx, 'occupancy 5', M.x + M.s, 246, SUN, 9.5, 'right');
    },

    /* 08 — Locate objects -------------------------------------------- */
    locate(ctx, w, h, t) {
      const cols = 7, rows = 5, cs = 46, gx0 = 12, gy0 = 30;
      const n = cols * rows;
      const cyc = 6.5, c = Math.floor(t / cyc), p = t % cyc;
      const target = Math.floor(rnd(c * 3.7 + 1) * n);
      const hops = [0, 1, 2].map((k) => Math.floor(rnd(c * 5.3 + k * 11.1) * n));
      fit(ctx, w, h, 346, 266);
      const q = 'find("red mug")';
      const typed = q.slice(0, Math.floor(clamp(p / .8) * q.length));
      text(ctx, '›', gx0, 12, P(.5), 11);
      text(ctx, typed, gx0 + 14, 12, P(.95), 11);
      const pos = (i) => [gx0 + (i % cols + .5) * cs, gy0 + (Math.floor(i / cols) + .5) * cs];
      const pts = [[gx0 + cols * cs / 2, gy0 + rows * cs / 2], ...hops.map(pos), pos(target)];
      const tt = (p - .8) / .6;
      let rx, ry;
      if (tt <= 0) [rx, ry] = pts[0];
      else if (tt >= 4) [rx, ry] = pts[4];
      else { const k = Math.floor(tt), f = ease(tt - k); rx = lerp(pts[k][0], pts[k + 1][0], f); ry = lerp(pts[k][1], pts[k + 1][1], f); }
      const locked = tt >= 4;
      ctx.lineWidth = 1.3;
      for (let i = 0; i < n; i++) {
        const [x, y] = pos(i);
        const isT = i === target;
        ctx.strokeStyle = isT && locked ? SUN : P(locked && !isT ? .16 : .5);
        ctx.save();
        ctx.translate(x, y);
        drawItem(ctx, isT ? 5 : Math.floor(rnd(i * 2.9 + 7) * 5), isT && locked);
        ctx.restore();
      }
      const r = locked ? 19 + Math.sin(t * 6) * 1.5 : 17;
      ctx.strokeStyle = locked ? SUN : P(.9);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(rx, ry, r, 0, Math.PI * 2);
      ctx.moveTo(rx - r - 8, ry); ctx.lineTo(rx - r + 5, ry);
      ctx.moveTo(rx + r - 5, ry); ctx.lineTo(rx + r + 8, ry);
      ctx.moveTo(rx, ry - r - 8); ctx.lineTo(rx, ry - r + 5);
      ctx.moveTo(rx, ry + r - 5); ctx.lineTo(rx, ry + r + 8);
      ctx.stroke();
      if (locked) {
        const lp = clamp(tt - 4);
        ctx.strokeStyle = SUNA(1 - lp);
        ctx.beginPath(); ctx.arc(rx, ry, r + lp * 34, 0, Math.PI * 2); ctx.stroke();
        brackets(ctx, rx - 25, ry - 25, 50, 50, SUN, 8, 1.8);
        tag(ctx, 'mug 0.96', rx - 25, ry - 25, SUN, BG, 9);
        text(ctx, `x ${Math.round(rx * 3.1)}  y ${Math.round(ry * 3.1)}`, gx0 + cols * cs, 12, SUN, 10, 'right');
      } else {
        text(ctx, 'scanning…', gx0 + cols * cs, 12, P(.45), 10, 'right');
      }
      text(ctx, `${n} items · 1 query`, gx0, 266, P(.4), 9.5);
    },

    /* 09 — Posture detection ----------------------------------------- */
    pose(ctx, w, h, t) {
      fit(ctx, w, h, 340, 262);
      const wave = (Math.sin(t * .75 - 1.2) + 1) / 2;
      const m = ease(clamp((wave - .15) / .7));
      const floorY = 252;
      ctx.strokeStyle = P(.18); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, floorY); ctx.lineTo(340, floorY); ctx.stroke();
      ctx.strokeStyle = P(.3); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(196, 160); ctx.lineTo(330, 160); ctx.moveTo(318, 160); ctx.lineTo(318, floorY); ctx.stroke();
      ctx.beginPath(); rr(ctx, 256, 84, 58, 42, 4); ctx.fillStyle = SUNA(.1); ctx.fill();
      ctx.lineWidth = 1.4; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(285, 126); ctx.lineTo(285, 160); ctx.moveTo(273, 160); ctx.lineTo(297, 160); ctx.stroke();
      const hip = [116, 178];
      ctx.strokeStyle = P(.22); ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(88, 190); ctx.lineTo(150, 190);
      ctx.moveTo(118, 190); ctx.lineTo(118, floorY - 12);
      ctx.moveTo(96, floorY); ctx.lineTo(118, floorY - 12); ctx.lineTo(140, floorY);
      ctx.moveTo(88, 190); ctx.lineTo(80, 112);
      ctx.stroke();

      const spA = m * .38, L = 90;
      const neck = [hip[0] + L * Math.sin(spA), hip[1] - L * Math.cos(spA)];
      const ctrl = [hip[0] + L * .5 * Math.sin(spA * .4) - m * 16, hip[1] - L * .5 * Math.cos(spA * .4)];
      const headA = .12 + m * .62;
      const head = [neck[0] + 24 * Math.sin(headA), neck[1] - 24 * Math.cos(headA)];
      const knee = [hip[0] + 58, hip[1] + 4];
      const ankle = [knee[0] + 4, floorY - 6];
      const toe = [ankle[0] + 16, floorY - 2];
      const sh = bez2(hip, ctrl, neck, .86);
      const wrist = [222 + m * 6, 154];
      const elbow = [(sh[0] + wrist[0]) / 2 - 8, (sh[1] + wrist[1]) / 2 + 24];
      const bad = m > .5;
      const deg = Math.round(headA * 180 / Math.PI);

      ctx.setLineDash([3, 4]); ctx.strokeStyle = P(.2); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hip[0], hip[1]); ctx.lineTo(hip[0], 40); ctx.moveTo(neck[0], neck[1]); ctx.lineTo(neck[0], neck[1] - 40); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = bad ? SUNA(.28) : P(.08);
      ctx.beginPath(); ctx.moveTo(neck[0], neck[1]); ctx.arc(neck[0], neck[1], 30, -Math.PI / 2, -Math.PI / 2 + headA); ctx.closePath(); ctx.fill();

      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 2.6;
      ctx.strokeStyle = bad ? SUN : P(.88);
      ctx.beginPath(); ctx.moveTo(hip[0], hip[1]); ctx.quadraticCurveTo(ctrl[0], ctrl[1], neck[0], neck[1]); ctx.lineTo(head[0], head[1]); ctx.stroke();
      ctx.strokeStyle = P(.88);
      ctx.beginPath();
      ctx.moveTo(hip[0], hip[1]); ctx.lineTo(knee[0], knee[1]); ctx.lineTo(ankle[0], ankle[1]); ctx.lineTo(toe[0], toe[1]);
      ctx.moveTo(sh[0], sh[1]); ctx.lineTo(elbow[0], elbow[1]); ctx.lineTo(wrist[0], wrist[1]);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(head[0], head[1] - 6, 13, 0, Math.PI * 2); ctx.stroke();
      [hip, knee, ankle, sh, elbow, wrist, neck].forEach((j) => {
        ctx.fillStyle = BG;
        ctx.beginPath(); ctx.arc(j[0], j[1], 4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = bad ? SUN : P(.95); ctx.lineWidth = 1.6; ctx.stroke();
      });
      text(ctx, `${deg}°`, neck[0] + 34, neck[1] - 22, bad ? SUN : P(.8), 11);
      if (bad) tag(ctx, `⚠ neck ${deg}° · sit back`, 0, 18, SUN, BG, 10);
      else tag(ctx, '✓ posture ok', 0, 18, P(.9), BG, 10);
      text(ctx, 'mediapipe · 33 keypoints', 340, 12, P(.4), 9, 'right');
    },
  };

  /* ---------- runner ---------- */
  const items = canvases.map((c, i) => ({
    c, ctx: c.getContext('2d'), fn: S[c.dataset.sketch],
    w: 0, h: 0, dpr: 1, bg: null, s: {}, vis: false, off: rnd(i + 1) * 6,
  }));

  function render(it, now) {
    if (!it.fn || !it.w || !it.ctx) return;
    const { ctx } = it;
    ctx.setTransform(it.dpr, 0, 0, it.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(it.bg, 0, 0, it.w, it.h);
    ctx.save();
    it.fn(ctx, it.w, it.h, reduce ? 3.4 + it.off : now / 1000 + it.off, it.s);
    ctx.restore();
  }

  function size(it, w, h) {
    if (!w || !h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (it.w === w && it.h === h && it.dpr === dpr) return;
    it.w = w; it.h = h; it.dpr = dpr;
    it.c.width = Math.round(w * dpr);
    it.c.height = Math.round(h * dpr);
    it.bg = makeBg(w, h, dpr);
    render(it, performance.now());
  }

  let raf = 0;
  function loop(now) {
    raf = 0;
    let any = false;
    for (const it of items) if (it.vis) { render(it, now); any = true; }
    if (any) raf = requestAnimationFrame(loop);
  }
  const start = () => { if (!raf && !reduce) raf = requestAnimationFrame(loop); };

  const byCanvas = new Map(items.map((it) => [it.c, it]));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { const it = byCanvas.get(e.target); if (it) it.vis = e.isIntersecting; });
    start();
  }, { rootMargin: '80px' });

  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver((entries) => {
      entries.forEach((e) => { const it = byCanvas.get(e.target); if (it) size(it, Math.round(e.contentRect.width), Math.round(e.contentRect.height)); });
    });
    items.forEach((it) => ro.observe(it.c));
  } else {
    const all = () => items.forEach((it) => size(it, it.c.clientWidth, it.c.clientHeight));
    window.addEventListener('resize', all);
    all();
  }
  items.forEach((it) => io.observe(it.c));
})();
