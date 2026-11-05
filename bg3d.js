// Site-wide 3D background: a scroll-driven flight through a particle tunnel,
// past wireframe "stack" objects, with mouse parallax. Falls back silently
// if WebGL is unavailable and stays still for prefers-reduced-motion.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

const canvas = document.querySelector('[data-bg3d]');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 700px)').matches;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: true, powerPreference: 'low-power' });
} catch (e) {
  canvas?.remove();
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.6));
renderer.setClearColor(0x000000, 0);

// Colours come from the CSS palette so the scene always matches the page.
const css = getComputedStyle(document.documentElement);
const cssColor = (name, fallback) => new THREE.Color((css.getPropertyValue(name) || '').trim() || fallback);
const BG = cssColor('--bg', '#080b10'), TEAL = cssColor('--accent', '#64f4c4'),
  BLUE = cssColor('--blue', '#63a7ff'), VIOLET = cssColor('--violet', '#9b8cff');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(BG, 0.02);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);

const DEPTH = 140; // length of the flight path along -z

/* ---------- particle tunnel ---------- */
const COUNT = mobile ? 900 : 2200;
const pos = new Float32Array(COUNT * 3), col = new Float32Array(COUNT * 3);
const tmp = new THREE.Color();
for (let i = 0; i < COUNT; i++) {
  const a = Math.random() * Math.PI * 2, r = 4 + Math.pow(Math.random(), 0.6) * 22;
  pos[i * 3] = Math.cos(a) * r;
  pos[i * 3 + 1] = Math.sin(a) * r * 0.65;
  pos[i * 3 + 2] = 12 - Math.random() * (DEPTH + 30);
  tmp.copy(TEAL).lerp(BLUE, Math.random()).lerp(VIOLET, Math.random() * 0.35);
  col.set([tmp.r, tmp.g, tmp.b], i * 3);
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
const dot = (() => { // soft round sprite
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, '#fff'); grd.addColorStop(0.25, '#ffffffaa'); grd.addColorStop(1, '#fff0');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
  size: mobile ? 0.3 : 0.26, map: dot, vertexColors: true, transparent: true, opacity: 1,
  depthWrite: false, blending: THREE.AdditiveBlending
}));
scene.add(particles);

/* ---------- perspective grid floor ---------- */
const grid = new THREE.GridHelper(80, 60, TEAL.clone().lerp(BG, 0.65), BLUE.clone().lerp(BG, 0.85));
grid.position.set(0, -7, -DEPTH / 2);
grid.scale.z = (DEPTH + 40) / 80;
grid.material.transparent = true; grid.material.opacity = 0.6;
scene.add(grid);

/* ---------- wireframe objects along the path (one per section) ---------- */
const wire = (geo, color, opacity = 0.8) => {
  const group = new THREE.Group();
  group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: opacity * (mobile ? 0.45 : 1), blending: THREE.AdditiveBlending })));
  group.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.07, depthWrite: false })));
  return group;
};
const side = mobile ? 0 : 1;
const objects = [
  // hero: the "core" — icosahedron with an orbiting ring
  { obj: wire(new THREE.IcosahedronGeometry(3.6, 1), TEAL, 0.95), at: mobile ? [2.6, -4.2, -9] : [4.2, 0.4, -6], spin: [0.12, 0.18] },
  { obj: wire(new THREE.TorusGeometry(5.4, 0.04, 6, 90), BLUE, 0.8), at: mobile ? [2.6, -4.2, -9] : [4.2, 0.4, -6], spin: [0.05, -0.22], tilt: 1.2 },
  // about / experience
  { obj: wire(new THREE.OctahedronGeometry(2.2, 0), BLUE), at: [-7 * side || -2, 2.5, -26], spin: [0.2, 0.1] },
  // skills: torus knot = interconnected stack
  { obj: wire(new THREE.TorusKnotGeometry(2.2, 0.55, 90, 10), TEAL, 0.6), at: [7 * side || 2, -1, -48], spin: [0.08, 0.15] },
  // projects: stacked layers (frontend / api / db)
  ...[0, 1, 2].map(k => ({ obj: wire(new THREE.BoxGeometry(5, 0.35, 3.4), k === 1 ? TEAL : BLUE, 0.8),
    at: [-7 * side || -1.5, -1.6 + k * 1.5, -72], spin: [0, 0.25 - k * 0.08] })),
  // research
  { obj: wire(new THREE.DodecahedronGeometry(2.4, 0), VIOLET, 0.8), at: [7 * side || 1.5, 1.5, -96], spin: [0.14, 0.12] },
  // contact: big calm sphere at the end of the flight
  { obj: wire(new THREE.IcosahedronGeometry(5, 2), TEAL, 0.45), at: [0, 0, -128], spin: [0.03, 0.06] },
];
objects.forEach(o => { o.obj.position.set(...o.at); if (o.tilt) o.obj.rotation.x = o.tilt; scene.add(o.obj); });

/* ---------- interaction state ---------- */
let scrollT = 0, camZ = 10, mx = 0, my = 0, cx = 0, cy = 0;
const readScroll = () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  scrollT = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
};
addEventListener('scroll', readScroll, { passive: true });
addEventListener('pointermove', e => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; }, { passive: true });

const resize = () => {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
};
addEventListener('resize', () => { resize(); readScroll(); });
resize(); readScroll();

/* ---------- loop ---------- */
const clock = new THREE.Clock();
const frame = () => {
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  const targetZ = 10 - scrollT * (DEPTH - 8);
  camZ += (targetZ - camZ) * (reduced ? 1 : Math.min(1, dt * 3));
  cx += (mx - cx) * Math.min(1, dt * 2.5); cy += (my - cy) * Math.min(1, dt * 2.5);

  camera.position.set(cx * 2.4 + Math.sin(scrollT * Math.PI * 2) * 1.2, -cy * 1.6 + 0.6, camZ);
  camera.lookAt(cx * 1.2, -cy * 0.6, camZ - 12);

  if (!reduced) {
    objects.forEach(o => { o.obj.rotation.y += o.spin[1] * dt; o.obj.rotation.x += o.spin[0] * dt; });
    particles.rotation.z = t * 0.012;
    grid.position.z = -DEPTH / 2 + ((t * 1.2) % (80 / 60 * grid.scale.z));
  }
  renderer.render(scene, camera);
  if (!reduced) requestAnimationFrame(frame);
};
if (reduced) {
  // Still: redraw only when the page scrolls or resizes.
  const draw = () => requestAnimationFrame(frame);
  addEventListener('scroll', draw, { passive: true });
  addEventListener('resize', draw);
}
frame();
document.documentElement.classList.add('has-bg3d');
