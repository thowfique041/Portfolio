// Development-themed, scroll-driven 3D background (Three.js).
//
// The camera glides forward as the visitor scrolls, anchored to each section:
//   hero → lit geometric solids · about → self-typing code editor ·
//   experience → live system architecture · skills → tech-stack orbit ·
//   projects → deploy terminal + git graph · research → neural network ·
//   contact → globe of deployed services.
//
// Performance & robustness:
//   - device-pixel-ratio capped, fewer particles and 30 fps cap on small screens
//   - rendering pauses while the tab is hidden; only nearby objects animate
//   - prefers-reduced-motion → a still frame, redrawn only on scroll/resize
//   - all geometries / materials / textures are disposed on theme change or stop()
//   - WebGL failures or context loss fall back to the CSS ambient layer
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

let renderer = null;
let state = null; // per-scene state, rebuilt on theme change

const SECTION_Z = { home: 10, about: -12, experience: -34, skills: -56, projects: -80, research: -102, education: -118, contact: -132 };

/* ======================================================================= */
export function start(canvas) {
  if (renderer) return;
  const small = matchMedia('(max-width: 700px)').matches;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, alpha: true, powerPreference: 'low-power' });
  } catch (e) {
    canvas.remove();
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.25 : 1.6));
  renderer.setClearColor(0x000000, 0);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); canvas.remove(); }, { once: true });
  build(canvas);
  document.documentElement.classList.add('has-bg3d');
}

export function restart(canvas) {
  if (!renderer) return start(canvas);
  teardownScene();
  build(canvas);
}

// Live GPU resource counts (useful for checking that theme switches don't leak).
export function debugInfo() {
  return renderer ? { ...renderer.info.memory, programs: renderer.info.programs?.length ?? 0 } : null;
}

export function stop() {
  teardownScene();
  if (renderer) { renderer.dispose(); renderer = null; }
  document.documentElement.classList.remove('has-bg3d');
}

/* ======================================================================= */
function teardownScene() {
  if (!state) return;
  cancelAnimationFrame(state.raf);
  state.abort.abort();
  state.scene.traverse((o) => {
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    mats.forEach((m) => { m.map?.dispose(); m.dispose(); });
  });
  state.textures.forEach((t) => t.dispose());
  state = null;
}

function build(canvas) {
  const root = document.documentElement;
  const css = getComputedStyle(root);
  const v = (n, f) => (css.getPropertyValue(n) || '').trim() || f;
  const light = root.getAttribute('data-theme') === 'light';
  const small = matchMedia('(max-width: 700px)').matches;
  const desktop = matchMedia('(min-width: 961px)').matches;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const HEX = {
    bg: v('--bg', '#080D1B'), card: v('--card', '#111C32'), text: v('--text', '#F8FAFC'), muted: v('--muted', '#94A3B8'),
    a1: light ? '#2563EB' : '#60A5FA', a2: light ? '#7C3AED' : '#8B5CF6', a3: light ? '#0EA5E9' : '#A5B4FC',
  };
  const C = Object.fromEntries(Object.entries(HEX).map(([k, val]) => [k, new THREE.Color(val)]));
  const MONO = '"DM Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  const BLEND = light ? THREE.NormalBlending : THREE.AdditiveBlending;
  const k = (small ? 0.55 : 1) * (light ? 0.75 : 1); // global strength of lines/labels

  const abort = new AbortController();
  const on = (t, ev, fn, opt = {}) => t.addEventListener(ev, fn, { ...opt, signal: abort.signal });
  const textures = [];

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(C.bg, light ? 0.024 : 0.021);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 220);

  /* --- lighting (used by the lit hero solids) --- */
  scene.add(new THREE.AmbientLight(light ? 0xffffff : 0x8090c0, light ? 0.9 : 0.35));
  const blueLight = new THREE.PointLight(0x3b82f6, light ? 30 : 60, 40, 1.6);
  const violetLight = new THREE.PointLight(0x8b5cf6, light ? 26 : 55, 40, 1.6);
  blueLight.position.set(8, 6, 4); violetLight.position.set(-8, -5, 2);
  scene.add(blueLight, violetLight);

  /* --- helpers --- */
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const rr = (g, x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
  const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; textures.push(t); return t; };
  const lineMat = (color, opacity) => new THREE.LineBasicMaterial({ color, transparent: true, opacity: opacity * k, blending: BLEND, depthWrite: false });
  const edges = (geo, color, opacity = 0.8) => { const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineMat(color, opacity)); geo.dispose(); return e; };
  const glow = (() => {
    const c = mkCanvas(64, 64), g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, '#fff'); grd.addColorStop(0.3, '#ffffffbb'); grd.addColorStop(1, '#fff0');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); textures.push(t); return t;
  })();

  function label(text, color, { size = 0.4, bg = true } = {}) {
    const fs = 44, pad = 22, m = mkCanvas(8, 8).getContext('2d');
    m.font = `500 ${fs}px ${MONO}`;
    const w = Math.ceil(m.measureText(text).width) + pad * 2, h = Math.round(fs + pad * 1.4);
    const c = mkCanvas(w, h), g = c.getContext('2d');
    if (bg) {
      g.fillStyle = HEX.card + 'ee'; rr(g, 2, 2, w - 4, h - 4, h / 2); g.fill();
      g.strokeStyle = color; g.globalAlpha = 0.55; g.lineWidth = 3; rr(g, 2, 2, w - 4, h - 4, h / 2); g.stroke(); g.globalAlpha = 1;
    }
    g.font = `500 ${fs}px ${MONO}`; g.fillStyle = bg ? HEX.text : color; g.textBaseline = 'middle';
    g.fillText(text, pad, h / 2 + 2);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(c), transparent: true, opacity: (small ? 0.55 : 0.92), depthWrite: false }));
    s.scale.set(size * w / h, size, 1);
    return s;
  }

  function windowChrome(g, c, title) {
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = HEX.card + 'f4'; rr(g, 0, 0, c.width, c.height, 26); g.fill();
    g.strokeStyle = HEX.a1 + '55'; g.lineWidth = 3; rr(g, 1.5, 1.5, c.width - 3, c.height - 3, 26); g.stroke();
    g.fillStyle = HEX.bg + 'aa'; rr(g, 0, 0, c.width, 64, 26); g.fill(); g.fillRect(0, 40, c.width, 24);
    ['#F87171', '#FBBF24', '#34D399'].forEach((col, i) => { g.fillStyle = col; g.beginPath(); g.arc(40 + i * 34, 32, 10, 0, 7); g.fill(); });
    g.fillStyle = HEX.muted; g.font = `500 24px ${MONO}`; g.textBaseline = 'alphabetic'; g.fillText(title, 160, 40);
  }

  function panel(w, h, cw, ch, draw) {
    const c = mkCanvas(cw, ch), g = c.getContext('2d'), t = tex(c);
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: small ? 0.4 : (light ? 0.7 : 0.62), depthWrite: false, side: THREE.DoubleSide })));
    const api = { group, redraw(...a) { draw(g, c, ...a); t.needsUpdate = true; } };
    api.redraw(1);
    return api;
  }

  const objects = []; // { group, z, update, mats, fade, near }
  const add = (group, z, update, near = 9) => {
    scene.add(group);
    const mats = [];
    group.traverse((o) => {
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      ms.forEach((m) => { m.userData.base ??= m.opacity; m.transparent = true; mats.push(m); });
    });
    objects.push({ group, z, update, mats, fade: 1, near });
    return group;
  };

  /* --- ambient: particles, drifting code glyphs, perspective grid --- */
  {
    const COUNT = small ? 420 : 1300;
    const pos = new Float32Array(COUNT * 3), col = new Float32Array(COUNT * 3), t = new THREE.Color();
    for (let i = 0; i < COUNT; i++) {
      const a = Math.random() * Math.PI * 2, r = 5 + Math.pow(Math.random(), 0.6) * 22;
      pos.set([Math.cos(a) * r, Math.sin(a) * r * 0.65, 14 - Math.random() * 175], i * 3);
      t.copy(C.a1).lerp(C.a2, Math.random());
      col.set([t.r, t.g, t.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      size: small ? 0.22 : 0.18, map: glow, vertexColors: true, transparent: true,
      opacity: light ? 0.45 : 0.75, depthWrite: false, blending: BLEND,
    }));
    add(pts, 0, (dt, time) => { pts.rotation.z = time * 0.008; });

    if (!small) {
      const GLYPHS = ['{ }', '</>', '=>', '( )', ';', '[ ]', '&&', '::', '!==', '$', '//', 'fn'];
      const glyphs = new THREE.Group();
      for (let i = 0; i < 40; i++) {
        const s = label(GLYPHS[i % GLYPHS.length], i % 2 ? HEX.a1 : HEX.a2, { size: 0.45 + Math.random() * 0.35, bg: false });
        s.material.opacity = light ? 0.22 : 0.3;
        const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 13;
        s.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.6, 8 - Math.random() * 160);
        s.userData.v = 0.15 + Math.random() * 0.3;
        glyphs.add(s);
      }
      add(glyphs, 0, (dt) => glyphs.children.forEach((s) => { s.position.y += s.userData.v * dt; if (s.position.y > 12) s.position.y = -12; }));
    }

    const grid = new THREE.GridHelper(80, 60, C.a1.clone().lerp(C.bg, light ? 0.55 : 0.6), C.a2.clone().lerp(C.bg, light ? 0.75 : 0.82));
    grid.position.set(0, -7.5, -75); grid.scale.z = 200 / 80;
    grid.material.transparent = true; grid.material.opacity = light ? 0.35 : 0.5;
    const step = (80 / 60) * grid.scale.z;
    add(grid, 0, (dt, time) => { grid.position.z = -75 + ((time * 1.1) % step); });
  }

  /* --- hero: lit geometric solids (frame the content, never cover it; none on phones) --- */
  if (!small) {
    const hero = new THREE.Group();
    const solidMat = (color) => new THREE.MeshStandardMaterial({
      color: light ? new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.55) : C.card,
      emissive: new THREE.Color(color), emissiveIntensity: light ? 0.05 : 0.12,
      roughness: 0.35, metalness: light ? 0.2 : 0.65, flatShading: true, transparent: true, opacity: 0.95,
    });
    const solids = [
      { geo: new THREE.IcosahedronGeometry(1.5, 0), color: HEX.a1, at: desktop ? [-21, 11.5, -17] : [-4.6, 6.4, -12] },
      { geo: new THREE.OctahedronGeometry(1.0, 0), color: HEX.a2, at: desktop ? [13, -7.2, -10] : [4, -6.2, -9] },
      { geo: new THREE.TorusKnotGeometry(0.9, 0.28, 90, 10), color: HEX.a2, at: desktop ? [16, 8, -18] : [4.6, 7.2, -16] },
      { geo: new THREE.DodecahedronGeometry(0.75, 0), color: HEX.a1, at: desktop ? [-21, -11, -15] : [-4.2, -7, -11] },
    ];
    const meshes = solids.map(({ geo, color, at }, i) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(geo, solidMat(color)));
      g.add(edges(geo.clone(), color, light ? 0.5 : 0.35));
      g.position.set(...at);
      g.userData = { base: at[1], phase: i * 1.7, spin: 0.15 + i * 0.05 };
      if (small) g.scale.setScalar(0.7);
      hero.add(g);
      return g;
    });
    add(hero, -10, (dt, time) => meshes.forEach((m) => {
      m.rotation.x += dt * m.userData.spin * 0.6; m.rotation.y += dt * m.userData.spin;
      m.position.y = m.userData.base + Math.sin(time * 0.6 + m.userData.phase) * 0.35;
    }), 4);
  }

  /* --- typing panels (code editor / terminal) --- */
  const KW = new Set(['export', 'class', 'constructor', 'private', 'readonly', 'async', 'await', 'const', 'return', 'import', 'from', 'new']);
  function drawCode(g, c, lines, shown, title, lineNo) {
    windowChrome(g, c, title);
    g.font = `500 25px ${MONO}`; g.textBaseline = 'alphabetic';
    const x0 = lineNo ? 86 : 34;
    let left = shown, caret = null;
    lines.forEach((ln, i) => {
      if (left < 0) return;
      const txt = ln.slice(0, left), y = 112 + i * 38;
      if (left <= ln.length) caret = { row: i, txt };
      left -= ln.length + 1;
      if (lineNo) { g.fillStyle = HEX.muted + '88'; g.fillText(String(i + 1).padStart(2, ' '), 26, y); }
      let x = x0;
      for (const p of txt.split(/(\/\/.*$|'[^']*'?|@\w+|\w+|\s+|.)/).filter(Boolean)) {
        let col = HEX.text;
        if (p.startsWith('//')) col = HEX.muted;
        else if (p[0] === "'") col = light ? '#0F766E' : '#5EEAD4';
        else if (p[0] === '@' || p === '$') col = HEX.a2;
        else if (KW.has(p)) col = HEX.a2;
        else if (/^[A-Z]/.test(p)) col = HEX.a1;
        else if (p === '✓') col = '#22C55E';
        g.fillStyle = col; g.fillText(p, x, y); x += g.measureText(p).width;
      }
    });
    if (caret && Math.floor(performance.now() / 420) % 2) {
      g.fillStyle = HEX.a1; g.fillRect(x0 + g.measureText(caret.txt).width + 2, 112 + caret.row * 38 - 24, 12, 30);
    }
  }
  function typingPanel(lines, title, lineNo, w, h) {
    const total = lines.join('\n').length;
    let shown = reduced ? total : Math.floor(total * 0.55), acc = 0, hold = 0;
    const pn = panel(w, h, 900, 140 + lines.length * 38, (g, c) => drawCode(g, c, lines, shown, title, lineNo));
    pn.update = (dt) => {
      acc += dt;
      if (acc < 0.04) return;
      acc = 0;
      if (shown >= total) { hold += 0.04; if (hold > 3.5) { shown = 0; hold = 0; } } else shown += 2;
      pn.redraw();
    };
    return pn;
  }

  /* --- about: code editor typing an API endpoint (not on phones: it would sit behind body text) --- */
  if (!small) {
    const code = typingPanel([
      "@Controller('orders')",
      'export class OrdersController {',
      '  constructor(private readonly orders: OrdersService) {}',
      '',
      '  @Post()',
      '  @UseGuards(JwtAuthGuard)',
      '  async create(@Body() dto: CreateOrderDto) {',
      '    const order = await this.orders.create(dto);',
      "    this.events.emit('order.created', order); // realtime",
      "    return { status: 'ok', id: order.id };",
      '  }',
      '}',
    ], 'orders.controller.ts', true, 6.2, 4.2);
    const z = SECTION_Z.about - 14;
    code.group.position.set(desktop ? -11 : 0, desktop ? -1.6 : -1.4, z);
    code.group.rotation.y = desktop ? 0.42 : 0;
    add(code.group, z, (dt) => code.update(dt));
  }

  /* --- experience: live system architecture --- */
  if (!small) {
    const arch = new THREE.Group();
    const browser = panel(3.2, 2.1, 640, 420, (g, c) => {
      windowChrome(g, c, 'localhost:3000/dashboard');
      g.fillStyle = HEX.a1 + '44'; rr(g, 30, 90, 150, 300, 14); g.fill();
      for (let i = 0; i < 3; i++) { g.fillStyle = HEX.muted + '22'; rr(g, 200 + i * 138, 90, 124, 90, 12); g.fill(); }
      g.fillStyle = HEX.muted + '18'; rr(g, 200, 200, 410, 190, 12); g.fill();
      [0.4, 0.6, 0.45, 0.8, 0.65, 0.9].forEach((val, i) => {
        const grd = g.createLinearGradient(0, 380 - 160 * val, 0, 380); grd.addColorStop(0, HEX.a1); grd.addColorStop(1, HEX.a2);
        g.fillStyle = grd; rr(g, 225 + i * 64, 380 - 160 * val, 40, 160 * val, 6); g.fill();
      });
    });
    browser.group.position.set(-3.1, 1.3, 0.4); browser.group.rotation.y = 0.25;
    arch.add(browser.group);

    const server = new THREE.Group();
    server.add(edges(new THREE.BoxGeometry(1.5, 2.3, 1.3), C.a1, 0.9));
    server.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.3, 1.3), new THREE.MeshBasicMaterial({ color: C.card, transparent: true, opacity: 0.6, depthWrite: false })));
    const leds = [];
    for (let r = 0; r < 4; r++) {
      const bay = edges(new THREE.BoxGeometry(1.3, 0.38, 0.02), C.a2, 0.5);
      bay.position.set(0, 0.75 - r * 0.5, 0.66); server.add(bay);
      for (let j = 0; j < 3; j++) {
        const led = new THREE.Mesh(new THREE.CircleGeometry(0.045, 12), new THREE.MeshBasicMaterial({ color: ['#34D399', HEX.a1, HEX.a2][j], transparent: true }));
        led.position.set(-0.45 + j * 0.14, 0.75 - r * 0.5, 0.68); server.add(led); leds.push(led);
      }
    }
    server.position.set(0.4, -0.3, 0);
    arch.add(server);

    const disk = (r, h, col, y) => {
      const g = new THREE.Group();
      g.add(edges(new THREE.CylinderGeometry(r, r, h, 32), col, 0.85));
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false })));
      g.position.y = y; return g;
    };
    const db = new THREE.Group(); [0, 0.55, 1.1].forEach((y) => db.add(disk(0.75, 0.42, C.a2, y)));
    db.position.set(3.4, 0.9, -0.2); arch.add(db);
    const cache = new THREE.Group(); cache.add(disk(0.5, 0.36, C.a3, 0)); cache.add(disk(0.5, 0.36, C.a3, 0.45));
    cache.position.set(3.2, -2.1, 0.3); arch.add(cache);
    const ai = new THREE.Group(); ai.add(edges(new THREE.IcosahedronGeometry(0.6, 1), C.a2, 0.9));
    ai.position.set(0.6, 2.9, -0.6); arch.add(ai);

    if (!small) {
      [['Next.js', HEX.a1, -3.1, 2.75, 0.4], ['REST API · NestJS', HEX.a1, 0.4, -1.95, 0.6], ['PostgreSQL', HEX.a2, 3.4, 2.7, -0.2],
        ['Redis · jobs', HEX.a3, 3.2, -2.85, 0.3], ['AI · RAG', HEX.a2, 0.6, 3.85, -0.6]].forEach(([t, col, x, y, z]) => {
        const s = label(t, col, { size: 0.34 }); s.position.set(x, y, z); arch.add(s);
      });
    }

    const links = [[browser.group.position, server.position, C.a1], [server.position, db.position, C.a2],
      [server.position, cache.position, C.a3], [server.position, ai.position, C.a2]];
    const packets = [];
    links.forEach(([a, b, col], li) => {
      const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 0.6, 0.5));
      const curve = new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
      arch.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)), lineMat(col, 0.5)));
      for (let j = 0; j < 2; j++) {
        const p = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: col, transparent: true, blending: BLEND, depthWrite: false }));
        p.scale.setScalar(0.26); arch.add(p);
        const pk = { p, curve, t: j / 2 + li * 0.12, speed: 0.25 + li * 0.04, back: j % 2 === 1 };
        p.position.copy(curve.getPoint(pk.t % 1)); packets.push(pk);
      }
    });

    const z = SECTION_Z.experience - 14;
    arch.scale.setScalar(desktop ? 1 : 0.62);
    arch.position.set(desktop ? -11.5 : 0, desktop ? -1.2 : -0.5, z);
    arch.rotation.y = desktop ? 0.45 : 0;
    add(arch, z, (dt, time) => {
      packets.forEach((pk) => { pk.t = (pk.t + dt * pk.speed) % 1; pk.p.position.copy(pk.curve.getPoint(pk.back ? 1 - pk.t : pk.t)); });
      leds.forEach((l, i) => { l.material.opacity = (Math.sin(time * (2.5 + (i % 5)) + i * 1.7) > 0.2 ? 1 : 0.3) * (l.material.userData.fadeK ?? 1); });
      ai.rotation.y += dt * 0.5;
    });
  }

  /* --- skills: tech-stack orbit --- */
  {
    const stack = ['React', 'Next.js', 'TypeScript', 'Node.js', 'NestJS', 'Express', 'FastAPI', 'PostgreSQL',
      'MongoDB', 'Redis', 'Docker', 'Tailwind', 'Python', 'PyTorch', 'LangChain', 'LangGraph', 'Hugging Face', 'Git'];
    const orbit = new THREE.Group();
    stack.forEach((t, i) => {
      const s = label(t, i % 2 ? HEX.a1 : HEX.a2, { size: 0.42 });
      s.material.opacity *= 0.75;
      const phi = Math.acos(1 - 2 * (i + 0.5) / stack.length), th = Math.PI * (1 + Math.sqrt(5)) * i;
      s.position.setFromSphericalCoords(4.4, phi, th); orbit.add(s);
    });
    orbit.add(edges(new THREE.IcosahedronGeometry(1.5, 1), C.a1, 0.6));
    [0, 1.1, 2.2].forEach((r, i) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.9 + i * 0.15, 0.01, 4, 120),
        new THREE.MeshBasicMaterial({ color: i === 1 ? C.a2 : C.a1, transparent: true, opacity: 0.35 * k }));
      ring.rotation.set(r, r * 0.7, 0); orbit.add(ring);
    });
    const z = SECTION_Z.skills - 14;
    orbit.position.set(desktop ? 12 : small ? 3 : 6, -1, z);
    if (!desktop) orbit.scale.setScalar(small ? 0.55 : 0.75);
    add(orbit, z, (dt) => { orbit.rotation.y += dt * 0.16; orbit.rotation.x = Math.sin(orbit.rotation.y * 0.5) * 0.15; });
  }

  /* --- projects: deploy terminal + git graph --- */
  if (!small) {
    const term = typingPanel([
      '$ git checkout -b feature/realtime-orders',
      "$ git commit -m 'feat: live order tracking'",
      '$ npm run test',
      '  ✓ all tests passed',
      '$ npm run build',
      '  ✓ build complete',
      '$ docker compose up -d',
      '  ✓ api   ✓ postgres   ✓ redis',
      '$ git push origin main',
      '  ✓ deployed to production',
    ], 'zsh — deploy', false, 6, 3.8);
    const z = SECTION_Z.projects - 14;
    term.group.position.set(desktop ? -11.5 : 0, desktop ? -1 : 0.6, z);
    term.group.rotation.y = desktop ? 0.45 : 0;
    add(term.group, z, (dt) => term.update(dt));

    if (desktop) {
      const git = new THREE.Group(), node = new THREE.SphereGeometry(0.15, 16, 12);
      const commit = (x, y, col) => { const m = new THREE.Mesh(node, new THREE.MeshBasicMaterial({ color: col, transparent: true })); m.position.set(x, y, 0); git.add(m); return m.position; };
      const seg = (p, col) => git.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), lineMat(col, 0.8)));
      const main = [0, 1, 2, 3, 4, 5, 6].map((i) => commit(0, -3 + i, C.a1)); seg(main, C.a1);
      seg([main[1], commit(1.2, -1.5, C.a2), commit(1.2, -0.5, C.a2), main[3]], C.a2);
      seg([main[4], commit(-1.2, 1.5, C.a3), commit(-1.2, 2.5, C.a3), main[6]], C.a3);
      const t1 = label('main', HEX.a1, { size: 0.34 }); t1.position.set(0.9, 3.1, 0); git.add(t1);
      const t2 = label('feature/*', HEX.a2, { size: 0.3 }); t2.position.set(2.4, -1, 0); git.add(t2);
      const pulse = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: C.a1, transparent: true, blending: BLEND, depthWrite: false }));
      pulse.scale.setScalar(0.7); git.add(pulse);
      git.position.set(12, -0.5, z - 6); git.rotation.y = -0.35;
      add(git, z - 6, (dt, time) => pulse.position.set(0, -3 + ((time * 0.6) % 6), 0));
    }
  }

  /* --- research: neural network with signal pulses --- */
  {
    const nn = new THREE.Group(), layers = [4, 6, 6, 3], nodes = [], dot = new THREE.SphereGeometry(0.12, 12, 10);
    layers.forEach((n, li) => {
      nodes[li] = [];
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(dot, new THREE.MeshBasicMaterial({ color: li % 2 ? C.a2 : C.a1, transparent: true }));
        m.position.set(-3 + li * 2, (i - (n - 1) / 2) * 0.9, 0); nn.add(m); nodes[li].push(m.position);
      }
    });
    const pts = [], sigs = [];
    for (let li = 0; li < layers.length - 1; li++) nodes[li].forEach((a) => nodes[li + 1].forEach((b) => { pts.push(a, b); if (Math.random() < 0.16) sigs.push([a, b]); }));
    nn.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat(C.a1, 0.18)));
    const sigGeo = new THREE.SphereGeometry(0.06, 8, 6);
    const sigMeshes = sigs.map(([a, b]) => { const m = new THREE.Mesh(sigGeo, new THREE.MeshBasicMaterial({ color: C.a3, transparent: true })); m.userData = { a, b, o: Math.random() }; m.position.copy(a); nn.add(m); return m; });
    if (!small) { const l = label('model.predict()', HEX.a2, { size: 0.34 }); l.position.set(0, 3.2, 0); nn.add(l); }
    const z = SECTION_Z.research - 14;
    nn.position.set(desktop ? 12 : small ? 2.6 : 6, 0, z); nn.rotation.y = desktop ? -0.3 : 0;
    if (!desktop) nn.scale.setScalar(0.7);
    add(nn, z, (dt, time) => sigMeshes.forEach((m) => m.position.lerpVectors(m.userData.a, m.userData.b, (time * 0.6 + m.userData.o) % 1)));
  }

  /* --- contact: globe of deployed services --- */
  {
    const globe = new THREE.Group();
    globe.add(edges(new THREE.IcosahedronGeometry(5, 2), C.a1, 0.3));
    const arcs = [], pGeo = new THREE.SphereGeometry(0.11, 8, 6);
    for (let i = 0; i < 9; i++) {
      const a = new THREE.Vector3().randomDirection().multiplyScalar(5), b = new THREE.Vector3().randomDirection().multiplyScalar(5);
      const mid = a.clone().add(b).normalize().multiplyScalar(7);
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b), col = i % 2 ? C.a2 : C.a1;
      globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)), lineMat(col, 0.55)));
      const p = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true }));
      p.position.copy(a); globe.add(p); arcs.push({ p, curve, o: Math.random() });
    }
    const z = SECTION_Z.contact - 22;
    globe.position.set(0, -0.5, z);
    if (!desktop) globe.scale.setScalar(0.75);
    add(globe, z, (dt, time) => { globe.rotation.y += dt * 0.07; arcs.forEach((a) => a.p.position.copy(a.curve.getPoint((time * 0.22 + a.o) % 1))); });
  }

  /* --- camera rig: scroll anchored to sections --- */
  let stops = [];
  const measure = () => {
    stops = Object.entries(SECTION_Z)
      .map(([id, z]) => { const el = document.getElementById(id); return el ? { y: el.getBoundingClientRect().top + scrollY - innerHeight * 0.2, z } : null; })
      .filter(Boolean)
      .sort((a, b) => a.y - b.y);
    if (stops.length) stops[0].y = 0;
  };
  const targetZ = () => {
    const y = scrollY;
    if (!stops.length) return 10;
    if (y <= stops[0].y) return stops[0].z;
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i], b = stops[i + 1];
      if (y <= b.y) { const t = (y - a.y) / Math.max(1, b.y - a.y); return a.z + (b.z - a.z) * (t * t * (3 - 2 * t)); }
    }
    return stops[stops.length - 1].z;
  };

  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    measure();
  };
  resize();

  let mx = 0, my = 0, cx = 0, cy = 0, camZ = targetZ(), running = !document.hidden, last = 0;
  on(window, 'resize', () => { resize(); if (reduced) requestDraw(); });
  on(window, 'load', measure);
  document.fonts?.ready.then(measure);
  if ('ResizeObserver' in window) { const ro = new ResizeObserver(() => measure()); ro.observe(document.body); abort.signal.addEventListener('abort', () => ro.disconnect()); }
  on(window, 'pointermove', (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; }, { passive: true });

  const clock = new THREE.Clock();
  const frameInterval = small ? 1000 / 30 : 0;

  const render = (dt, time, animate) => {
    const tz = targetZ();
    camZ += (tz - camZ) * (animate ? Math.min(1, dt * 3.2) : 1);
    cx += (mx - cx) * Math.min(1, dt * 2.5); cy += (my - cy) * Math.min(1, dt * 2.5);
    camera.position.set(cx * 2.2, -cy * 1.4 + 0.5, camZ);
    camera.lookAt(cx * 1.1, -cy * 0.5, camZ - 12);

    for (const o of objects) {
      if (o.z !== 0) {
        const d = camZ - o.z, f = Math.min(1, Math.max(0, (d - o.near) / 7)) * Math.min(1, Math.max(0, (34 - d) / 10));
        if (Math.abs(f - o.fade) > 0.005 || f === 0 || f === 1) {
          o.fade = f; o.group.visible = f > 0.01;
          o.mats.forEach((m) => { m.opacity = m.userData.base * f; m.userData.fadeK = f; });
        }
      }
      if (animate && o.update && o.group.visible && (o.z === 0 || Math.abs(camZ - 12 - o.z) < 28)) o.update(dt, time);
    }
    renderer.render(scene, camera);
  };

  const loop = (now) => {
    state.raf = requestAnimationFrame(loop);
    if (frameInterval && now - last < frameInterval) return;
    last = now;
    const dt = Math.min(clock.getDelta(), 0.05);
    render(dt, clock.elapsedTime, true);
  };

  let drawQueued = false;
  const requestDraw = () => {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(() => { drawQueued = false; if (state) render(1, 0, false); });
  };

  state = { scene, abort, textures, raf: 0 };

  if (reduced) {
    on(window, 'scroll', requestDraw, { passive: true });
    render(1, 0, false);
  } else {
    on(document, 'visibilitychange', () => {
      if (document.hidden) { running = false; cancelAnimationFrame(state.raf); clock.stop(); }
      else if (!running) { running = true; clock.start(); state.raf = requestAnimationFrame(loop); }
    });
    if (running) state.raf = requestAnimationFrame(loop);
    else render(0, 0, false);
  }
}
