// Project and About pages: a live window into the same 3D world, parked at this page's spot.
import * as THREE from 'three';
import { buildCatalog } from './catalog.js';
import { buildWorld } from './world.js';
import { createPlayer } from './player.js';

const host = document.querySelector('.world-hero');
const dataEl = document.getElementById('cover-data');
if (host && dataEl) boot();

async function boot() {
  const data = JSON.parse(dataEl.textContent);
  const catalog = buildCatalog(data);
  const canvas = host.querySelector('canvas');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (err) {
    host.classList.add('is-off');
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  try {
    await Promise.race([document.fonts.load('700 40px "Space Mono"'), new Promise((r) => setTimeout(r, 1500))]);
  } catch (err) { /* fall back to the system monospace font */ }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 2, 0.5, 400);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xe6dfd0, 1.25));
  const sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sun.position.set(-7, 13, 9);
  scene.add(sun);

  const world = buildWorld({ scene, catalog, data, manager: new THREE.LoadingManager() });
  const player = createPlayer(scene);

  // Park the camera at this page's project, with the character standing beside its picture.
  const spot = catalog.get(host.dataset.focus);
  const target = new THREE.Vector3(player.root.position.x, 1.1, player.root.position.z);
  let baseAz = -Math.PI / 4;
  let dist = 10;
  let pol = 1.12;
  if (spot && spot.kind === 'project') {
    // Look at the picture from outside the island (both sides show it), so the
    // landmark and the rest of the world sit behind it instead of in the way.
    const fx = Math.sin(spot.face), fz = Math.cos(spot.face);
    const rx = Math.cos(spot.face), rz = -Math.sin(spot.face);
    baseAz = spot.face + Math.PI + 0.3;
    player.teleport(spot.anchor.x + fx * 1.5 - rx * 1.75, spot.anchor.z + fz * 1.5 - rz * 1.75);
    player.state.facing = baseAz;
    target.copy(spot.anchor).setY(1.8);
    dist = 8.5;
    pol = 1.27;
  }

  // Drag sideways to look around.
  let drag = null;
  let look = 0;
  canvas.addEventListener('pointerdown', (e) => { drag = { id: e.pointerId, x: e.clientX }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    look = THREE.MathUtils.clamp(look - (e.clientX - drag.x) * 0.005, -1.2, 1.2);
    drag.x = e.clientX;
  });
  const release = () => { drag = null; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  let sizeDirty = true;
  new ResizeObserver(() => { sizeDirty = true; }).observe(host);
  let visible = true;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(host);

  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = { look: new THREE.Vector3() };
  const still = { x: 0, z: 0 };
  let last = performance.now();
  let az = baseAz;
  let hop = 2.5;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible || document.hidden) return;
    const t = now / 1000;
    if (sizeDirty) {
      const w = host.clientWidth, h = host.clientHeight;
      if (w && h) {
        sizeDirty = false;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
    }
    hop -= dt;
    if (hop <= 0 && !calm) { player.jump(); hop = 4 + Math.random() * 3; }
    player.update(dt, t, still, az, world.colliders, true);
    ctx.look.copy(camera.position);
    for (const u of world.updaters) u(t, dt, ctx);
    if (!calm) for (const f of world.floats) f.node.position.y = Math.sin(t * 1.3 + f.phase) * 0.07;
    for (const g of world.gems) {
      g.body.rotation.y = t * 1.8 + g.phase;
      g.body.position.y = 0.95 + Math.sin(t * 2.2 + g.phase) * 0.12;
    }
    const want = baseAz + look + (calm ? 0 : Math.sin(t * 0.3) * 0.1);
    az += (want - az) * Math.min(1, dt * 5);
    const fit = THREE.MathUtils.clamp(1.9 / camera.aspect, 1, 1.9); // step back on narrow screens
    const sp = Math.sin(pol);
    camera.position.set(
      target.x + dist * fit * sp * Math.sin(az),
      target.y + dist * fit * Math.cos(pol),
      target.z + dist * fit * sp * Math.cos(az),
    );
    camera.lookAt(target);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}
