/* =========================================================
   Main choreography. One rAF loop, cached layout reads,
   transforms/opacity only on the hot path.
   ========================================================= */
(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const reduce = root.classList.contains('reduce');
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  let vw = window.innerWidth;
  let vh = window.innerHeight;
  let sy = window.scrollY;
  let prevSy = sy;
  let vel = 0;
  const mouse = { x: vw / 2, y: vh / 2, nx: 0, ny: 0, px: 0, py: 0, active: false };

  /* ---------- word splitting ---------- */
  function splitWords(el, { chars = false } = {}) {
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const wd = document.createElement('span');
            wd.className = 'wd';
            const wi = document.createElement('span');
            wi.className = 'wi';
            wi.style.setProperty('--i', i++);
            if (chars) {
              [...part].forEach((ch) => { const c = document.createElement('span'); c.className = 'cc'; c.textContent = ch; wi.appendChild(c); });
            } else wi.textContent = part;
            wd.appendChild(wi);
            frag.appendChild(wd);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
  }

  /* ---------- intro ---------- */
  $$('.hero .hn').forEach((hn) => {
    const off = hn.classList.contains('hn-last') ? 3 : 0;
    $$('.ch', hn).forEach((c, i) => c.style.setProperty('--ci', i + off));
  });
  const fontsReady = document.fonts && document.fonts.ready
    ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1400))])
    : Promise.resolve();
  fontsReady.then(() => requestAnimationFrame(() => { root.classList.add('is-loaded'); layout(); }));

  /* ---------- theme (view-transition circle wipe) ---------- */
  const themeBtn = $('#themeBtn');
  if (themeBtn) themeBtn.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    const apply = () => {
      root.dataset.theme = next;
      try { localStorage.setItem('as-theme', next); } catch (e) { /* private mode */ }
    };
    if (!document.startViewTransition || reduce) { apply(); return; }
    const r = themeBtn.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const rad = Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y));
    document.startViewTransition(apply).ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${rad}px at ${x}px ${y}px)`] },
        { duration: 750, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(() => {});
  });

  /* ---------- clock ---------- */
  const clock = $('#clock');
  if (clock) {
    let fmt;
    try { fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }); } catch (e) { fmt = null; }
    const tickClock = () => { if (fmt) clock.textContent = `KOCHI ${fmt.format(new Date())} IST`; };
    tickClock();
    setInterval(tickClock, 15000);
  }

  /* ---------- mobile menu ---------- */
  const menuBtn = $('#menuBtn');
  const menu = $('#menu');
  let menuOpen = false;
  function setMenu(open) {
    if (!menu || !menuBtn) return;
    menuOpen = open;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    root.classList.toggle('menu-open', open);
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-open')));
    } else {
      menu.classList.remove('is-open');
      setTimeout(() => { if (!menuOpen) menu.hidden = true; }, 700);
    }
  }
  if (menuBtn) menuBtn.addEventListener('click', () => setMenu(!menuOpen));
  if (menu) $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && menuOpen) setMenu(false); });

  /* ---------- custom cursor ---------- */
  const cursor = $('.cursor');
  const cDot = $('.cursor-dot');
  const cRing = $('.cursor-ring');
  const cText = $('.cursor-text');
  let ringX = mouse.x, ringY = mouse.y;
  const useCursor = fine && !reduce && cursor;
  if (useCursor) root.classList.add('has-cursor');

  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.nx = (e.clientX / vw) * 2 - 1;
    mouse.ny = (e.clientY / vh) * 2 - 1;
    mouse.active = true;
    if (useCursor) {
      cDot.style.transform = `translate3d(${e.clientX}px,${e.clientY}px,0)`;
      cursor.classList.remove('is-out');
    }
  }, { passive: true });

  if (useCursor) {
    document.addEventListener('pointerover', (e) => {
      const labelled = e.target.closest('[data-cursor]');
      const link = e.target.closest('a, button');
      cursor.classList.toggle('is-label', !!labelled);
      cursor.classList.toggle('is-link', !labelled && !!link);
      if (labelled) cText.textContent = labelled.dataset.cursor;
    });
    document.addEventListener('pointerdown', () => cursor.classList.add('is-down'));
    document.addEventListener('pointerup', () => cursor.classList.remove('is-down'));
    document.documentElement.addEventListener('pointerleave', () => cursor.classList.add('is-out'));
  }

  /* ---------- magnetic buttons ---------- */
  if (fine && !reduce) {
    $$('.magnetic').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        el.style.transform = `translate(${x * .22}px, ${y * .3}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ---------- reveals ---------- */
  $$('[data-split]').forEach((el) => { splitWords(el); el.classList.add('split'); });
  $$('[data-reveal]').forEach((el) => {
    const sibs = [...el.parentElement.children].filter((c) => c.hasAttribute('data-reveal'));
    const k = sibs.indexOf(el);
    if (k > 0) el.style.setProperty('--rd', `${k * .08}s`);
  });
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('in');
      revealIO.unobserve(en.target);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: .01 });
  $$('[data-reveal], [data-split], .ncard').forEach((el) => revealIO.observe(el));

  /* ---------- count-up stats ---------- */
  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      countIO.unobserve(en.target);
      const el = en.target;
      const end = +el.dataset.count;
      const pad = +(el.dataset.pad || 0);
      const fmt = (v) => String(Math.round(v)).padStart(pad, '0');
      if (reduce) { el.textContent = fmt(end); return; }
      const t0 = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - t0) / 1400);
        el.textContent = fmt(end * (1 - Math.pow(2, -10 * p)));
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = fmt(end);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: .6 });
  $$('[data-count]').forEach((el) => countIO.observe(el));

  /* ---------- manifesto: words light up as you read ---------- */
  const man = $('#manifesto');
  let manWords = [];
  let manLit = -1;
  if (man) {
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const s = document.createElement('span');
            s.className = 'mw';
            s.textContent = part;
            frag.appendChild(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.classList.contains('pill')) {
          n.classList.add('mw');
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(man);
    manWords = $$('.mw', man);
    if (reduce) manWords.forEach((w) => w.classList.add('on'));
  }

  /* ---------- tapes: drift + scroll velocity ---------- */
  const tapes = $$('.tape').map((el) => ({
    el, track: $('.tape-track', el), group: $('.tape-group', el),
    speed: parseFloat(el.dataset.speed) || .5, x: 0, w: 1, vis: false, last: '',
  }));
  const tapeIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => { const t = tapes.find((k) => k.el === en.target); if (t) t.vis = en.isIntersecting; });
  });
  tapes.forEach((t) => tapeIO.observe(t.el));

  /* ---------- work: pinned horizontal reel ---------- */
  const work = $('#work');
  const track = $('#workTrack');
  const wCards = track ? $$('.wcard', track) : [];
  const wBar = $('#workBar');
  const wIdx = $('#workIdx');
  const wName = $('#workName');
  let pinned = false, wTop = 0, wMax = 0, wX = 0, wLastX = -1, wCenters = [], wActive = -1;

  function layoutWork() {
    if (!work || !track) return;
    pinned = vw >= 960 && fine;
    root.classList.toggle('work-pinned', pinned);
    if (!pinned) {
      work.style.height = '';
      track.style.transform = '';
      wLastX = -1;
      return;
    }
    const last = track.lastElementChild;
    const gutter = parseFloat(getComputedStyle(track).paddingLeft) || 0;
    const contentW = last.offsetLeft + last.offsetWidth + gutter;
    wMax = Math.max(0, contentW - vw);
    const h = `${Math.round(wMax + vh)}px`;
    if (work.style.height !== h) work.style.height = h;
    wTop = work.getBoundingClientRect().top + window.scrollY;
    wCenters = wCards.map((c) => c.offsetLeft + c.offsetWidth / 2);
  }

  if (track) {
    track.addEventListener('focusin', (e) => {
      if (!pinned) return;
      const el = e.target.closest('.wcard, .work-outro, .work-intro');
      if (!el) return;
      const pin = $('.work-pin');
      if (pin) pin.scrollLeft = 0;
      const target = clamp(el.offsetLeft + el.offsetWidth / 2 - vw / 2, 0, wMax);
      window.scrollTo({ top: wTop + target, behavior: reduce ? 'auto' : 'smooth' });
    });
    if (fine && !reduce) {
      wCards.forEach((c) => {
        c.addEventListener('pointermove', (e) => {
          const r = c.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
          c.style.setProperty('--ry', `${((px - .5) * 6).toFixed(2)}deg`);
          c.style.setProperty('--rx', `${((.5 - py) * 5).toFixed(2)}deg`);
          c.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
          c.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
        });
        c.addEventListener('pointerleave', () => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
      });
    }
  }

  /* ---------- process: stacking cards ---------- */
  const stack = $('#stack');
  const sCards = stack ? $$('.scard', stack) : [];
  let sTops = [], sSticky = [], sLast = [];
  function layoutStack() {
    if (!stack) return;
    sCards.forEach((c) => { c.style.transform = ''; });
    const gap = parseFloat(getComputedStyle(stack).rowGap) || 0;
    let y = stack.getBoundingClientRect().top + window.scrollY;
    sTops = sCards.map((c) => { const top = y; y += c.offsetHeight + gap; return top; });
    sSticky = sCards.map((c) => parseFloat(getComputedStyle(c).top) || 0);
    sLast = sCards.map(() => -1);
  }
  const artIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => en.target.classList.toggle('in-view', en.isIntersecting));
  });
  sCards.forEach((c) => artIO.observe(c));

  /* ---------- contact: variable-font proximity ---------- */
  const ct = $('#contactTitle');
  let ctChars = [];
  let ctVisible = false;
  if (ct) {
    $$('.ln', ct).forEach((ln) => splitWords(ln, { chars: true }));
    ctChars = $$('.cc', ct).map((el) => ({ el, serif: !!el.closest('em'), w: 0, s: 100, lastW: -1, lastS: -1, cx: 0, cy: 0 }));
    const ctIO = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        ctVisible = en.isIntersecting;
        if (en.isIntersecting) ct.classList.add('in');
      });
    }, { threshold: .15 });
    ctIO.observe(ct);
  }

  /* ---------- copy email ---------- */
  const toastEl = $('#toast');
  let toastT = 0;
  const toast = (msg) => {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('show'), 2200);
  };
  const copyBtn = $('#copyEmail');
  if (copyBtn) copyBtn.addEventListener('click', async () => {
    const email = copyBtn.dataset.email;
    try {
      await navigator.clipboard.writeText(email);
      toast('Email copied — talk soon ✦');
    } catch (e) {
      window.location.href = `mailto:${email}`;
    }
  });

  /* ---------- nav: hide on scroll, active pill ---------- */
  const nav = $('#nav');
  const links = $$('.links a');
  const pill = $('#linksPill');
  const sections = links.map((a) => ({ id: a.dataset.sec, el: document.getElementById(a.dataset.sec), top: 0, bottom: 0 }));
  let activeSec = null;
  function setActive(id) {
    if (id === activeSec) return;
    activeSec = id;
    let found = null;
    links.forEach((a) => { const on = a.dataset.sec === id; a.classList.toggle('is-active', on); if (on) found = a; });
    if (!pill) return;
    if (found) {
      pill.style.width = `${found.offsetWidth}px`;
      pill.style.transform = `translateX(${found.offsetLeft}px)`;
      pill.style.opacity = '1';
    } else pill.style.opacity = '0';
  }

  /* ---------- cached layout ---------- */
  const hero = $('#top');
  const sunWrap = $('#sunWrap');
  const figure = $('#figure');
  const firsts = $$('.hero .hn-first');
  const lasts = $$('.hero .hn-last');
  const heroFoot = $('.hero-foot');
  const footer = $('#footer');
  const footSun = $('#footerSun');
  const progressBar = $('#progressBar');
  let heroH = vh, manTop = 0, manH = 0, footTop = 0, footH = 1, docH = 1;
  let ctTop = 0, ctH = 0;

  function layout() {
    vw = window.innerWidth;
    vh = window.innerHeight;
    layoutWork();
    layoutStack();
    const docY = window.scrollY;
    heroH = hero ? hero.offsetHeight : vh;
    if (man) { const r = man.getBoundingClientRect(); manTop = r.top + docY; manH = r.height; }
    if (footer) { const r = footer.getBoundingClientRect(); footTop = r.top + docY; footH = r.height; }
    if (ct) { const r = ct.getBoundingClientRect(); ctTop = r.top + docY; ctH = r.height; }
    sections.forEach((s) => {
      if (!s.el) return;
      const r = s.el.getBoundingClientRect();
      s.top = r.top + docY;
      s.bottom = s.top + r.height;
    });
    docH = document.documentElement.scrollHeight;
    tapes.forEach((t) => { t.w = t.group ? t.group.offsetWidth : 1; });
    const a = links.find((l) => l.dataset.sec === activeSec);
    if (a && pill) { pill.style.width = `${a.offsetWidth}px`; pill.style.transform = `translateX(${a.offsetLeft}px)`; }
  }

  let resizeT = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(layout, 120);
  });
  addEventListener('load', layout);
  if ('ResizeObserver' in window) {
    let lastBodyH = 0;
    new ResizeObserver(() => {
      const h = document.body.offsetHeight;
      if (Math.abs(h - lastBodyH) > 2) { lastBodyH = h; requestAnimationFrame(layout); }
    }).observe(document.body);
  }
  layout();

  /* =========================================================
     the loop
     ========================================================= */
  const heroState = { px: 0, py: 0, last: '' };
  let lastT = performance.now();
  let lastNavY = sy;

  function frame(now) {
    const dt = Math.min(50, now - lastT) / 16.667;
    lastT = now;
    sy = window.scrollY;
    const dy = sy - prevSy;
    prevSy = sy;
    vel = lerp(vel, dy, .2);

    // progress bar
    if (progressBar) progressBar.style.transform = `scaleX(${clamp(sy / Math.max(1, docH - vh), 0, 1).toFixed(4)})`;

    // nav visibility + active section
    if (nav) {
      const d = sy - lastNavY;
      if (Math.abs(d) > 6) {
        nav.classList.toggle('is-hidden', d > 0 && sy > vh * .7 && !menuOpen);
        lastNavY = sy;
      }
      if (sy < vh * .7) nav.classList.remove('is-hidden');
      nav.classList.toggle('is-scrolled', sy > 24);
      const probe = sy + vh * .45;
      let cur = null;
      for (const s of sections) if (s.el && probe >= s.top) cur = s;
      setActive(cur ? cur.id : null);
    }

    // cursor ring
    if (useCursor) {
      ringX = lerp(ringX, mouse.x, .2 * dt);
      ringY = lerp(ringY, mouse.y, .2 * dt);
      cRing.style.transform = `translate3d(${ringX.toFixed(1)}px,${ringY.toFixed(1)}px,0)`;
    }

    // hero depth: pointer + scroll parallax
    if (sy < heroH + 40) {
      heroState.px = lerp(heroState.px, fine ? mouse.nx : 0, .06 * dt);
      heroState.py = lerp(heroState.py, fine ? mouse.ny : 0, .06 * dt);
      const px = heroState.px, py = heroState.py;
      const key = `${px.toFixed(3)}|${py.toFixed(3)}|${sy}`;
      if (key !== heroState.last && !reduce) {
        heroState.last = key;
        if (sunWrap) sunWrap.style.transform = `translate3d(${(px * -14).toFixed(2)}px,${(sy * .32 + py * -10).toFixed(2)}px,0)`;
        if (figure) figure.style.transform = `translate3d(${(px * 7).toFixed(2)}px,${(sy * .14).toFixed(2)}px,0)`;
        const f = `translate3d(${(px * 22 - sy * .35).toFixed(2)}px,${(sy * .1 + py * 8).toFixed(2)}px,0)`;
        const l = `translate3d(${(px * 28 + sy * .35).toFixed(2)}px,${(sy * .04 + py * 10).toFixed(2)}px,0)`;
        firsts.forEach((el) => { el.style.transform = f; });
        lasts.forEach((el) => { el.style.transform = l; });
        if (heroFoot && vw >= 960) heroFoot.style.opacity = clamp(1 - sy / (vh * .45), 0, 1).toFixed(3);
      }
    }

    // manifesto
    if (man && !reduce && manWords.length) {
      const start = manTop - vh * .8;
      const end = manTop + manH - vh * .45;
      const p = clamp((sy - start) / Math.max(1, end - start), 0, 1);
      const n = Math.round(p * manWords.length);
      if (n !== manLit) {
        const lo = Math.min(n, Math.max(manLit, 0)), hi = Math.max(n, manLit);
        for (let i = lo; i < hi && i < manWords.length; i++) manWords[i].classList.toggle('on', i < n);
        if (manLit < 0) manWords.forEach((w, i) => w.classList.toggle('on', i < n));
        manLit = n;
      }
    }

    // tapes
    if (!reduce) {
      const boost = clamp(vel, -40, 40);
      tapes.forEach((t) => {
        if (!t.vis || !t.track) return;
        t.x -= (t.speed * 1.2 + Math.sign(t.speed) * boost * .35) * dt;
        if (t.x <= -t.w) t.x += t.w;
        if (t.x > 0) t.x -= t.w;
        const skew = clamp(-boost * .12, -7, 7);
        const tr = `translate3d(${t.x.toFixed(1)}px,0,0) skewX(${skew.toFixed(2)}deg)`;
        if (tr !== t.last) { t.track.style.transform = tr; t.last = tr; }
      });
    }

    // work reel
    if (pinned && track) {
      const target = clamp(sy - wTop, 0, wMax);
      wX = reduce ? target : lerp(wX, target, Math.min(1, .16 * dt));
      if (Math.abs(wX - target) < .3) wX = target;
      if (Math.abs(wX - wLastX) > .05) {
        wLastX = wX;
        track.style.transform = `translate3d(${(-wX).toFixed(2)}px,0,0)`;
        if (wBar) wBar.style.transform = `scaleX(${(wMax ? wX / wMax : 0).toFixed(4)})`;
        const center = wX + vw * .55;
        let best = 0, bd = Infinity;
        wCenters.forEach((c, i) => { const d = Math.abs(c - center); if (d < bd) { bd = d; best = i; } });
        if (best !== wActive) {
          wActive = best;
          if (wIdx) wIdx.textContent = String(best + 1).padStart(2, '0');
          if (wName) wName.textContent = $('h3', wCards[best]).textContent;
        }
      }
    }

    // stacking cards
    if (sCards.length > 1 && !reduce) {
      const ps = sCards.map((c, i) => {
        if (i === 0) return 0;
        const d = sTops[i] - sy;
        return clamp((vh - d) / Math.max(1, vh - sSticky[i]), 0, 1);
      });
      sCards.forEach((c, i) => {
        let buried = 0;
        for (let k = i + 1; k < sCards.length; k++) buried += ps[k];
        const v = Math.round(buried * 1000) / 1000;
        if (v !== sLast[i]) {
          sLast[i] = v;
          c.style.transform = v ? `scale(${(1 - v * .045).toFixed(4)})` : '';
          c.style.setProperty('--dim', Math.min(1, v).toFixed(3));
        }
      });
    }

    // contact proximity (fine pointers only)
    if (ct && fine && !reduce && ctVisible && ctChars.length) {
      const near = mouse.active && Math.abs(mouse.y - (ctTop - sy + ctH / 2)) < ctH;
      const settled = !near && ctChars.every((c) => c.lastW < 0 || (c.lastW === (c.serif ? 400 : 650) && c.lastS === 100));
      if (!settled) for (const c of ctChars) {
        const r = c.el.getBoundingClientRect();
        c.cx = r.left + r.width / 2;
        c.cy = r.top + r.height / 2;
      }
      for (const c of ctChars) {
        let f = 0;
        if (near) {
          const d = Math.hypot(mouse.x - c.cx, mouse.y - c.cy);
          f = Math.pow(Math.max(0, 1 - d / 280), 2);
        }
        const tw = c.serif ? lerp(400, 300, f) : lerp(650, 800, f);
        const ts = c.serif ? 100 : lerp(100, 76, f);
        c.w = lerp(c.w || tw, tw, .18 * dt);
        c.s = lerp(c.s, ts, .18 * dt);
        const w = Math.round(c.w), s = Math.round(c.s);
        if (w !== c.lastW || s !== c.lastS) {
          c.lastW = w; c.lastS = s;
          c.el.style.fontVariationSettings = c.serif ? `"wght" ${w}` : `"wght" ${w}, "wdth" ${s}`;
        }
      }
    }

    // footer sunrise
    if (footSun && sy + vh > footTop) {
      const p = clamp((sy + vh - footTop) / footH, 0, 1);
      const e = 1 - Math.pow(1 - p, 3);
      footSun.style.transform = `translate3d(0,${((1 - e) * 26).toFixed(2)}%,0) scale(${(.86 + e * .14).toFixed(4)})`;
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
