/* Portfolio interactions — vanilla JS, progressive enhancement.
   Everything here is optional: the page is fully readable without it. */
(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let reduced = motionQuery.matches;

  /* ---------- theme ---------- */
  const themeBtn = $('[data-theme-toggle]');
  const themeMeta = $('meta[name="theme-color"]');
  const currentTheme = () => (root.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  const syncThemeUI = () => {
    const t = currentTheme();
    const next = t === 'dark' ? 'light' : 'dark';
    themeBtn?.setAttribute('aria-label', `Switch to ${next} theme`);
    themeBtn?.setAttribute('title', `Switch to ${next} theme`);
    themeMeta?.setAttribute('content', t === 'light' ? '#F6F8FC' : '#080D1B');
  };
  const setTheme = (t, persist) => {
    root.classList.add('theme-transition');
    root.setAttribute('data-theme', t);
    if (persist) { try { localStorage.setItem('theme', t); } catch (e) { /* storage unavailable */ } }
    syncThemeUI();
    clearTimeout(setTheme.timer);
    setTheme.timer = setTimeout(() => root.classList.remove('theme-transition'), 500);
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: t } }));
  };
  themeBtn?.addEventListener('click', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark', true));
  // follow the OS only while the visitor hasn't chosen explicitly
  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', (e) => {
    let saved = null;
    try { saved = localStorage.getItem('theme'); } catch (err) { }
    if (!saved) setTheme(e.matches ? 'light' : 'dark', false);
  });
  syncThemeUI();

  /* ---------- header, progress, mobile menu ---------- */
  const header = $('[data-header]');
  const nav = $('[data-nav]');
  const menuBtn = $('[data-menu-toggle]');
  const progress = $('[data-progress]');
  const menuLabel = menuBtn?.querySelector('.sr-only');

  const setMenu = (open) => {
    if (!nav || !menuBtn) return;
    nav.classList.toggle('open', open);
    header.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    if (menuLabel) menuLabel.textContent = open ? 'Close navigation menu' : 'Open navigation menu';
    if (open) nav.querySelector('a')?.focus({ preventScroll: true });
  };
  menuBtn?.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  nav?.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuBtn?.getAttribute('aria-expanded') === 'true') { setMenu(false); menuBtn.focus(); }
  });
  document.addEventListener('click', (e) => {
    if (menuBtn?.getAttribute('aria-expanded') === 'true' && !header.contains(e.target)) setMenu(false);
  });
  matchMedia('(min-width: 1141px)').addEventListener?.('change', (e) => { if (e.matches) setMenu(false); });

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - innerHeight;
      header?.classList.toggle('scrolled', scrollY > 12);
      progress?.style.setProperty('--p', max > 0 ? Math.min(1, scrollY / max).toFixed(4) : 0);
      ticking = false;
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- active section indicator ---------- */
  const navLinks = $$('.primary-nav ul a');
  const indicator = $('[data-nav-indicator]');
  const sections = navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  const moveIndicator = (link) => {
    if (!indicator || !link) return;
    const ul = link.closest('ul');
    const r = link.getBoundingClientRect(), p = ul.getBoundingClientRect();
    indicator.style.setProperty('--x', `${r.left - p.left}px`);
    indicator.style.setProperty('--w', `${r.width}px`);
    indicator.style.setProperty('--o', 1);
  };
  const setActive = (id) => {
    navLinks.forEach((a) => {
      const on = a.getAttribute('href') === `#${id}`;
      if (on) { a.setAttribute('aria-current', 'true'); moveIndicator(a); } else a.removeAttribute('aria-current');
    });
  };
  const pickActive = () => {
    const line = innerHeight * 0.35;
    let current = sections[0]?.id;
    for (const s of sections) if (s.getBoundingClientRect().top <= line) current = s.id;
    setActive(current);
  };
  let activeTick = false;
  addEventListener('scroll', () => {
    if (activeTick) return;
    activeTick = true;
    requestAnimationFrame(() => { pickActive(); activeTick = false; });
  }, { passive: true });
  addEventListener('resize', pickActive);
  document.fonts?.ready.then(pickActive);
  pickActive();

  /* ---------- project filters ---------- */
  const filterBtns = $$('[data-filter]');
  const filterables = $$('#projects [data-category]');
  const filterStatus = $('[data-filter-status]');
  filterBtns.forEach((btn) => btn.addEventListener('click', () => {
    const f = btn.dataset.filter;
    filterBtns.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    let shown = 0;
    filterables.forEach((el) => {
      const show = f === 'all' || el.dataset.category.split(' ').includes(f);
      el.classList.toggle('is-hidden', !show);
      if (show) {
        shown++;
        el.classList.add('is-visible');
        if (window.gsap && !reduced) gsap.fromTo(el, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: .5, ease: 'power3.out', clearProps: 'transform,opacity' });
      }
    });
    if (filterStatus) filterStatus.textContent = `Showing ${shown} project${shown === 1 ? '' : 's'}`;
    window.ScrollTrigger?.refresh();
  }));

  /* ---------- pointer effects: tilt, spotlight, hero parallax ---------- */
  const enablePointerFx = () => finePointer.matches && !reduced;
  $$('[data-tilt]').forEach((el) => {
    const max = el.classList.contains('portrait') ? 8 : 6;
    el.addEventListener('pointermove', (e) => {
      if (!enablePointerFx()) return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--ry', `${(x * max).toFixed(2)}deg`);
      el.style.setProperty('--rx', `${(-y * max).toFixed(2)}deg`);
    });
    el.addEventListener('pointerleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
  });
  $$('[data-spotlight]').forEach((el) => el.addEventListener('pointermove', (e) => {
    if (!finePointer.matches) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }));
  const heroVisual = $('[data-hero-visual]');
  if (heroVisual) {
    const floats = $$('.tech-float li, .code-chip', heroVisual);
    addEventListener('pointermove', (e) => {
      if (!enablePointerFx() || scrollY > innerHeight) return;
      const x = e.clientX / innerWidth - 0.5, y = e.clientY / innerHeight - 0.5;
      floats.forEach((f, i) => {
        const depth = 10 + (i % 3) * 7;
        f.style.setProperty('--px', (x * depth).toFixed(1));
        f.style.setProperty('--py', (y * depth).toFixed(1));
      });
    }, { passive: true });
  }

  /* ---------- profile photo slot ---------- */
  const portrait = $('.portrait[data-photo]');
  const photo = portrait?.dataset.photo?.trim();
  if (photo) {
    const img = new Image();
    img.alt = portrait.dataset.photoAlt || 'Portrait';
    img.decoding = 'async';
    img.width = 800; img.height = 1000;
    img.onload = () => { const m = $('[data-portrait-media]', portrait); m.textContent = ''; m.append(img); };
    img.src = photo;
  }

  /* ---------- copy email ---------- */
  $$('[data-copy]').forEach((btn) => btn.addEventListener('click', async () => {
    const status = $('[data-copy-status]');
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      if (status) status.textContent = 'Email copied';
    } catch (e) {
      if (status) status.textContent = 'Press Ctrl+C to copy';
    }
    clearTimeout(btn.t);
    btn.t = setTimeout(() => { if (status) status.textContent = ''; }, 2200);
  }));

  /* ---------- footer year ---------- */
  const year = $('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- scroll animations ---------- */
  const revealEls = $$('.reveal, .reveal-item');
  const timeline = $('[data-timeline]');

  const initGsap = () => {
    const { gsap, ScrollTrigger } = window;
    gsap.registerPlugin(ScrollTrigger);
    root.classList.add('reveal-ready');

    ScrollTrigger.batch('.reveal', {
      start: 'top 88%',
      once: true,
      onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: .9, ease: 'power3.out', stagger: .08, onComplete() { batch.forEach((b) => b.classList.add('is-visible')); } }),
    });
    ScrollTrigger.batch('.reveal-item', {
      start: 'top 92%',
      once: true,
      onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: .75, ease: 'power3.out', stagger: .07, onComplete() { batch.forEach((b) => b.classList.add('is-visible')); } }),
    });

    // featured projects: media and copy slide in from opposite sides, media drifts subtly on scroll
    $$('.feature').forEach((f) => {
      const media = $('.feature-media', f), body = $('.feature-body', f);
      const dir = f.classList.contains('feature-alt') ? -1 : 1;
      gsap.from(media, { x: -40 * dir, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: f, start: 'top 82%', once: true } });
      gsap.from(body, { x: 30 * dir, opacity: 0, duration: 1, delay: .1, ease: 'power3.out', scrollTrigger: { trigger: f, start: 'top 82%', once: true } });
      gsap.fromTo(media, { y: 24 }, { y: -24, ease: 'none', scrollTrigger: { trigger: f, start: 'top bottom', end: 'bottom top', scrub: .6 } });
    });

    // timeline track fills as you read
    if (timeline) {
      gsap.fromTo(timeline, { '--fill': 0 }, { '--fill': 1, ease: 'none', scrollTrigger: { trigger: timeline, start: 'top 75%', end: 'bottom 60%', scrub: .5 } });
    }

    // hero composition eases away as you scroll past it
    if (heroVisual) {
      gsap.fromTo(heroVisual, { y: 0, opacity: 1 }, { y: 60, opacity: .35, ease: 'none', immediateRender: false, scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: .6 } });
    }

    document.fonts?.ready.then(() => ScrollTrigger.refresh());
  };

  const initFallbackReveal = () => {
    if (!('IntersectionObserver' in window)) return;
    root.classList.add('reveal-ready', 'css-reveal');
    $$('.interest-grid, .skills-grid, .project-grid, .research-grid').forEach((g) => [...g.children].forEach((c, i) => c.style.setProperty('--i', i % 6)));
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -8% 0px', threshold: .08 });
    revealEls.forEach((el) => io.observe(el));
    if (timeline) {
      const fill = () => {
        const r = timeline.getBoundingClientRect();
        const t = Math.min(1, Math.max(0, (innerHeight * .75 - r.top) / (r.height * .9)));
        timeline.style.setProperty('--fill', t.toFixed(3));
      };
      addEventListener('scroll', fill, { passive: true });
      fill();
    }
  };

  const startAnimations = () => {
    if (reduced) return; // everything stays visible; no movement
    if (window.gsap && window.ScrollTrigger) initGsap();
    else initFallbackReveal();
  };
  // GSAP scripts are deferred before this one, so they're available now if they loaded.
  startAnimations();

  motionQuery.addEventListener?.('change', (e) => { reduced = e.matches; if (reduced) revealEls.forEach((el) => el.classList.add('is-visible')); });

  /* ---------- 3D background (lazy, only where WebGL works) ---------- */
  const canvas = $('[data-bg3d]');
  const saveData = navigator.connection?.saveData;
  const webglOK = (() => {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      return !!gl;
    } catch (e) { return false; }
  })();
  if (canvas && webglOK && !saveData) {
    const load = () => import('./bg3d.js')
      .then((m) => {
        m.start(canvas);
        document.addEventListener('themechange', () => m.restart(canvas));
      })
      .catch(() => canvas.remove());
    if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 1500 });
    else setTimeout(load, 300);
  } else {
    canvas?.remove();
  }
})();
