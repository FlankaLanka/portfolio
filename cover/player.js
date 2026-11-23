// The player character: a little diamond-headed figure you can walk around the level.
import * as THREE from 'three';
import { C, ink, hatchMaterial } from './toon.js';
import { walkable, SPAWN } from './world.js';

const SPEED = 5.4;
const GRAVITY = 26;
const JUMP = 8.2;
const RADIUS = 0.42;

export function createPlayer(scene) {
  const root = new THREE.Group();
  root.position.set(SPAWN.x, 0, SPAWN.z);
  const rig = new THREE.Group();
  root.add(rig);

  const body = ink(new THREE.CapsuleGeometry(0.3, 0.32, 4, 12), C.dark, { outline: 0.045 });
  body.position.y = 0.66;
  const head = ink(new THREE.OctahedronGeometry(0.44), C.accent, { outline: 0.05 });
  head.position.y = 1.5;
  head.scale.y = 1.12;
  const eyeMat = new THREE.MeshBasicMaterial({ color: C.ink });
  const eyes = [-1, 1].map((sx) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), eyeMat);
    e.position.set(sx * 0.15, 0.1, 0.2);
    head.add(e);
    return e;
  });
  const feet = [-1, 1].map((sx) => {
    const f = ink(new THREE.SphereGeometry(0.13, 10, 8), C.dark, { outline: 0.035 });
    f.scale.set(1, 0.7, 1.35);
    f.position.set(sx * 0.17, 0.1, 0.04);
    rig.add(f);
    return f;
  });
  rig.add(body, head);

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), hatchMaterial());
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  root.add(shadow);
  scene.add(root);
  root.rotation.y = Math.atan2(-1, 1);

  // Dust puffs kicked up while walking.
  const puffs = Array.from({ length: 10 }, () => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), new THREE.MeshBasicMaterial({ color: C.stone, transparent: true }));
    m.visible = false;
    m.userData.life = 0;
    scene.add(m);
    return m;
  });
  let puffIndex = 0;
  let puffTimer = 0;

  const s = {
    vx: 0, vz: 0, vy: 0, y: 0, grounded: true, facing: root.rotation.y,
    walk: 0, squash: 0, speed: 0, target: null, blink: 0,
  };

  function jump() {
    if (!s.grounded) return;
    s.vy = JUMP;
    s.grounded = false;
    s.squash = -0.25;
  }

  function teleport(x, z) {
    root.position.set(x, 0, z);
    s.vx = s.vz = s.vy = 0;
    s.y = 0;
    s.grounded = true;
    s.target = null;
  }

  // input: { x, z } in camera space (-1..1), camAz: camera azimuth, frozen: ignore input.
  function update(dt, t, input, camAz, colliders, frozen) {
    let wx = 0;
    let wz = 0;
    if (!frozen) {
      if (input.x || input.z) {
        s.target = null;
        const fx = -Math.sin(camAz), fz = -Math.cos(camAz); // forward on the ground
        const rx = Math.cos(camAz), rz = -Math.sin(camAz);  // right on the ground
        wx = rx * input.x + fx * -input.z;
        wz = rz * input.x + fz * -input.z;
      } else if (s.target) {
        wx = s.target.x - root.position.x;
        wz = s.target.z - root.position.z;
        if (Math.hypot(wx, wz) < 0.18) { s.target = null; wx = wz = 0; }
      }
    }
    const len = Math.hypot(wx, wz);
    if (len > 1e-3) { wx /= len; wz /= len; }
    const k = 1 - Math.exp(-dt * 12);
    s.vx += (wx * SPEED - s.vx) * k;
    s.vz += (wz * SPEED - s.vz) * k;

    // Move one axis at a time so the player slides along edges.
    const p = root.position;
    const nx = p.x + s.vx * dt;
    if (walkable(nx, p.z)) p.x = nx; else { s.vx = 0; if (s.target) s.target = null; }
    const nz = p.z + s.vz * dt;
    if (walkable(p.x, nz)) p.z = nz; else { s.vz = 0; if (s.target) s.target = null; }
    for (const c of colliders) {
      const dx = p.x - c.x, dz = p.z - c.z;
      const d = Math.hypot(dx, dz);
      const min = c.r + RADIUS;
      if (d < min && d > 1e-4) {
        const tx = c.x + (dx / d) * min, tz = c.z + (dz / d) * min;
        if (walkable(tx, tz)) { p.x = tx; p.z = tz; }
      }
    }

    // Jump arc.
    if (!s.grounded) {
      s.vy -= GRAVITY * dt;
      s.y += s.vy * dt;
      if (s.y <= 0) { s.y = 0; s.vy = 0; s.grounded = true; s.squash = 0.3; }
    }
    s.speed = Math.hypot(s.vx, s.vz);
    const moving = s.speed > 0.4;

    if (moving) {
      const want = Math.atan2(s.vx, s.vz);
      let diff = want - s.facing;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      s.facing += diff * Math.min(1, dt * 14);
      s.walk += dt * s.speed * 2.1;
    }
    root.rotation.y = s.facing;

    // Squash and stretch, body bob, feet.
    s.squash += (0 - s.squash) * Math.min(1, dt * 9);
    const bob = moving && s.grounded ? Math.abs(Math.sin(s.walk)) * 0.09 : Math.sin(t * 2.2) * 0.025;
    rig.position.y = s.y + bob;
    rig.scale.set(1 + s.squash * 0.5, 1 - s.squash * 0.6, 1 + s.squash * 0.5);
    rig.rotation.x = moving ? 0.12 : 0;
    head.position.y = 1.5 + Math.sin(t * 2.2 + 1) * 0.04;
    head.rotation.y = moving ? 0 : Math.sin(t * 0.7) * 0.25;
    const swing = moving && s.grounded ? Math.sin(s.walk) * 0.2 : 0;
    feet[0].position.z = 0.04 + swing;
    feet[1].position.z = 0.04 - swing;
    feet[0].position.y = 0.1 + Math.max(0, swing) * 0.4;
    feet[1].position.y = 0.1 + Math.max(0, -swing) * 0.4;
    s.blink -= dt;
    if (s.blink < -0.12) s.blink = 2 + Math.random() * 3;
    const lid = s.blink < 0 ? 0.15 : 1;
    eyes[0].scale.y = eyes[1].scale.y = lid;
    const sh = 1 / (1 + s.y * 0.5);
    shadow.scale.set(sh, sh, 1);

    puffTimer -= dt;
    if (moving && s.grounded && puffTimer <= 0) {
      puffTimer = 0.16;
      const puff = puffs[puffIndex++ % puffs.length];
      puff.position.set(p.x - s.vx * 0.05, 0.12, p.z - s.vz * 0.05);
      puff.userData.life = 1;
      puff.visible = true;
    }
    for (const puff of puffs) {
      if (!puff.visible) continue;
      puff.userData.life -= dt * 2.4;
      const l = puff.userData.life;
      if (l <= 0) { puff.visible = false; continue; }
      puff.position.y += dt * 0.5;
      puff.scale.setScalar(0.5 + (1 - l) * 1.3);
      puff.material.opacity = l * 0.7;
    }
  }

  return { root, state: s, update, jump, teleport };
}
