// Ink-and-paper rendering helpers: flat toon colours, thick ink outlines, canvas textures.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const C = {
  ink: 0x222222,
  paper: 0xfffdf7,
  white: 0xffffff,
  accent: 0xe44c65,
  product: 0xf5b83d,
  ai: 0x8e6fe0,
  tech: 0x4a90d9,
  games: 0xe44c65,
  grass: 0x7cc58a,
  leaf: 0x5fb074,
  wood: 0xc9905a,
  stone: 0xbdb7aa,
  dark: 0x2b2b2b,
};

const ramp = new THREE.DataTexture(new Uint8Array([150, 215, 255]), 3, 1, THREE.RedFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
ramp.needsUpdate = true;

const toonCache = new Map();
export function toon(color) {
  if (!toonCache.has(color)) {
    toonCache.set(color, new THREE.MeshToonMaterial({ color, gradientMap: ramp }));
  }
  return toonCache.get(color);
}

const outlineCache = new Map();
export function outlineMaterial(thickness, color = C.ink) {
  const key = `${thickness}:${color}`;
  if (!outlineCache.has(key)) {
    outlineCache.set(key, new THREE.ShaderMaterial({
      uniforms: { thickness: { value: thickness }, color: { value: new THREE.Color(color) } },
      vertexShader: 'uniform float thickness; void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normalize(normal) * thickness, 1.0); }',
      fragmentShader: 'uniform vec3 color; void main(){ gl_FragColor = vec4(color, 1.0);\n#include <colorspace_fragment>\n}',
      side: THREE.BackSide,
    }));
  }
  return outlineCache.get(key);
}

// Flat-shaded copy of a geometry (hard facets).
export function facet(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  return g;
}

// Smooth-normal copy used for the inverted-hull outline, so corners stay closed.
const smoothCache = new WeakMap();
function smoothed(geo) {
  if (!smoothCache.has(geo)) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', geo.getAttribute('position').clone());
    if (geo.index) g.setIndex(geo.index.clone());
    const merged = mergeVertices(g, 1e-3);
    merged.computeVertexNormals();
    smoothCache.set(geo, merged);
  }
  return smoothCache.get(geo);
}

// A mesh with an ink outline. `material` may be a colour number.
export function ink(geo, material, { outline = 0.05 } = {}) {
  const mesh = new THREE.Mesh(geo, typeof material === 'number' ? toon(material) : material);
  if (outline) {
    const o = new THREE.Mesh(smoothed(geo), outlineMaterial(outline));
    o.name = 'outline';
    o.userData.thickness = outline;
    o.raycast = () => {};
    mesh.add(o);
  }
  return mesh;
}

// Switch every outline under `root` to the accent colour (or back to ink).
export function highlight(root, on) {
  root.traverse((o) => {
    if (o.name !== 'outline') return;
    const t = o.userData.thickness;
    o.material = on ? outlineMaterial(+(t * 1.9).toFixed(3), C.accent) : outlineMaterial(t);
  });
}

function fitText(g, text, font, maxWidth) {
  let size = parseInt(font.match(/(\d+)px/)[1], 10);
  g.font = font;
  while (g.measureText(text).width > maxWidth && size > 14) {
    size -= 2;
    g.font = font.replace(/\d+px/, `${size}px`);
  }
  return size;
}

export function textTexture(text, {
  w = 512, h = 128, font = '700 56px "Space Mono", monospace', color = '#222',
  bg = null, border = 0, pad = 36,
} = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  if (border) {
    g.strokeStyle = '#222'; g.lineWidth = border;
    g.strokeRect(border / 2, border / 2, w - border, h - border);
  }
  const size = fitText(g, text, font, w - pad * 2);
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + size * 0.06);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Round shadow drawn as pencil hatching.
let hatchMat;
export function hatchMaterial() {
  if (hatchMat) return hatchMat;
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.beginPath();
  g.ellipse(s / 2, s / 2, s / 2 - 4, s / 2 - 4, 0, 0, Math.PI * 2);
  g.clip();
  g.strokeStyle = 'rgba(34,34,34,0.42)';
  g.lineWidth = 3;
  g.lineCap = 'round';
  for (let i = -s; i < s * 2; i += 10) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i - s, s);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  hatchMat = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  return hatchMat;
}

// Graph-paper texture for the island tops.
let paperCanvas;
export function paperTexture(repeat) {
  if (!paperCanvas) {
    const s = 256;
    paperCanvas = document.createElement('canvas');
    paperCanvas.width = paperCanvas.height = s;
    const g = paperCanvas.getContext('2d');
    g.fillStyle = '#fffdf7';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(34,34,34,0.09)';
    g.lineWidth = 2;
    for (let i = 0; i <= s; i += 64) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(s, i); g.stroke();
    }
    g.fillStyle = 'rgba(34,34,34,0.16)';
    for (let x = 32; x < s; x += 64) for (let y = 32; y < s; y += 64) g.fillRect(x - 2, y - 2, 4, 4);
  }
  const t = new THREE.CanvasTexture(paperCanvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
