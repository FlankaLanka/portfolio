// Builds the level: a hub island, four project islands, bridges, landmarks, cards, gems.
import * as THREE from 'three';
import { C, toon, ink, facet, textTexture, hatchMaterial, paperTexture } from './toon.js';
import { ZONES } from './catalog.js';

export const HUB_R = 4.6;
export const ZONE_R = 6;
export const ZONE_D = 13.2;
export const BRIDGE_W = 1.8;
export const SPAWN = { x: -1.5, z: 1.5 };

// Can the player stand here? (islands and bridges only)
export function walkable(x, z, margin = 0.35) {
  if (Math.hypot(x, z) < HUB_R - margin) return true;
  for (const zone of ZONES) {
    const [dx, dz] = zone.dir;
    if (Math.hypot(x - dx * ZONE_D, z - dz * ZONE_D) < ZONE_R - margin) return true;
    const along = x * dx + z * dz;
    const side = Math.abs(x * dz - z * dx);
    if (along > HUB_R - 0.9 && along < ZONE_D - ZONE_R + 0.9 && side < BRIDGE_W / 2 - 0.25) return true;
  }
  return false;
}

const basic = (opts) => new THREE.MeshBasicMaterial(opts);

function gearGeometry(teeth, outer, root, hole, depth = 0.36) {
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    [[root, 0], [root, 0.22], [outer, 0.34], [outer, 0.66], [root, 0.78]].forEach(([r, f], j) => {
      const x = Math.cos(a + step * f) * r;
      const y = Math.sin(a + step * f) * r;
      if (i === 0 && j === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    });
  }
  shape.closePath();
  const h = new THREE.Path();
  h.absarc(0, 0, hole, 0, Math.PI * 2, true);
  shape.holes.push(h);
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 10 });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

// ---- Landmarks: one per island. Each returns { group, radius, update }. ----

function arcade() {
  const group = new THREE.Group();
  const body = ink(new THREE.BoxGeometry(1.6, 2.5, 1.2), C.games, { outline: 0.06 });
  body.position.y = 1.25;
  const top = ink(new THREE.BoxGeometry(1.74, 0.5, 1.34), C.paper, { outline: 0.06 });
  top.position.y = 2.76;
  const marquee = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4),
    basic({ map: textTexture('INSERT COIN', { w: 512, h: 128, font: '700 58px "Space Mono", monospace' }), transparent: true }));
  marquee.position.set(0, 2.76, 0.675);
  const bezel = ink(new THREE.BoxGeometry(1.32, 1.02, 0.1), C.dark, { outline: 0.04 });
  bezel.position.set(0, 1.82, 0.62);

  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 48;
  const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.14, 0.855), basic({ map: tex }));
  screen.position.set(0, 1.82, 0.675);

  const deck = ink(new THREE.BoxGeometry(1.6, 0.16, 0.56), C.paper, { outline: 0.05 });
  deck.position.set(0, 1.12, 0.8);
  const stick = ink(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6), C.dark, { outline: 0.02 });
  stick.position.set(-0.42, 1.34, 0.82);
  const knob = ink(new THREE.SphereGeometry(0.1, 10, 8), C.product, { outline: 0.03 });
  knob.position.set(-0.42, 1.52, 0.82);
  const b1 = ink(new THREE.CylinderGeometry(0.09, 0.09, 0.07, 10), C.tech, { outline: 0.025 });
  b1.position.set(0.18, 1.23, 0.84);
  const b2 = ink(new THREE.CylinderGeometry(0.09, 0.09, 0.07, 10), C.ai, { outline: 0.025 });
  b2.position.set(0.46, 1.23, 0.78);
  group.add(body, top, marquee, bezel, screen, deck, stick, knob, b1, b2);

  // A tiny game of pong plays itself on the screen.
  const P = { bx: 32, by: 24, vx: 30, vy: 19, l: 24, r: 24, acc: 0 };
  const draw = () => {
    g.fillStyle = '#1c1c1c'; g.fillRect(0, 0, 64, 48);
    g.fillStyle = '#fffdf7';
    for (let y = 2; y < 48; y += 6) g.fillRect(31, y, 2, 3);
    g.fillRect(3, Math.round(P.l) - 5, 2, 10);
    g.fillRect(59, Math.round(P.r) - 5, 2, 10);
    g.fillStyle = '#e44c65';
    g.fillRect(Math.round(P.bx) - 1, Math.round(P.by) - 1, 3, 3);
    tex.needsUpdate = true;
  };
  draw();
  const update = (t, dt) => {
    P.acc += dt;
    if (P.acc < 1 / 30) return;
    const d = Math.min(P.acc, 0.1);
    P.acc = 0;
    P.bx += P.vx * d; P.by += P.vy * d;
    if (P.by < 3) { P.by = 3; P.vy = Math.abs(P.vy); }
    if (P.by > 45) { P.by = 45; P.vy = -Math.abs(P.vy); }
    if (P.bx < 7) { P.bx = 7; P.vx = Math.abs(P.vx); }
    if (P.bx > 57) { P.bx = 57; P.vx = -Math.abs(P.vx); }
    P.l += (P.by - P.l) * Math.min(1, d * 7);
    P.r += (P.by - P.r) * Math.min(1, d * 6);
    draw();
  };
  return { group, radius: 1.2, update };
}

function gears() {
  const group = new THREE.Group();
  const stand = ink(facet(new THREE.CylinderGeometry(0.42, 0.66, 2.2, 6)), C.stone, { outline: 0.05 });
  stand.position.set(-0.45, 1.1, -0.1);
  const post = ink(facet(new THREE.CylinderGeometry(0.26, 0.4, 1.4, 6)), C.stone, { outline: 0.05 });
  post.position.set(1.36, 0.7, -0.1);
  const big = ink(gearGeometry(12, 1.36, 1.06, 0.3), C.tech, { outline: 0.05 });
  big.position.set(-0.45, 2.35, 0.3);
  const small = ink(gearGeometry(8, 0.94, 0.66, 0.2), C.product, { outline: 0.05 });
  small.position.set(1.36, 1.5, 0.3);
  const hubCap = ink(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 10), C.dark, { outline: 0.03 });
  hubCap.rotation.x = Math.PI / 2;
  hubCap.position.copy(big.position);
  const hubCap2 = hubCap.clone();
  hubCap2.scale.setScalar(0.7);
  hubCap2.position.copy(small.position);
  group.add(stand, post, big, small, hubCap, hubCap2);
  const update = (t) => {
    big.rotation.z = t * 0.45;
    small.rotation.z = -t * 0.45 * (12 / 8) + 0.2;
  };
  return { group, radius: 1.75, update };
}

function rocket() {
  const group = new THREE.Group();
  const pad = ink(facet(new THREE.CylinderGeometry(1.25, 1.4, 0.24, 10)), C.stone, { outline: 0.05 });
  pad.position.y = 0.12;
  const ship = new THREE.Group();
  const body = ink(new THREE.CylinderGeometry(0.56, 0.62, 1.9, 16), C.paper, { outline: 0.055 });
  body.position.y = 1.5;
  const nose = ink(new THREE.ConeGeometry(0.56, 1.0, 16), C.product, { outline: 0.055 });
  nose.position.y = 2.95;
  const band = ink(new THREE.CylinderGeometry(0.6, 0.6, 0.2, 16), C.product, { outline: 0.03 });
  band.position.y = 0.95;
  const nozzle = ink(new THREE.CylinderGeometry(0.3, 0.44, 0.34, 12), C.dark, { outline: 0.04 });
  nozzle.position.y = 0.4;
  const porthole = ink(new THREE.CylinderGeometry(0.24, 0.24, 0.12, 14), C.tech, { outline: 0.05 });
  porthole.rotation.x = Math.PI / 2;
  porthole.position.set(0, 1.85, 0.54);
  ship.add(body, nose, band, nozzle, porthole);
  for (let i = 0; i < 3; i++) {
    const fin = ink(new THREE.BoxGeometry(0.12, 0.9, 0.62), C.accent, { outline: 0.045 });
    const a = (i / 3) * Math.PI * 2 + Math.PI / 3;
    fin.position.set(Math.sin(a) * 0.78, 0.85, Math.cos(a) * 0.78);
    fin.rotation.y = a;
    ship.add(fin);
  }
  const flame = new THREE.Mesh(facet(new THREE.ConeGeometry(0.3, 0.95, 7)), basic({ color: C.accent }));
  flame.rotation.x = Math.PI;
  flame.position.y = -0.2;
  const flame2 = new THREE.Mesh(facet(new THREE.ConeGeometry(0.17, 0.6, 7)), basic({ color: 0xffe08a }));
  flame2.rotation.x = Math.PI;
  flame2.position.y = -0.06;
  ship.add(flame, flame2);
  group.add(pad, ship);
  const update = (t) => {
    ship.position.y = 0.75 + Math.sin(t * 1.5) * 0.14;
    ship.rotation.y = Math.sin(t * 0.4) * 0.25;
    const f = 0.85 + Math.sin(t * 23) * 0.12 + Math.sin(t * 37) * 0.08;
    flame.scale.set(1, f, 1);
    flame2.scale.set(1, 0.9 + Math.sin(t * 31) * 0.18, 1);
  };
  return { group, radius: 1.4, update };
}

function robot() {
  const group = new THREE.Group();
  const neck = ink(facet(new THREE.CylinderGeometry(0.36, 0.56, 0.8, 8)), C.stone, { outline: 0.05 });
  neck.position.y = 0.4;
  const head = new THREE.Group();
  head.position.y = 1.65;
  const skull = ink(new THREE.BoxGeometry(2.0, 1.56, 1.5), C.ai, { outline: 0.06 });
  const face = ink(new THREE.BoxGeometry(1.56, 0.96, 0.1), C.paper, { outline: 0.035 });
  face.position.set(0, 0.02, 0.76);
  const eyes = [-0.38, 0.38].map((x) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), basic({ color: C.ink }));
    e.position.set(x, 0.14, 0.83);
    e.userData.home = e.position.clone();
    return e;
  });
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.04), basic({ color: C.ink }));
  mouth.position.set(0, -0.24, 0.82);
  const earL = ink(new THREE.CylinderGeometry(0.24, 0.24, 0.2, 10), C.product, { outline: 0.04 });
  earL.rotation.z = Math.PI / 2;
  earL.position.set(-1.1, 0, 0);
  const earR = earL.clone();
  earR.position.x = 1.1;
  const mast = ink(new THREE.CylinderGeometry(0.035, 0.035, 0.6, 6), C.dark, { outline: 0.02 });
  mast.position.y = 1.08;
  const bulb = ink(new THREE.SphereGeometry(0.14, 12, 8), C.accent, { outline: 0.035 });
  bulb.position.y = 1.44;
  head.add(skull, face, ...eyes, mouth, earL, earR, mast, bulb);
  group.add(neck, head);

  const local = new THREE.Vector3();
  const update = (t, dt, ctx) => {
    head.position.y = 1.65 + Math.sin(t * 1.2) * 0.05;
    bulb.scale.setScalar(1 + Math.max(0, Math.sin(t * 4)) * 0.25);
    mouth.scale.x = 0.7 + Math.abs(Math.sin(t * 2.2)) * 0.4;
    // Turn toward whatever is worth looking at (the player, or the viewer).
    local.copy(ctx.look);
    group.worldToLocal(local);
    const yaw = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -1.1, 1.1);
    head.rotation.y += (yaw - head.rotation.y) * Math.min(1, dt * 3);
    const ex = THREE.MathUtils.clamp((yaw - head.rotation.y) * 0.25, -0.08, 0.08);
    const ey = THREE.MathUtils.clamp((local.y - 1.8) * 0.01, -0.05, 0.06);
    for (const e of eyes) e.position.set(e.userData.home.x + ex, e.userData.home.y + ey, e.userData.home.z);
  };
  return { group, radius: 1.45, update };
}

const LANDMARKS = { games: arcade, tech: gears, product: rocket, ai: robot };

// ---- Small props ----

function tree(s = 1) {
  const g = new THREE.Group();
  const trunk = ink(facet(new THREE.CylinderGeometry(0.11 * s, 0.16 * s, 0.6 * s, 6)), C.wood, { outline: 0.035 });
  trunk.position.y = 0.3 * s;
  const a = ink(facet(new THREE.ConeGeometry(0.66 * s, 1.0 * s, 7)), C.grass, { outline: 0.045 });
  a.position.y = 0.98 * s;
  const b = ink(facet(new THREE.ConeGeometry(0.48 * s, 0.85 * s, 7)), C.leaf, { outline: 0.045 });
  b.position.y = 1.56 * s;
  g.add(trunk, a, b);
  return g;
}

function rock(s = 1) {
  const m = ink(facet(new THREE.DodecahedronGeometry(0.42 * s)), C.stone, { outline: 0.04 });
  m.position.y = 0.26 * s;
  m.rotation.set(0.4, s * 2.1, 0.2);
  return m;
}

function cloud() {
  const g = new THREE.Group();
  [[0, 0, 0, 1], [0.95, -0.12, 0.1, 0.72], [-0.9, -0.14, -0.1, 0.66], [0.25, 0.3, -0.25, 0.62]].forEach(([x, y, z, s]) => {
    const m = ink(new THREE.IcosahedronGeometry(s, 1), C.white, { outline: 0.06 });
    m.position.set(x, y, z);
    g.add(m);
  });
  g.scale.set(1.5, 1.0, 1.2);
  return g;
}

export function buildWorld({ scene, catalog, data, manager }) {
  const loader = new THREE.TextureLoader(manager);
  const pickRoots = [];
  const colliders = [];
  const gems = [];
  const updaters = [];
  const floats = [];
  const hatch = hatchMaterial();

  const shadow = (parent, x, z, w, d = w) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), hatch);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.02, z);
    m.raycast = () => {};
    parent.add(m);
    return m;
  };
  const bind = (id, object, props) => {
    const e = catalog.get(id);
    Object.assign(e, { object }, props);
    object.userData.entityId = id;
    pickRoots.push(object);
    return e;
  };

  const island = (x, z, r, color) => {
    const side = ink(new THREE.CylinderGeometry(r, r * 0.9, 1.0, 48), color, { outline: 0.07 });
    side.position.set(x, -0.5, z);
    const under = ink(facet(new THREE.ConeGeometry(r * 0.9, r * 0.95, 9)), C.stone, { outline: 0.07 });
    under.rotation.x = Math.PI;
    under.position.set(x, -1.0 - r * 0.475, z);
    const top = new THREE.Mesh(new THREE.CircleGeometry(r - 0.03, 56), basic({ map: paperTexture(r / 1.6), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    top.rotation.x = -Math.PI / 2;
    top.position.set(x, 0.004, z);
    scene.add(side, under, top);
  };

  // ---- Hub ----
  island(0, 0, HUB_R, C.dark);
  const sign = new THREE.Group();
  const pole = ink(new THREE.CylinderGeometry(0.08, 0.1, 2.9, 8), C.wood, { outline: 0.035 });
  pole.position.y = 1.45;
  sign.add(pole);
  ZONES.forEach((zone, i) => {
    const [dx, dz] = zone.dir;
    const arm = new THREE.Group();
    arm.position.y = 2.55 - i * 0.42;
    arm.rotation.y = Math.atan2(-dz, dx);
    const board = ink(new THREE.BoxGeometry(1.5, 0.36, 0.08), zone.color, { outline: 0.035 });
    board.position.x = 0.62;
    const label = basic({
      map: textTexture(`${zone.label.toUpperCase()} >`, { w: 384, h: 96, font: '700 52px "Space Mono", monospace', pad: 18 }),
      transparent: true,
    });
    const f = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.34), label);
    f.position.set(0.62, 0, 0.045);
    const backLabel = basic({
      map: textTexture(`< ${zone.label.toUpperCase()}`, { w: 384, h: 96, font: '700 52px "Space Mono", monospace', pad: 18 }),
      transparent: true,
    });
    const b = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.34), backLabel);
    b.position.set(0.62, 0, -0.045);
    b.rotation.y = Math.PI;
    arm.add(board, f, b);
    sign.add(arm);
  });
  shadow(sign, 0, 0, 1.3);
  scene.add(sign);
  colliders.push({ x: 0, z: 0, r: 0.5 });

  // Treasure chest: opens when every quest is done.
  const chest = new THREE.Group();
  chest.position.set(2.15, 0, 2.15);
  chest.rotation.y = -Math.PI * 0.75;
  const chestBase = ink(new THREE.BoxGeometry(1.1, 0.56, 0.76), C.wood, { outline: 0.05 });
  chestBase.position.y = 0.28;
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.56, -0.38);
  const lid = ink(new THREE.BoxGeometry(1.14, 0.3, 0.8), C.product, { outline: 0.05 });
  lid.position.set(0, 0.15, 0.38);
  const lock = ink(new THREE.BoxGeometry(0.2, 0.26, 0.08), C.dark, { outline: 0.03 });
  lock.position.set(0, 0.5, 0.41);
  lidPivot.add(lid);
  const trophy = ink(new THREE.OctahedronGeometry(0.3), C.accent, { outline: 0.04 });
  trophy.position.y = 0.4;
  trophy.visible = false;
  chest.add(chestBase, lidPivot, lock, trophy);
  shadow(chest, 0, 0, 1.7, 1.3);
  scene.add(chest);
  colliders.push({ x: 2.15, z: 2.15, r: 0.8 });
  const chestState = { open: 0, unlocked: false };
  bind('chest', chest, { anchor: new THREE.Vector3(2.15, 0.6, 2.15), focusDist: 9, focusAz: -Math.PI / 4, markerY: 1.9, near: 2.2 });
  updaters.push((t, dt) => {
    const goal = chestState.unlocked ? 1 : 0;
    chestState.open += (goal - chestState.open) * Math.min(1, dt * 3);
    lidPivot.rotation.x = -chestState.open * 1.9;
    lock.visible = chestState.open < 0.2;
    trophy.visible = chestState.open > 0.2;
    trophy.position.y = 0.4 + chestState.open * 1.0 + Math.sin(t * 2) * 0.08;
    trophy.rotation.y = t * 1.6;
  });

  const hubTree = tree(1.15);
  hubTree.position.set(2.3, 0, -2.3);
  shadow(hubTree, 0, 0, 1.5);
  const hubRock = rock(1.1);
  hubRock.position.set(-2.5, 0.28, -2.2);
  scene.add(hubTree, hubRock);
  colliders.push({ x: 2.3, z: -2.3, r: 0.45 }, { x: -2.5, z: -2.2, r: 0.5 });

  const gem = (x, z) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const body = ink(new THREE.OctahedronGeometry(0.27), C.accent, { outline: 0.04 });
    body.scale.y = 1.3;
    body.position.y = 0.95;
    g.add(body);
    const sh = shadow(g, 0, 0, 0.7);
    scene.add(g);
    gems.push({ group: g, body, shadow: sh, x, z, taken: false, phase: gems.length * 0.7, pop: 0 });
  };

  // ---- Islands ----
  for (const zone of ZONES) {
    const [dx, dz] = zone.dir;
    const cx = dx * ZONE_D;
    const cz = dz * ZONE_D;
    const out = Math.atan2(dz, dx);
    const at = (angle, radius) => [cx + Math.cos(out + angle) * radius, cz + Math.sin(out + angle) * radius];
    island(cx, cz, ZONE_R, zone.color);

    const ring = new THREE.Mesh(new THREE.RingGeometry(ZONE_R - 0.5, ZONE_R - 0.36, 72), basic({ color: zone.color, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(cx, 0.012, cz);
    scene.add(ring);

    // Bridge of planks from the hub.
    const from = HUB_R - 0.25;
    const to = ZONE_D - ZONE_R + 0.25;
    const planks = 6;
    for (let i = 0; i < planks; i++) {
      const d = from + ((i + 0.5) / planks) * (to - from);
      const plank = ink(new THREE.BoxGeometry(BRIDGE_W, 0.14, (to - from) / planks - 0.12), C.wood, { outline: 0.04 });
      plank.position.set(dx * d, -0.05 + (i % 2) * 0.012, dz * d);
      plank.rotation.y = Math.atan2(dx, dz);
      scene.add(plank);
    }
    gem(dx * (from + to) / 2, dz * (from + to) / 2);

    // Landmark faces the hub.
    const lm = LANDMARKS[zone.id]();
    lm.group.position.set(cx, 0, cz);
    lm.group.rotation.y = Math.atan2(-dx, -dz);
    shadow(lm.group, 0, 0, lm.radius * 2.5);
    scene.add(lm.group);
    updaters.push(lm.update);
    colliders.push({ x: cx, z: cz, r: lm.radius });

    const items = data.projects[zone.id] || [];
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({
      map: textTexture(`${zone.label.toUpperCase()} · ${items.length}`, {
        w: 512, h: 128, font: '700 60px "Space Mono", monospace', bg: '#fffdf7', border: 10,
      }),
    }));
    tag.scale.set(3.4, 0.85, 1);
    tag.position.y = zone.id === 'product' ? 5.3 : 4.3;
    lm.group.add(tag);
    bind(`zone:${zone.id}`, lm.group, {
      anchor: new THREE.Vector3(cx, 1.6, cz), focusDist: 21, focusAz: Math.atan2(-dx, -dz), markerY: tag.position.y + 0.9, cx, cz,
    });

    // Project cards stand in an arc on the far rim, facing the middle of the island.
    const n = items.length;
    const spread = n > 1 ? Math.min(2.8, 0.74 * (n - 1)) : 0;
    items.forEach((p, i) => {
      const a = n > 1 ? -spread / 2 + (spread * i) / (n - 1) : 0;
      const [px, pz] = at(a, ZONE_R - 1.55);
      const face = Math.atan2(cx - px, cz - pz);
      const root = new THREE.Group();
      root.position.set(px, 0, pz);
      root.rotation.y = face;
      const float = new THREE.Group();
      root.add(float);

      const frame = ink(new THREE.BoxGeometry(2.1, 2.1, 0.16), zone.color, { outline: 0.05 });
      frame.position.y = 1.9;
      const tex = loader.load(`${data.base}/images/cover/${p.slug}.jpg`);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const picture = basic({ map: tex });
      const picGeo = new THREE.PlaneGeometry(1.8, 1.8);
      const front = new THREE.Mesh(picGeo, picture);
      front.position.set(0, 1.9, 0.086);
      const back = new THREE.Mesh(picGeo, picture);
      back.position.set(0, 1.9, -0.086);
      back.rotation.y = Math.PI;

      const plate = ink(new THREE.BoxGeometry(2.1, 0.46, 0.16), C.paper, { outline: 0.05 });
      plate.position.y = 0.55;
      const name = basic({
        map: textTexture(p.title, { w: 512, h: 112, font: '700 46px "Space Mono", monospace', pad: 20 }),
        transparent: true,
      });
      const nameGeo = new THREE.PlaneGeometry(2.0, 0.4375);
      const nf = new THREE.Mesh(nameGeo, name);
      nf.position.set(0, 0.55, 0.086);
      const nb = new THREE.Mesh(nameGeo, name);
      nb.position.set(0, 0.55, -0.086);
      nb.rotation.y = Math.PI;

      float.add(frame, front, back, plate, nf, nb);
      shadow(root, 0, 0, 2.3, 0.9);
      scene.add(root);
      floats.push({ node: float, phase: i * 1.3 + cx * 0.2 });
      colliders.push({ x: px, z: pz, r: 0.95 });
      bind(`project:${p.slug}`, root, {
        anchor: new THREE.Vector3(px, 1.5, pz), focusDist: 10.5, focusAz: face + (a < 0 ? -0.62 : 0.62), markerY: 3.5,
        float, face, near: 2.7,
        stand: new THREE.Vector3(px + Math.sin(face) * 1.7, 0, pz + Math.cos(face) * 1.7),
      });
    });

    // Props fill the side of the island the cards leave free.
    const propAngles = n <= 2 ? [2.35, -2.35, 1.3, -1.3] : [2.4, -2.4];
    propAngles.forEach((a, i) => {
      const [x, z] = at(a, ZONE_R - 1.0);
      const prop = i === 3 ? rock(1.3) : tree(0.95 + (i % 2) * 0.3);
      prop.position.x = x;
      prop.position.z = z;
      if (i !== 3) shadow(prop, 0, 0, 1.4);
      scene.add(prop);
      colliders.push({ x, z, r: 0.45 });
    });
    [1.95, -1.95].forEach((a) => gem(...at(a, 3.5)));
  }

  // ---- Sky ----
  const sky = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const c = cloud();
    const a = (i / 7) * Math.PI * 2 + 0.4;
    const r = 24 + (i % 3) * 5;
    c.position.set(Math.cos(a) * r, -2 + (i % 4) * 2.2, Math.sin(a) * r);
    c.scale.multiplyScalar(0.8 + (i % 3) * 0.3);
    sky.add(c);
  }
  const lineMat = new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: 0.3 });
  const shapes = [
    new THREE.OctahedronGeometry(1.4), new THREE.BoxGeometry(1.8, 1.8, 1.8), new THREE.TetrahedronGeometry(1.7),
    new THREE.IcosahedronGeometry(1.4), new THREE.TorusGeometry(1.2, 0.4, 6, 10), new THREE.OctahedronGeometry(1.0),
    new THREE.BoxGeometry(1.2, 1.2, 1.2), new THREE.DodecahedronGeometry(1.3),
  ].map((geo, i) => {
    const s = new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineMat);
    const a = (i / 8) * Math.PI * 2;
    const r = 20 + (i % 3) * 4;
    s.position.set(Math.cos(a) * r, 5 + (i % 4) * 2.4, Math.sin(a) * r);
    sky.add(s);
    return s;
  });
  scene.add(sky);
  updaters.push((t, dt) => {
    sky.rotation.y = t * 0.012;
    shapes.forEach((s, i) => { s.rotation.x = t * (0.1 + i * 0.02); s.rotation.y = t * (0.14 + i * 0.015); });
  });

  // Faint editor grid far below the islands.
  const grid = new THREE.GridHelper(160, 64, C.ink, C.ink);
  grid.material.transparent = true;
  grid.material.opacity = 0.07;
  grid.position.y = -9;
  scene.add(grid);

  return { pickRoots, colliders, gems, updaters, floats, chestState };
}
