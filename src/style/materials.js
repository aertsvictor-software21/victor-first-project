import * as THREE from 'three';
import { PALETTE } from './palette.js';

// Drie-staps toon-gradient: licht / midden / schaduw.
let gradient = null;
export function toonGradient() {
  if (!gradient) {
    const data = new Uint8Array([95, 160, 215, 255]);
    gradient = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
  }
  return gradient;
}

// Gedeelde materialen per kleur voor de omgeving (minder draw-state wissels).
const shared = new Map();
export function toon(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!shared.has(key)) {
    const { flatShading, ...rest } = extra; // toon-materiaal kent geen flatShading
    shared.set(key, new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...rest }));
  }
  return shared.get(key);
}

// Unieke materialen (bijv. personages die kunnen oplichten bij een treffer).
export function toonUnique(color, extra = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...extra });
}

// Inverted-hull contourlijn: goedkoop en zeer leesbaar.
const outlineMat = new THREE.MeshBasicMaterial({ color: PALETTE.ink, side: THREE.BackSide });
export function addOutline(mesh, thickness = 0.06) {
  const o = new THREE.Mesh(mesh.geometry, outlineMat);
  o.scale.setScalar(1 + thickness);
  o.castShadow = false;
  o.receiveShadow = false;
  o.userData.isOutline = true;
  mesh.add(o);
  return o;
}
