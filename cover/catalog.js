// Everything selectable in the scene, built from the site's project data.
import { C } from './toon.js';

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

// dir is the island's direction from the hub on the ground plane: [x, z].
export const ZONES = [
  { id: 'work', label: 'Work', color: C.work, dir: [-1, 0], blurb: 'Games and tech I built on teams at companies.' },
  { id: 'apps', label: 'Apps', color: C.apps, dir: [0, -1], blurb: 'Apps and learning tools, most built with AI.' },
  { id: 'tech', label: 'Tech', color: C.tech, dir: [1, 0], blurb: 'Engines, tools and mechanic prototypes.' },
  { id: 'games', label: 'Games', color: C.games, dir: [0, 1], blurb: 'Games I designed and built.' },
].map((z) => ({ ...z, css: hex(z.color) }));

export function buildCatalog(data) {
  const cat = new Map();
  cat.set('player', { id: 'player', kind: 'player', title: 'Player (Frank)' });
  cat.set('camera', { id: 'camera', kind: 'camera', title: 'Main Camera' });
  cat.set('chest', { id: 'chest', kind: 'chest', title: 'Treasure Chest' });
  for (const zone of ZONES) {
    const items = data.projects[zone.id] || [];
    cat.set(`zone:${zone.id}`, {
      id: `zone:${zone.id}`, kind: 'zone', title: `${zone.label} Island`, zone,
      children: items.map((p) => `project:${p.slug}`),
    });
    for (const p of items) {
      cat.set(`project:${p.slug}`, {
        id: `project:${p.slug}`, kind: 'project', title: p.title, desc: p.description, zone,
        slug: p.slug,
        href: `${data.base}/projects/${p.slug}/`,
        thumb: `${data.base}/images/cover/${p.slug}.jpg`,
      });
    }
  }
  return cat;
}
