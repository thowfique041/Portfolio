// Site-wide, development-themed 3D background.
// As the visitor scrolls, the camera flies past a live system architecture
// (browser → API → database / cache / AI with moving request packets), a code
// editor that types itself, a tech-stack orbit, a terminal running a deploy,
// a git commit graph, a neural network, and a globe of deployed services.
// Colours come from the CSS palette. Falls back silently without WebGL and
// stays still for prefers-reduced-motion.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

const canvas = document.querySelector('[data-bg3d]');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 700px)').matches;
const desktop = matchMedia('(min-width: 901px)').matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: true, powerPreference: 'low-power' });
} catch (e) {
  canvas?.remove();
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.6));
renderer.setClearColor(0x000000, 0);

/* ---------- palette (from CSS) ---------- */
const css = getComputedStyle(document.documentElement);
const cssVar = (n, f) => ((css.getPropertyValue(n) || '').trim() || f);
const HEX = {
  bg: cssVar('--bg', '#0d0910'), surface: cssVar('--surface', '#170f1b'), text: cssVar('--text', '#fbf1ee'),
  muted: cssVar('--muted', '#b9a6ab'), a1: cssVar('--accent', '#ff8a5c'), a2: cssVar('--blue', '#ff4f9a'),
  a3: cssVar('--violet', '#ffd166'),
};
const C = Object.fromEntries(Object.entries(HEX).map(([k, v]) => [k, new THREE.Color(v)]));
const MONO = '"DM Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(C.bg, 0.02);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
const DEPTH = 140;
const dim = mobile ? 0.5 : 1; // overall line/label strength

/* ---------- small helpers ---------- */
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
const tex = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const lineMat = (color, opacity) => new THREE.LineBasicMaterial({
  color, transparent: true, opacity: opacity * dim, blending: THREE.AdditiveBlending, depthWrite: false });
const edges = (geo, color, opacity = 0.8) => new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineMat(color, opacity));

// Text chip that always faces the camera.
function label(text, color = HEX.a1, { size = 0.42, bg = true } = {}) {
  const fs = 44, pad = 22, g0 = mkCanvas(8, 8).getContext('2d');
  g0.font = `500 ${fs}px ${MONO}`;
  const w = Math.ceil(g0.measureText(text).width) + pad * 2, h = fs + pad * 1.4;
  const c = mkCanvas(w, h), g = c.getContext('2d');
  if (bg) {
    g.fillStyle = HEX.surface + 'e6'; rr(g, 2, 2, w - 4, h - 4, h / 2); g.fill();
    g.strokeStyle = color; g.globalAlpha = 0.7; g.lineWidth = 3; rr(g, 2, 2, w - 4, h - 4, h / 2); g.stroke(); g.globalAlpha = 1;
  }
  g.font = `500 ${fs}px ${MONO}`; g.fillStyle = bg ? HEX.text : color; g.textBaseline = 'middle';
  g.fillText(text, pad, h / 2 + 2);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(c), transparent: true, opacity: mobile ? 0.6 : 0.95, depthWrite: false }));
  s.scale.set(size * w / h, size, 1);
  return s;
}

// A flat window panel (code editor, terminal, browser) drawn on a canvas.
function panel(w, h, cw, ch, draw) {
  const c = mkCanvas(cw, ch), g = c.getContext('2d'), t = tex(c);
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: mobile ? 0.55 : 0.92, depthWrite: false, side: THREE.DoubleSide })));
  group.add(edges(new THREE.PlaneGeometry(w, h), C.a1, 0.6));
  const api = { group, redraw(...a) { draw(g, c, ...a); t.needsUpdate = true; } };
  api.redraw(1);
  return api;
}
const chrome = (g, c, title) => { // window frame + traffic lights
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = HEX.surface + 'f2'; rr(g, 0, 0, c.width, c.height, 26); g.fill();
  g.fillStyle = HEX.bg + 'cc'; rr(g, 0, 0, c.width, 64, 26); g.fill(); g.fillRect(0, 40, c.width, 24);
  [HEX.a2, HEX.a3, HEX.a1].forEach((col, i) => { g.fillStyle = col; g.beginPath(); g.arc(40 + i * 34, 32, 10, 0, 7); g.fill(); });
  g.fillStyle = HEX.muted; g.font = `500 24px ${MONO}`; g.textBaseline = 'alphabetic'; g.fillText(title, 160, 40);
};

const sceneObjects = []; // { group, z, update(dt, time, near) }
const add = (group, z, update, near = 9) => {
  scene.add(group);
  // remember each material's resting opacity so objects can fade as the camera passes through them
  const mats = [];
  group.traverse(o => { if (o.material) { o.material.userData.base ??= o.material.opacity; mats.push(o.material); } });
  sceneObjects.push({ group, z, update, mats, fade: 1, near });
  return group;
};
const glowTex = (() => { const c = mkCanvas(64, 64), g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, '#fff'); grd.addColorStop(0.3, '#ffffffcc'); grd.addColorStop(1, '#fff0'); g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c); })();

/* ---------- background: particles + floating code glyphs + grid ---------- */
{
  const COUNT = mobile ? 700 : 1700, pos = new Float32Array(COUNT * 3), col = new Float32Array(COUNT * 3), t = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    const a = Math.random() * Math.PI * 2, r = 5 + Math.pow(Math.random(), 0.6) * 22;
    pos.set([Math.cos(a) * r, Math.sin(a) * r * 0.65, 12 - Math.random() * (DEPTH + 30)], i * 3);
    t.copy(C.a1).lerp(C.a2, Math.random()).lerp(C.a3, Math.random() * 0.3);
    col.set([t.r, t.g, t.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: mobile ? 0.26 : 0.22, map: glowTex,
    vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  add(pts, 0, (dt, time) => { pts.rotation.z = time * 0.01; });

  const GLYPHS = ['{ }', '</>', '=>', '( )', ';', '[ ]', '&&', '#', '::', '!==', '$', '//', '++', '%'];
  const glyphs = new THREE.Group();
  for (let i = 0; i < (mobile ? 22 : 60); i++) {
    const s = label(GLYPHS[i % GLYPHS.length], [HEX.a1, HEX.a2, HEX.a3][i % 3], { size: 0.5 + Math.random() * 0.4, bg: false });
    s.material.opacity = 0.35 * dim;
    const a = Math.random() * Math.PI * 2, r = 7 + Math.random() * 14;
    s.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.6, 8 - Math.random() * (DEPTH + 20));
    s.userData.v = 0.2 + Math.random() * 0.4;
    glyphs.add(s);
  }
  add(glyphs, 0, (dt) => glyphs.children.forEach(s => { s.position.y += s.userData.v * dt; if (s.position.y > 12) s.position.y = -12; }));

  const grid = new THREE.GridHelper(80, 60, C.a1.clone().lerp(C.bg, 0.65), C.a2.clone().lerp(C.bg, 0.85));
  grid.position.set(0, -7, -DEPTH / 2); grid.scale.z = (DEPTH + 40) / 80;
  grid.material.transparent = true; grid.material.opacity = 0.55;
  const step = 80 / 60 * grid.scale.z;
  add(grid, 0, (dt, time) => { grid.position.z = -DEPTH / 2 + ((time * 1.2) % step); });
}

/* ---------- 1 · hero: live system architecture ---------- */
{
  const arch = new THREE.Group();
  // Browser window with a mini dashboard UI
  const browser = panel(3.2, 2.1, 640, 420, (g, c) => {
    chrome(g, c, 'app.yoursite.com');
    g.fillStyle = HEX.a1 + '55'; rr(g, 30, 90, 150, 300, 14); g.fill();
    for (let i = 0; i < 3; i++) { g.fillStyle = HEX.text + '14'; rr(g, 200 + i * 138, 90, 124, 90, 12); g.fill(); }
    g.fillStyle = HEX.text + '10'; rr(g, 200, 200, 410, 190, 12); g.fill();
    [0.4, 0.6, 0.45, 0.8, 0.65, 0.9].forEach((v, i) => {
      const grd = g.createLinearGradient(0, 380 - 160 * v, 0, 380); grd.addColorStop(0, HEX.a1); grd.addColorStop(1, HEX.a2);
      g.fillStyle = grd; rr(g, 225 + i * 64, 380 - 160 * v, 40, 160 * v, 6); g.fill();
    });
  });
  browser.group.position.set(-3.1, 1.3, 0.4); browser.group.rotation.y = 0.25;
  arch.add(browser.group);

  // API server rack with blinking LEDs
  const server = new THREE.Group();
  server.add(edges(new THREE.BoxGeometry(1.5, 2.3, 1.3), C.a1, 0.9));
  server.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.3, 1.3),
    new THREE.MeshBasicMaterial({ color: C.surface, transparent: true, opacity: 0.55, depthWrite: false })));
  const leds = [];
  for (let r = 0; r < 4; r++) {
    const bay = edges(new THREE.BoxGeometry(1.3, 0.38, 0.02), C.a2, 0.5);
    bay.position.set(0, 0.75 - r * 0.5, 0.66); server.add(bay);
    for (let k = 0; k < 3; k++) {
      const led = new THREE.Mesh(new THREE.CircleGeometry(0.045, 12), new THREE.MeshBasicMaterial({ color: [C.a1, C.a3, C.a2][k], transparent: true }));
      led.position.set(-0.45 + k * 0.14, 0.75 - r * 0.5, 0.68); server.add(led); leds.push(led);
    }
  }
  server.position.set(0.4, -0.3, 0);
  arch.add(server);

  // Database (stacked disks) and cache
  const disk = (r, h, col, y) => { const g = new THREE.Group();
    g.add(edges(new THREE.CylinderGeometry(r, r, h, 32), col, 0.85));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32, 1, true),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false })));
    g.position.y = y; return g; };
  const db = new THREE.Group(); [0, 0.55, 1.1].forEach(y => db.add(disk(0.75, 0.42, C.a2, y)));
  db.position.set(3.4, 0.9, -0.2); arch.add(db);
  const cache = new THREE.Group(); cache.add(disk(0.5, 0.36, C.a3, 0)); cache.add(disk(0.5, 0.36, C.a3, 0.45));
  cache.position.set(3.2, -2.1, 0.3); arch.add(cache);

  // AI / LLM node
  const ai = new THREE.Group(); ai.add(edges(new THREE.IcosahedronGeometry(0.6, 1), C.a3, 0.9));
  ai.position.set(0.6, 2.9, -0.6); arch.add(ai);

  // Labels
  [['React · Next.js', HEX.a1, -3.1, 2.75, 0.4], ['REST API · NestJS', HEX.a1, 0.4, -1.95, 0.6], ['PostgreSQL', HEX.a2, 3.4, 2.7, -0.2],
   ['Redis', HEX.a3, 3.2, -2.85, 0.3], ['AI · RAG', HEX.a3, 0.6, 3.85, -0.6]].forEach(([t, col, x, y, z]) => {
    if (mobile) return; // keep the small screen uncluttered
    const s = label(t, col, { size: 0.36 }); s.position.set(x, y, z); arch.add(s); });

  // Connections with moving request / response packets
  const links = [[browser.group.position, server.position, C.a1], [server.position, db.position, C.a2],
    [server.position, cache.position, C.a3], [server.position, ai.position, C.a3]];
  const packets = [];
  links.forEach(([a, b, col], li) => {
    const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 0.6, 0.5));
    const curve = new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
    arch.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)), lineMat(col, 0.55)));
    for (let k = 0; k < 3; k++) {
      const p = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      p.scale.setScalar(0.32); arch.add(p);
      packets.push({ p, curve, t: k / 3 + li * 0.1, speed: 0.28 + li * 0.04, back: k % 2 === 1 });
      p.position.copy(curve.getPoint(packets.at(-1).t % 1));
    }
  });

  arch.scale.setScalar(desktop ? 1.02 : 0.6);
  arch.position.set(desktop ? 4.9 : 0.5, desktop ? 0.2 : -4.3, desktop ? -2.6 : -6);
  add(arch, -3, (dt, time) => {
    packets.forEach(k => { k.t = (k.t + dt * k.speed) % 1; k.p.position.copy(k.curve.getPoint(k.back ? 1 - k.t : k.t)); });
    leds.forEach((l, i) => { l.material.opacity = Math.sin(time * (3 + (i % 5)) + i * 1.7) > 0.2 ? 1 : 0.35; });
    ai.rotation.y += dt * 0.6; ai.rotation.x += dt * 0.3;
    arch.rotation.y = Math.sin(time * 0.25) * 0.12;
  }, 3);
}

/* ---------- syntax-highlighted typing panels ---------- */
const KW = new Set(['export', 'class', 'constructor', 'private', 'readonly', 'async', 'await', 'const', 'return', 'import', 'from', 'new']);
function drawCode(g, c, lines, shown, title, lineNo) {
  chrome(g, c, title);
  g.font = `500 25px ${MONO}`; g.textBaseline = 'alphabetic';
  const x0 = lineNo ? 86 : 34;
  let left = shown, caret = null;
  lines.forEach((ln, i) => {
    if (left < 0) return;
    const txt = ln.slice(0, left), y = 112 + i * 38;
    if (left <= ln.length) caret = { row: i, txt };
    left -= ln.length + 1;
    if (lineNo) { g.fillStyle = HEX.muted + '77'; g.fillText(String(i + 1).padStart(2, ' '), 26, y); }
    let x = x0;
    const parts = txt.split(/(\/\/.*$|'[^']*'?|"[^"]*"?|@\w+|\w+|\s+|.)/).filter(Boolean);
    for (const p of parts) {
      let col = HEX.text;
      if (p.startsWith('//')) col = HEX.muted;
      else if (p[0] === "'" || p[0] === '"') col = HEX.a3;
      else if (p[0] === '@' || p === '$') col = HEX.a2;
      else if (KW.has(p)) col = HEX.a1;
      else if (/^[A-Z]/.test(p)) col = HEX.a2;
      else if (p === '✓') col = '#7ee2a8';
      g.fillStyle = col; g.fillText(p, x, y); x += g.measureText(p).width;
    }
  });
  if (caret && Math.floor(performance.now() / 400) % 2) {
    g.fillStyle = HEX.a1; g.fillRect(x0 + g.measureText(caret.txt).width + 2, 112 + caret.row * 38 - 24, 12, 30);
  }
}
function typingPanel(lines, title, lineNo, w, h) {
  const total = lines.join('\n').length;
  const pn = panel(w, h, 900, 140 + lines.length * 38, (g, c, shown) => drawCode(g, c, lines, reduced ? total : shown, title, lineNo));
  let shown = Math.floor(total * 0.6), acc = 0, hold = 0;
  pn.redraw(shown);
  pn.update = (dt) => {
    acc += dt;
    if (acc < 0.035) return; acc = 0;
    if (shown >= total) { hold += 0.035; if (hold > 3.5) { shown = 0; hold = 0; } } else shown += 2;
    pn.redraw(shown);
  };
  return pn;
}

/* ---------- 2 · about / experience: a code editor typing an API endpoint ---------- */
{
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
  ], 'orders.controller.ts', true, 6.4, 4.3);
  code.group.position.set(desktop ? -7.2 : 0, desktop ? -0.4 : -1, -25);
  code.group.rotation.y = desktop ? 0.38 : 0;
  add(code.group, -25, (dt) => code.update(dt));
}

/* ---------- 3 · skills: tech stack orbit ---------- */
{
  const stack = ['React', 'Next.js', 'TypeScript', 'Node.js', 'NestJS', 'Express', 'FastAPI', 'PostgreSQL',
    'MongoDB', 'Redis', 'Docker', 'Socket.IO', 'REST', 'JWT', 'Git', 'LangChain', 'Python', 'Tailwind'];
  const orbit = new THREE.Group(), cols = [HEX.a1, HEX.a2, HEX.a3];
  stack.forEach((t, i) => {
    const s = label(t, cols[i % 3], { size: 0.5 });
    const phi = Math.acos(1 - 2 * (i + 0.5) / stack.length), th = Math.PI * (1 + Math.sqrt(5)) * i;
    s.position.setFromSphericalCoords(4.6, phi, th); orbit.add(s);
  });
  orbit.add(edges(new THREE.IcosahedronGeometry(1.6, 1), C.a1, 0.7));
  [0, 1.1, 2.2].forEach((r, i) => { const ring = new THREE.Mesh(new THREE.TorusGeometry(3 + i * 0.15, 0.01, 4, 120),
    new THREE.MeshBasicMaterial({ color: [C.a1, C.a2, C.a3][i], transparent: true, opacity: 0.35 * dim })); ring.rotation.set(r, r * 0.7, 0); orbit.add(ring); });
  orbit.position.set(desktop ? 7.5 : 0, 0, -48);
  add(orbit, -48, (dt) => { orbit.rotation.y += dt * 0.18; orbit.rotation.x = Math.sin(orbit.rotation.y * 0.5) * 0.15; });
}

/* ---------- 4 · projects: terminal deploy + git graph ---------- */
{
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
  ], 'zsh — deploy', false, 6.2, 3.9);
  term.group.position.set(desktop ? -7.4 : 0, desktop ? 0.3 : 0, -70);
  term.group.rotation.y = desktop ? 0.4 : 0;
  add(term.group, -70, (dt) => term.update(dt));

  // git graph: main line with two feature branches merging back
  const git = new THREE.Group(), node = new THREE.SphereGeometry(0.16, 16, 12);
  const commit = (x, y, col) => { const m = new THREE.Mesh(node, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: dim }));
    m.position.set(x, y, 0); git.add(m); return m.position; };
  const seg = (pts, col) => git.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat(col, 0.8)));
  const main = [0, 1, 2, 3, 4, 5, 6].map(i => commit(0, -3 + i, C.a1)); seg(main, C.a1);
  const f1 = [commit(1.2, -1.5, C.a2), commit(1.2, -0.5, C.a2)]; seg([main[1], ...f1, main[3]], C.a2);
  const f2 = [commit(-1.2, 1.5, C.a3), commit(-1.2, 2.5, C.a3)]; seg([main[4], ...f2, main[6]], C.a3);
  const tag = label('main', HEX.a1, { size: 0.36 }); tag.position.set(0.9, 3.1, 0); git.add(tag);
  const tag2 = label('feature/*', HEX.a2, { size: 0.32 }); tag2.position.set(2.4, -1, 0); git.add(tag2);
  const pulse = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: C.a1, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  pulse.scale.setScalar(0.8); git.add(pulse);
  git.position.set(desktop ? 7 : 2.5, 0, -76); git.rotation.y = desktop ? -0.35 : 0;
  add(git, -76, (dt, time) => { pulse.position.set(0, -3 + ((time * 0.6) % 6), 0); });
}

/* ---------- 5 · research: neural network with signal pulses ---------- */
{
  const nn = new THREE.Group(), layers = [4, 6, 6, 3], nodes = [], dot = new THREE.SphereGeometry(0.13, 12, 10);
  layers.forEach((n, li) => { nodes[li] = []; for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(dot, new THREE.MeshBasicMaterial({ color: [C.a1, C.a2, C.a2, C.a3][li], transparent: true, opacity: 0.9 * dim }));
    m.position.set(-3 + li * 2, (i - (n - 1) / 2) * 0.9, 0); nn.add(m); nodes[li].push(m.position); } });
  const pts = [], sigs = [];
  for (let li = 0; li < layers.length - 1; li++) nodes[li].forEach(a => nodes[li + 1].forEach(b => { pts.push(a, b); if (Math.random() < 0.18) sigs.push([a, b]); }));
  nn.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat(C.a2, 0.18)));
  const sigMeshes = sigs.map(([a, b]) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6),
    new THREE.MeshBasicMaterial({ color: C.a3 })); m.userData = { a, b, o: Math.random() }; m.position.copy(a); nn.add(m); return m; });
  const lbl = label('model.predict()', HEX.a3, { size: 0.36 }); lbl.position.set(0, 3.3, 0); nn.add(lbl);
  nn.position.set(desktop ? -1.5 : 0, 0.5, -97); nn.rotation.y = desktop ? 0.25 : 0;
  add(nn, -97, (dt, time) => sigMeshes.forEach(m => { m.position.lerpVectors(m.userData.a, m.userData.b, (time * 0.7 + m.userData.o) % 1); }));
}

/* ---------- 6 · contact: globe of deployed services ---------- */
{
  const globe = new THREE.Group();
  globe.add(edges(new THREE.IcosahedronGeometry(5, 2), C.a1, 0.35));
  const arcs = [];
  for (let i = 0; i < 9; i++) {
    const a = new THREE.Vector3().randomDirection().multiplyScalar(5), b = new THREE.Vector3().randomDirection().multiplyScalar(5);
    const mid = a.clone().add(b).normalize().multiplyScalar(7.2);
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b), col = [C.a1, C.a2, C.a3][i % 3];
    globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)), lineMat(col, 0.6)));
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: col }));
    p.position.copy(a); globe.add(p); arcs.push({ p, curve, o: Math.random() });
  }
  const ok = label('{ status: 200, message: "Let’s build" }', HEX.a1, { size: 0.5 }); ok.position.set(0, 6.4, 0); if (!mobile) globe.add(ok);
  globe.position.set(0, -0.5, -138);
  add(globe, -138, (dt, time) => { globe.rotation.y += dt * 0.08; arcs.forEach(k => k.p.position.copy(k.curve.getPoint((time * 0.25 + k.o) % 1))); });
}

/* ---------- interaction + loop ---------- */
let scrollT = 0, camZ = 10, mx = 0, my = 0, cx = 0, cy = 0;
const readScroll = () => { const max = document.documentElement.scrollHeight - innerHeight; scrollT = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0; };
addEventListener('scroll', readScroll, { passive: true });
addEventListener('pointermove', e => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; }, { passive: true });
const resize = () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
addEventListener('resize', () => { resize(); readScroll(); });
resize(); readScroll();

const clock = new THREE.Clock();
const frame = () => {
  const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
  camZ += (10 - scrollT * (DEPTH - 8) - camZ) * (reduced ? 1 : Math.min(1, dt * 3));
  cx += (mx - cx) * Math.min(1, dt * 2.5); cy += (my - cy) * Math.min(1, dt * 2.5);
  camera.position.set(cx * 2.4 + Math.sin(scrollT * Math.PI * 2) * 1.2, -cy * 1.6 + 0.6, camZ);
  camera.lookAt(cx * 1.2, -cy * 0.6, camZ - 12);
  sceneObjects.forEach(o => {
    if (o.z !== 0) {
      // fade out as the camera gets close, so nothing ever sits huge on top of the text
      const d = camZ - o.z, f = Math.min(1, Math.max(0, (d - o.near) / 7));
      if (Math.abs(f - o.fade) > 0.01 || f === 0 || f === 1) {
        o.fade = f; o.group.visible = f > 0.01;
        o.mats.forEach(m => { m.opacity = m.userData.base * f; });
      }
    }
    // only animate what is close to the camera (background layers always)
    if (!reduced && o.update && o.group.visible && (o.z === 0 || Math.abs(camZ - 12 - o.z) < 26)) o.update(dt, time);
  });
  renderer.render(scene, camera);
  if (!reduced) requestAnimationFrame(frame);
};
if (reduced) { const draw = () => requestAnimationFrame(frame); addEventListener('scroll', draw, { passive: true }); addEventListener('resize', draw); }
frame();
document.documentElement.classList.add('has-bg3d');
