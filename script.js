/* Portfolio interactions — small, dependency-free, progressive enhancement.
   The page is fully readable without any of this. */
(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- theme ---------- */
  const themeBtn = $('[data-theme-toggle]');
  const themeMeta = $('meta[name="theme-color"]');
  const current = () => (root.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  const syncThemeUI = () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    themeBtn?.setAttribute('aria-label', `Switch to ${next} theme`);
    themeBtn?.setAttribute('title', `Switch to ${next} theme`);
    themeMeta?.setAttribute('content', current() === 'light' ? '#F4F1EA' : '#0E1116');
  };
  const setTheme = (t, persist) => {
    root.classList.add('theme-transition');
    root.setAttribute('data-theme', t);
    if (persist) { try { localStorage.setItem('theme', t); } catch (e) { /* storage unavailable */ } }
    syncThemeUI();
    clearTimeout(setTheme.timer);
    setTheme.timer = setTimeout(() => root.classList.remove('theme-transition'), 400);
  };
  themeBtn?.addEventListener('click', () => setTheme(current() === 'dark' ? 'light' : 'dark', true));
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
  const menuLabel = $('.menu-label', menuBtn);
  const menuSr = $('.sr-only', menuBtn);
  const progress = $('[data-progress]');

  const setMenu = (open) => {
    if (!nav || !menuBtn) return;
    nav.classList.toggle('open', open);
    header.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    if (menuLabel) menuLabel.textContent = open ? 'Close' : 'Menu';
    if (menuSr) menuSr.textContent = open ? ' — close navigation' : ' — open navigation';
    if (open) $('a', nav)?.focus({ preventScroll: true });
  };
  menuBtn?.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  nav?.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuBtn?.getAttribute('aria-expanded') === 'true') { setMenu(false); menuBtn.focus(); }
  });
  document.addEventListener('click', (e) => {
    if (menuBtn?.getAttribute('aria-expanded') === 'true' && !header.contains(e.target)) setMenu(false);
  });
  matchMedia('(min-width: 1081px)').addEventListener?.('change', (e) => { if (e.matches) setMenu(false); });

  /* ---------- scroll-linked: header state, progress, active section ---------- */
  const navLinks = $$('.primary-nav ul a');
  const sections = navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  let ticking = false;
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    header?.classList.toggle('scrolled', scrollY > 8);
    progress?.style.setProperty('--p', max > 0 ? Math.min(1, scrollY / max).toFixed(4) : 0);
    const line = innerHeight * 0.35;
    let active = null;
    for (const s of sections) if (s.getBoundingClientRect().top <= line) active = s.id;
    navLinks.forEach((a) => {
      if (a.getAttribute('href') === `#${active}`) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    ticking = false;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  /* ---------- local time in Sylhet (useful for remote collaborators) ---------- */
  const clock = $('[data-clock]');
  if (clock) {
    const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dhaka' });
    const iso = new Intl.DateTimeFormat('sv-SE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Dhaka' });
    const tick = () => {
      const now = new Date();
      clock.textContent = fmt.format(now);
      clock.setAttribute('datetime', iso.format(now).replace(' ', 'T') + '+06:00');
    };
    tick();
    setInterval(tick, 30000);
  }

  /* ---------- profile photo slot ---------- */
  const photoSlot = $('.hero-photo[data-photo]');
  const photo = photoSlot?.dataset.photo?.trim();
  if (photoSlot && photo) {
    const img = new Image();
    img.alt = photoSlot.dataset.photoAlt || 'Portrait';
    img.decoding = 'async';
    img.width = 800; img.height = 1000;
    img.onload = () => { photoSlot.append(img); photoSlot.hidden = false; };
    img.src = photo;
  }

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
      if (show) { shown++; el.classList.add('is-visible'); }
    });
    if (filterStatus) filterStatus.textContent = `Showing ${shown} project${shown === 1 ? '' : 's'}`;
  }));

  /* ---------- copy email ---------- */
  $$('[data-copy]').forEach((btn) => btn.addEventListener('click', async () => {
    const status = $('[data-copy-status]');
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      if (status) status.textContent = 'Copied';
    } catch (e) {
      if (status) status.textContent = 'Press Ctrl+C to copy';
    }
    clearTimeout(btn.t);
    btn.t = setTimeout(() => { if (status) status.textContent = ''; }, 2000);
  }));

  /* ---------- footer year ---------- */
  const year = $('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- quiet section reveals ---------- */
  const revealEls = $$('.reveal');
  if (!reducedMotion.matches && 'IntersectionObserver' in window) {
    root.classList.add('reveal-ready');
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    revealEls.forEach((el) => io.observe(el));
  }
})();
