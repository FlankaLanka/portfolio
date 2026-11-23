// Home page: the portfolio as a small game-engine editor you can press Play on.
import * as THREE from 'three';
import { C, highlight } from './toon.js';
import { ZONES, buildCatalog } from './catalog.js';
import { buildWorld, walkable, HUB_R, ZONE_R, ZONE_D } from './world.js';
import { createPlayer } from './player.js';
import { createUI, esc } from './ui.js';

const data = JSON.parse(document.getElementById('cover-data').textContent);
const catalog = buildCatalog(data);
const stage = document.getElementById('stage');
const canvas = document.getElementById('scene');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = THREE.MathUtils.clamp;

// The page opens straight into the game. "edit" is the optional editor view.
const app = { mode: 'play', selected: 'player', hovered: null, modal: false, sheet: false, interacted: false, intro: true };
const quest = { zones: new Set(), gems: 0, complete: false };
let G = null; // everything 3D; stays null when WebGL is unavailable

const questInfo = () => ({ complete: quest.complete });

const ui = createUI(data, catalog, {
  select: (id, opts) => select(id, opts),
  hover: (id) => setHover(id),
  open: (id) => openEntity(id),
  play: () => setMode('play'),
  stop: () => setMode('edit'),
  sheet: (open) => toggleSheet(open),
  act: (name) => act(name),
  command: (text) => command(text),
  interact: () => interact(),
  closeCard: () => closeCard(),
});

// ---------------------------------------------------------------- selection

function select(id, { focus = true } = {}) {
  const e = catalog.get(id);
  if (!e) return;
  const prev = catalog.get(app.selected);
  app.selected = id;
  ui.setSelection(e, questInfo());
  if (!G) return;
  if (prev && prev.object && prev.id !== id && prev.id !== app.hovered) highlight(prev.object, false);
  if (e.object && e.kind !== 'player') highlight(e.object, true);
  if (app.mode !== 'edit') return;
  if (id === 'camera') { if (focus) resetView(); return; }
  if (focus) focusOn(e);
}

function setHover(id) {
  if (id === app.hovered) return;
  const prev = catalog.get(app.hovered);
  if (G && prev && prev.object && prev.id !== app.selected) highlight(prev.object, false);
  app.hovered = id;
  const e = catalog.get(id);
  if (G && e && e.object && e.kind !== 'player') highlight(e.object, true);
  ui.setHover(id);
}

function openEntity(id) {
  const e = catalog.get(id);
  if (e && e.href) location.href = e.href;
}

function act(name) {
  if (name === 'play') setMode('play');
  if (name === 'reset' && G) resetView();
  if (name === 'focus' && G) focusOn(catalog.get(app.selected));
}

// ---------------------------------------------------------------- console

function findProject(q) {
  const needle = q.trim().toLowerCase();
  if (!needle) return null;
  const all = [...catalog.values()].filter((e) => e.kind === 'project');
  return all.find((e) => e.slug === needle || e.title.toLowerCase() === needle)
    || all.find((e) => e.title.toLowerCase().includes(needle) || e.slug.includes(needle));
}

function command(text) {
  const raw = text.trim();
  if (!raw) return;
  ui.log(`&gt; ${esc(raw)}`, 'cmd');
  const [cmd, ...rest] = raw.toLowerCase().split(/\s+/);
  const arg = rest.join(' ');
  switch (cmd) {
    case 'help':
      ui.log('help · ls · select &lt;name&gt; · open &lt;name&gt; · play · stop · about · contact · clear');
      break;
    case 'ls':
      for (const z of ZONES) {
        const names = catalog.get(`zone:${z.id}`).children.map((id) => esc(catalog.get(id).title)).join(', ');
        ui.log(`${z.label}/  ${names}`);
      }
      break;
    case 'select': case 'goto': case 'find': {
      const e = findProject(arg);
      if (e) { select(e.id); ui.log(`Selected ${esc(e.title)}.`); } else ui.log(`Nothing called "${esc(arg)}". Try ls.`, 'warn');
      break;
    }
    case 'open': {
      const e = findProject(arg);
      if (e) { ui.log(`Opening ${esc(e.title)}...`); location.href = e.href; } else ui.log(`Nothing called "${esc(arg)}". Try ls.`, 'warn');
      break;
    }
    case 'play': setMode('play'); break;
    case 'stop': setMode('edit'); break;
    case 'about': location.href = `${data.base}/about/`; break;
    case 'contact': case 'hire': case 'email':
      ui.log(`Good call. <a href="mailto:${data.email}">${esc(data.email)}</a>`, 'good');
      break;
    case 'clear': ui.clearLog(); break;
    case 'sudo': ui.log('Nice try.', 'warn'); break;
    default: ui.log(`Unknown command "${esc(cmd)}". Type help.`, 'warn');
  }
}

// ---------------------------------------------------------------- 3D boot

async function boot() {
  ui.setSelection(catalog.get('player'), questInfo());
  ui.log('Scene "portfolio" loaded: 14 projects on 4 islands.'.replace('14', String([...catalog.values()].filter((e) => e.kind === 'project').length)));
  ui.log('Press Play to go back to the game. Type help for commands.');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (err) {
    document.body.classList.add('no-webgl');
    ui.sheet(true);
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  try {
    await Promise.race([document.fonts.load('700 40px "Space Mono"'), new Promise((r) => setTimeout(r, 1500))]);
  } catch (err) { /* fall back to the system monospace font */ }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 400);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xe6dfd0, 1.25));
  const sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sun.position.set(-7, 13, 9);
  scene.add(sun);

  const manager = new THREE.LoadingManager();
  manager.onProgress = (url, loaded, total) => ui.setLoading(loaded / total);
  manager.onLoad = () => ui.setLoading(1, true);
  manager.onError = () => ui.setLoading(1, true);

  const world = buildWorld({ scene, catalog, data, manager });
  const player = createPlayer(scene);
  Object.assign(catalog.get('player'), { object: player.root, focusDist: 9, near: 0 });
  player.root.userData.entityId = 'player';
  world.pickRoots.push(player.root);

  // Editor-style move gizmo on the selected object.
  const gizmo = new THREE.Group();
  [[0xd8455c, 'x'], [0x3c9a55, 'y'], [0x3b7fd0, 'z']].forEach(([color, axis]) => {
    const mat = new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true });
    const arm = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.8, 8), mat);
    shaft.position.y = 0.4;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 10), mat);
    tip.position.y = 0.95;
    shaft.renderOrder = tip.renderOrder = 20;
    arm.add(shaft, tip);
    if (axis === 'x') arm.rotation.z = -Math.PI / 2;
    if (axis === 'z') arm.rotation.x = Math.PI / 2;
    gizmo.add(arm);
  });
  scene.add(gizmo);

  // Bobbing marker over whatever you can interact with in play mode.
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), new THREE.MeshBasicMaterial({ color: C.accent }));
  marker.scale.y = 1.4;
  marker.visible = false;
  scene.add(marker);

  // Ring that shows where a click-to-walk is heading.
  const goal = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.4, 24),
    new THREE.MeshBasicMaterial({ color: C.accent, transparent: true, depthWrite: false }));
  goal.rotation.x = -Math.PI / 2;
  goal.visible = false;
  scene.add(goal);

  // Little shards for pickups and celebrations.
  const shardGeo = new THREE.OctahedronGeometry(0.11);
  const shardMats = [C.accent, C.work, C.tech, C.apps].map((color) => new THREE.MeshBasicMaterial({ color }));
  const shards = Array.from({ length: 48 }, (_, i) => {
    const m = new THREE.Mesh(shardGeo, shardMats[i % 4]);
    m.visible = false;
    m.userData = { v: new THREE.Vector3(), life: 0 };
    scene.add(m);
    return m;
  });
  let shardIndex = 0;
  const burst = (x, y, z, count, rainbow) => {
    for (let i = 0; i < count; i++) {
      const m = shards[shardIndex++ % shards.length];
      m.material = shardMats[rainbow ? i % 4 : 0];
      m.position.set(x, y, z);
      const a = Math.random() * Math.PI * 2;
      const s = 1.5 + Math.random() * 3;
      m.userData.v.set(Math.cos(a) * s, 3 + Math.random() * 4, Math.sin(a) * s);
      m.userData.life = 0.9 + Math.random() * 0.5;
      m.visible = true;
    }
  };

  const cam = {
    target: new THREE.Vector3(0, 2.4, 0), az: -Math.PI / 4, pol: 0.98, dist: 60,
    gTarget: new THREE.Vector3(0, 2.4, 0), gAz: -Math.PI / 4, gPol: 0.98, gDist: 50,
    overview: true, fit: 1,
  };
  const clampDist = (d) => clamp(d, 6, 95);
  const overviewDist = () => {
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const radius = camera.aspect < 1 ? 13.5 : 19.5;
    return clamp(Math.max(radius / (tanV * camera.aspect), 13 / tanV) * 0.98, 28, 80);
  };
  const nearestAngle = (a, ref) => a + Math.round((ref - a) / (Math.PI * 2)) * Math.PI * 2;

  G = { renderer, scene, camera, world, player, cam, gizmo };

  function resetView() {
    cam.overview = true;
    cam.gTarget.set(0, 2.4, 0);
    cam.gDist = overviewDist();
    cam.gPol = 0.98;
  }

  function focusOn(e) {
    if (!e || app.mode !== 'edit') return;
    app.interacted = true;
    cam.overview = false;
    if (e.kind === 'player') {
      cam.gTarget.set(player.root.position.x, 1.0, player.root.position.z);
      cam.gDist = 10 * cam.fit;
      cam.gPol = 1.05;
      return;
    }
    cam.gTarget.copy(e.anchor);
    cam.gDist = e.focusDist * cam.fit;
    cam.gAz = nearestAngle(e.focusAz, cam.gAz);
    cam.gPol = e.kind === 'project' ? 1.16 : 1.02;
  }
  G.resetView = resetView;
  G.focusOn = focusOn;

  // ---- sizing ----
  let sizeDirty = true;
  new ResizeObserver(() => { sizeDirty = true; }).observe(stage);
  function resize() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    sizeDirty = false;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    cam.fit = clamp(1.3 / camera.aspect, 1, 1.7);
    if (cam.overview) cam.gDist = overviewDist();
    if (app.mode === 'play') cam.gDist = 21 * cam.fit;
  }

  // ---- picking ----
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const tmp = new THREE.Vector3();
  function aim(x, y) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }
  function pick(x, y) {
    aim(x, y);
    for (const hit of ray.intersectObjects(world.pickRoots, true)) {
      let o = hit.object;
      while (o && !o.userData.entityId) o = o.parent;
      if (o) return o.userData.entityId;
    }
    return null;
  }

  // ---- walking routes (islands connect only through the hub) ----
  // Where a point sits on the hub-and-spoke map: part 0 = hub, 1 = bridge, 2 = island.
  const regionOf = (x, z) => {
    if (Math.hypot(x, z) < HUB_R - 0.3) return { zone: null, part: 0 };
    let zone = null;
    let bestDot = -Infinity;
    for (const zn of ZONES) {
      const d = x * zn.dir[0] + z * zn.dir[1];
      if (d > bestDot) { bestDot = d; zone = zn; }
    }
    const onIsland = Math.hypot(x - zone.dir[0] * ZONE_D, z - zone.dir[1] * ZONE_D) < ZONE_R - 0.3;
    return { zone, part: onIsland ? 2 : 1 };
  };
  const entryHub = (zn) => ({ x: zn.dir[0] * (HUB_R - 1.1), z: zn.dir[1] * (HUB_R - 1.1) });
  const entryIsland = (zn) => ({ x: zn.dir[0] * (ZONE_D - ZONE_R + 1.1), z: zn.dir[1] * (ZONE_D - ZONE_R + 1.1) });
  function detour(a, b, c) {
    const abx = b.x - a.x, abz = b.z - a.z;
    const len2 = abx * abx + abz * abz;
    if (len2 < 1e-6) return null;
    const t = ((c.x - a.x) * abx + (c.z - a.z) * abz) / len2;
    if (t <= 0.03 || t >= 0.97) return null;
    let nx = a.x + abx * t - c.x, nz = a.z + abz * t - c.z;
    const d = Math.hypot(nx, nz);
    if (d >= c.r + 0.7) return null;
    if (d < 1e-3) { nx = -abz; nz = abx; }
    const l = Math.hypot(nx, nz);
    nx /= l; nz /= l;
    const side = c.r + 1.05;
    const w = { x: c.x + nx * side, z: c.z + nz * side };
    if (walkable(w.x, w.z)) return w;
    const w2 = { x: c.x - nx * side, z: c.z - nz * side };
    return walkable(w2.x, w2.z) ? w2 : null;
  }
  function planRoute(from, to) {
    const a = regionOf(from.x, from.z);
    const b = regionOf(to.x, to.z);
    const pts = [];
    // Crossing between hub, bridge and island always goes through the bridge ends.
    const gates = (zn) => [entryHub(zn), entryIsland(zn)];
    const inward = (r, stop) => { for (let i = r.part - 1; i >= stop; i--) pts.push(gates(r.zone)[i]); };
    const outward = (r, start) => { for (let i = start; i < r.part; i++) pts.push(gates(r.zone)[i]); };
    if (a.zone && b.zone && a.zone !== b.zone) { inward(a, 0); outward(b, 0); }
    else if (a.part > b.part) inward(a, b.part);
    else if (b.part > a.part) outward(b, a.part);
    pts.push(to);
    const out = [];
    let prev = from;
    for (const p of pts) {
      for (const c of world.colliders) {
        const d = detour(prev, p, c);
        if (d) { out.push(d); prev = d; break; }
      }
      out.push(p);
      prev = p;
    }
    return out;
  }
  let route = [];
  let pending = null; // entity to open once the player walks up to it
  function walkTo(point, entityId = null) {
    let target = { x: point.x, z: point.z };
    const p = player.root.position;
    if (!walkable(target.x, target.z)) {
      // Pull the point back toward the player until it lands on solid ground.
      let found = null;
      for (let i = 1; i <= 40 && !found; i++) {
        const k = i / 40;
        const x = target.x + (p.x - target.x) * k, z = target.z + (p.z - target.z) * k;
        if (walkable(x, z, 0.5)) found = { x, z };
      }
      if (!found) return;
      target = found;
    }
    dismissIntro();
    route = planRoute({ x: p.x, z: p.z }, target);
    player.state.target = route.shift();
    pending = entityId;
    goal.position.set(target.x, 0.03, target.z);
    goal.visible = true;
    goal.userData.life = 1;
  }

  // ---- pointer ----
  const pointers = new Map();
  let drag = null;
  let pinch = 0;
  let hoverAt = null;
  const pinchDist = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
    if (pointers.size === 2) { pinch = pinchDist(); if (drag) drag.moved = true; }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const d = pinchDist();
      if (pinch > 0 && d > 0) cam.gDist = clampDist(cam.gDist * (pinch / d));
      pinch = d;
      cam.overview = false;
      return;
    }
    if (drag && e.pointerId === drag.id) {
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 5) {
        drag.moved = true;
        app.interacted = true;
        canvas.classList.add('is-drag');
        ui.tooltip(null);
      }
      if (drag.moved) {
        cam.gAz -= (e.clientX - drag.x) * 0.006;
        cam.gPol = clamp(cam.gPol - (e.clientY - drag.y) * 0.005, 0.3, 1.42);
      }
      drag.x = e.clientX;
      drag.y = e.clientY;
    } else if (e.pointerType === 'mouse') {
      hoverAt = { x: e.clientX, y: e.clientY };
    }
  });
  const release = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = 0;
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    canvas.classList.remove('is-drag');
    if (!d.moved && e.type === 'pointerup') click(e.clientX, e.clientY);
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', () => {
    hoverAt = null;
    if (!drag) { setHover(null); ui.tooltip(null); canvas.classList.remove('is-point'); }
  });
  canvas.addEventListener('wheel', (e) => {
    if (app.mode !== 'play' && window.innerWidth <= 900) return; // let the page scroll on small screens
    e.preventDefault();
    cam.gDist = clampDist(cam.gDist * Math.exp(e.deltaY * 0.0012));
    cam.overview = false;
    app.interacted = true;
  }, { passive: false });
  canvas.addEventListener('dblclick', (e) => {
    if (app.mode !== 'edit') return;
    const id = pick(e.clientX, e.clientY);
    if (id) openEntity(id);
  });

  function click(x, y) {
    const id = pick(x, y);
    if (app.mode === 'edit') {
      if (id) select(id);
      return;
    }
    if (app.modal) return;
    const e = id && catalog.get(id);
    if (e && (e.kind === 'project' || e.kind === 'chest')) {
      walkTo(e.stand, id);
      return;
    }
    aim(x, y);
    if (ray.ray.intersectPlane(ground, tmp)) walkTo(tmp);
  }

  // ---- keyboard ----
  const keys = new Set();
  const isControl = (el) => el && el !== canvas && el.closest && el.closest('button, a, input, textarea, select');
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input, textarea')) return;
    const k = e.key.toLowerCase();
    if (app.mode === 'play') {
      if (k === 'escape') { e.preventDefault(); if (app.sheet) toggleSheet(false); else closeCard(); return; }
      if (app.modal) return;
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) { e.preventDefault(); keys.add(k); dismissIntro(); return; }
      if (isControl(e.target)) return;
      if (k === ' ') { e.preventDefault(); player.jump(); }
      if (k === 'e' || k === 'enter') { e.preventDefault(); interact(); }
      return;
    }
    if (isControl(e.target)) return;
    if (k === ' ' || k === 'p') { e.preventDefault(); setMode('play'); }
    if (k === 'f') focusOn(catalog.get(app.selected));
    if (k === 'escape') resetView();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());
  const input = { x: 0, z: 0 };
  const readInput = () => {
    input.x = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    input.z = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
    return input;
  };
  const still = { x: 0, z: 0 };

  // ---- progress: find the gems and the islands, and the chest opens ----
  const gemTotal = world.gems.length;
  const dismissIntro = () => {
    if (!app.intro) return;
    app.intro = false;
    ui.showIntro(false);
  };
  const refreshHud = () => ui.hud.progress(quest.gems, gemTotal);
  const checkComplete = () => {
    if (quest.complete || quest.zones.size < ZONES.length || quest.gems < gemTotal) return;
    quest.complete = true;
    world.chestState.unlocked = true;
    const c = catalog.get('chest').anchor;
    burst(c.x, 1.2, c.z, 40, true);
    ui.hud.toast('You found everything. <b>The chest in the middle is open.</b>');
    ui.log('Everything found. The treasure chest is open.', 'good');
    if (app.selected === 'chest') ui.setSelection(catalog.get('chest'), questInfo());
  };
  refreshHud();

  function openCard(id) {
    const e = catalog.get(id);
    if (!e) return;
    if (e.kind === 'chest') {
      if (!quest.complete) { ui.hud.toast('Locked. Find every gem and island first.'); return; }
      ui.hud.card({
        img: null, kicker: 'Quest complete', title: 'You found everything',
        desc: 'Thanks for playing. That was the whole tour. If you liked it, I would love to hear from you.',
        href: `mailto:${data.email}`, action: 'Email Frank',
      });
    } else {
      ui.hud.card({ img: e.thumb, kicker: e.zone.label, title: e.title, desc: e.desc, href: e.href, action: 'Learn more' });
    }
    app.modal = true;
    route = [];
    pending = null;
    player.state.target = null;
    keys.clear();
  }
  function closeCardNow() {
    if (!app.modal) return;
    app.modal = false;
    ui.hud.card(null);
    canvas.focus({ preventScroll: true });
  }
  let nearId = null;
  function interactNow() {
    if (app.mode === 'play' && !app.modal && nearId) openCard(nearId);
  }
  G.closeCard = closeCardNow;
  G.interact = interactNow;

  const interactables = [...catalog.values()].filter((e) => e.kind === 'project' || e.kind === 'chest');
  Object.assign(catalog.get('chest'), { stand: new THREE.Vector3(1.25, 0, 1.25) });

  function playTick(dt) {
    const p = player.root.position;
    // Islands
    for (const zn of ZONES) {
      if (quest.zones.has(zn.id)) continue;
      if (Math.hypot(p.x - zn.dir[0] * ZONE_D, p.z - zn.dir[1] * ZONE_D) < ZONE_R - 0.4) {
        quest.zones.add(zn.id);
        const n = catalog.get(`zone:${zn.id}`).children.length;
        ui.hud.toast(`<b>${zn.label}</b> · ${n} project${n === 1 ? '' : 's'}`);
        checkComplete();
      }
    }
    // Gems
    for (const g of world.gems) {
      if (g.taken) continue;
      if (Math.hypot(p.x - g.x, p.z - g.z) < 0.95 && player.state.y < 1.7) {
        g.taken = true;
        g.pop = 1;
        quest.gems += 1;
        burst(g.x, 1, g.z, 8, false);
        refreshHud();
        checkComplete();
      }
    }
    // What is close enough to interact with?
    let best = null;
    let bestD = Infinity;
    for (const e of interactables) {
      const d = Math.hypot(p.x - e.anchor.x, p.z - e.anchor.z);
      if (d < e.near && d < bestD) { best = e; bestD = d; }
    }
    const id = best ? best.id : null;
    if (id !== nearId) {
      nearId = id;
      if (!best) ui.hud.prompt(null);
      else if (best.kind === 'chest') ui.hud.prompt(quest.complete ? 'Open the chest' : 'Locked chest');
      else ui.hud.prompt(best.title);
    }
    // Walk the planned route, then open whatever was clicked.
    if (!player.state.target && route.length) player.state.target = route.shift();
    if (pending && !player.state.target && !route.length) {
      const e = catalog.get(pending);
      const close = Math.hypot(p.x - e.anchor.x, p.z - e.anchor.z) < e.near + 0.4;
      const id2 = pending;
      pending = null;
      if (close) openCard(id2);
    }
  }

  // ---- mode switch ----
  G.setMode = (mode) => {
    app.mode = mode;
    app.interacted = true;
    ui.setMode(mode);
    if (mode === 'play') {
      setHover(null);
      ui.tooltip(null);
      canvas.classList.remove('is-point');
      cam.overview = false;
      cam.gDist = 21 * cam.fit;
      cam.gPol = 0.9;
      nearId = null;
      ui.hud.prompt(null);
      canvas.focus({ preventScroll: true });
    } else {
      closeCardNow();
      keys.clear();
      route = [];
      pending = null;
      player.state.target = null;
      marker.visible = false;
      goal.visible = false;
      resetView();
      ui.log('Editor view. Click things to inspect them.');
    }
    sizeDirty = true;
  };
  G.onSheet = (open) => {
    app.sheet = open;
    app.modal = open;
    if (open) { route = []; pending = null; player.state.target = null; keys.clear(); }
    else canvas.focus({ preventScroll: true });
  };

  // ---- frame loop ----
  let visible = true;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(stage);
  const ctx = { look: new THREE.Vector3() };
  let last = performance.now();
  let fpsFrames = 0;
  let fpsTime = 0;
  let tick = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible || document.hidden) return;
    step(dt, now / 1000);
  }

  function step(dt, t) {
    if (sizeDirty) resize();
    const playing = app.mode === 'play';

    player.update(dt, t, playing && !app.modal ? readInput() : still, cam.az, world.colliders, !playing || app.modal);
    if (playing && (input.x || input.z)) { route = []; pending = null; }
    if (playing && !app.modal) playTick(dt);

    // Idle life
    const pp = player.root.position;
    if (playing) ctx.look.set(pp.x, 1.5, pp.z); else ctx.look.copy(camera.position);
    for (const u of world.updaters) u(t, dt, ctx);
    if (!reduceMotion) for (const f of world.floats) f.node.position.y = Math.sin(t * 1.3 + f.phase) * 0.07;
    for (const g of world.gems) {
      if (g.taken) {
        if (g.pop > 0) {
          g.pop -= dt * 4;
          g.body.scale.setScalar(Math.max(0, g.pop) * 1.6);
          g.body.position.y += dt * 4;
          if (g.pop <= 0) g.group.visible = false;
        }
        continue;
      }
      g.body.rotation.y = t * 1.8 + g.phase;
      g.body.position.y = 0.95 + Math.sin(t * 2.2 + g.phase) * 0.12;
    }
    for (const s of shards) {
      if (!s.visible) continue;
      s.userData.life -= dt;
      if (s.userData.life <= 0) { s.visible = false; continue; }
      s.userData.v.y -= 14 * dt;
      s.position.addScaledVector(s.userData.v, dt);
      s.rotation.x += dt * 9;
      s.rotation.y += dt * 7;
      s.scale.setScalar(Math.min(1, s.userData.life * 2));
    }
    if (goal.visible) {
      goal.userData.life -= dt * 1.2;
      goal.scale.setScalar(1 + (1 - goal.userData.life) * 0.8);
      goal.material.opacity = Math.max(0, goal.userData.life);
      if (goal.userData.life <= 0) goal.visible = false;
    }

    // Camera
    if (playing) cam.gTarget.set(pp.x, 1.1 + player.state.y * 0.35, pp.z);
    else if (app.selected === 'player' && !cam.overview) cam.gTarget.set(pp.x, 1.0, pp.z);
    else if (cam.overview && !app.interacted && !reduceMotion) cam.gAz += dt * 0.045;
    const k = 1 - Math.exp(-dt * (playing ? 6 : 4.2));
    cam.target.lerp(cam.gTarget, k);
    cam.az += (cam.gAz - cam.az) * k;
    cam.pol += (cam.gPol - cam.pol) * k;
    cam.dist += (cam.gDist - cam.dist) * k;
    const sp = Math.sin(cam.pol);
    camera.position.set(
      cam.target.x + cam.dist * sp * Math.sin(cam.az),
      cam.target.y + cam.dist * Math.cos(cam.pol),
      cam.target.z + cam.dist * sp * Math.cos(cam.az),
    );
    camera.lookAt(cam.target);

    // Gizmo (editor) and marker (play)
    const sel = catalog.get(app.selected);
    const showGizmo = !playing && sel && sel.object && sel.id !== 'camera';
    gizmo.visible = !!showGizmo;
    if (showGizmo) {
      if (sel.kind === 'player') gizmo.position.set(pp.x, 2.3, pp.z);
      else gizmo.position.set(sel.anchor.x, sel.markerY - 0.45, sel.anchor.z);
      gizmo.scale.setScalar(clamp(camera.position.distanceTo(gizmo.position) * 0.05, 0.5, 3));
    }
    const near = playing && nearId ? catalog.get(nearId) : null;
    marker.visible = !!near;
    if (near) {
      marker.position.set(near.anchor.x, near.markerY + Math.sin(t * 4) * 0.12, near.anchor.z);
      marker.rotation.y = t * 3;
    }

    // Hover (editor, mouse only)
    if (hoverAt && !playing && !drag) {
      const id = pick(hoverAt.x, hoverAt.y);
      setHover(id);
      canvas.classList.toggle('is-point', !!id);
      if (id) {
        const r = stage.getBoundingClientRect();
        ui.tooltip(catalog.get(id).title, hoverAt.x - r.left, hoverAt.y - r.top);
      } else ui.tooltip(null);
      hoverAt = null;
    }

    // Live Transform readout in the inspector
    if (++tick % 5 === 0 && sel) {
      if (sel.kind === 'player') ui.setTransform(pp.x, player.state.y, pp.z);
      else if (sel.kind === 'camera') ui.setTransform(camera.position.x, camera.position.y, camera.position.z);
      else if (sel.float) ui.setTransform(sel.anchor.x, sel.float.position.y, sel.anchor.z);
      else if (sel.anchor) ui.setTransform(sel.anchor.x, 0, sel.anchor.z);
    }

    renderer.render(scene, camera);

    fpsFrames += 1;
    fpsTime += dt;
    if (fpsTime >= 0.5) { ui.setFps(Math.round(fpsFrames / fpsTime)); fpsFrames = 0; fpsTime = 0; }
  }

  // ?debug exposes the internals and lets a test advance time by hand.
  if (new URLSearchParams(location.search).has('debug')) {
    let clock = 0;
    window.__cover = {
      app, quest, cam, player, world, catalog, camera, walkTo, setMode,
      run(seconds, dt = 1 / 30) { for (let i = 0; i < seconds / dt; i++) { clock += dt; step(dt, clock); } },
    };
  }

  resize();
  select('player', { focus: false });
  G.setMode('play');
  // Coming back from a project page (/#slug) drops you next to that project's picture.
  const from = catalog.get(`project:${decodeURIComponent(location.hash.slice(1))}`);
  if (from && from.stand) {
    player.teleport(from.stand.x, from.stand.z);
    player.state.facing = Math.atan2(from.anchor.x - from.stand.x, from.anchor.z - from.stand.z);
    cam.az = cam.gAz = from.focusAz;
    cam.target.set(from.stand.x, 1.1, from.stand.z);
    quest.zones.add(from.zone.id);
    dismissIntro();
  } else {
    cam.dist = cam.gDist * 3; // swoop in from above on first load
  }
  requestAnimationFrame(frame);
}

// Thin wrappers so the UI can call these before (or without) WebGL.
function resetView() { if (G) G.resetView(); }
function focusOn(e) { if (G) G.focusOn(e); }
function setMode(mode) { if (G && mode !== app.mode) G.setMode(mode); }
function closeCard() { if (G) G.closeCard(); }
function toggleSheet(open) { ui.sheet(open); if (G) G.onSheet(open); else app.sheet = open; }
function interact() { if (G) G.interact(); }

boot();
