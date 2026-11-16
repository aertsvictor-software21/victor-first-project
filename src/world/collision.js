import * as THREE from 'three';

// Eenvoudige, snelle collisiewereld van boxen en verticale cilinders.
// Bewust geen physics-engine: voorspelbaar, licht en ruim voldoende voor arena-gameplay.

export const STEP_HEIGHT = 0.55;

export class CollisionWorld {
  constructor() {
    this.solids = [];
    this.zones = []; // water, jumppads, ... (geen botsing, wel effect)
  }

  addBox(min, max) {
    const s = { kind: 'box', min: min.clone(), max: max.clone() };
    this.solids.push(s);
    return s;
  }

  addCylinder(x, z, r, y0, y1) {
    const s = { kind: 'cyl', x, z, r, y0, y1 };
    this.solids.push(s);
    return s;
  }

  addZone(type, x, z, r, y, data = {}) {
    const zone = { type, x, z, r, y, ...data };
    this.zones.push(zone);
    return zone;
  }

  zoneAt(x, z, feetY) {
    for (const zn of this.zones) {
      const dx = x - zn.x, dz = z - zn.z;
      if (dx * dx + dz * dz < zn.r * zn.r && Math.abs(feetY - zn.y) < 0.6) return zn;
    }
    return null;
  }

  static top(s) { return s.kind === 'box' ? s.max.y : s.y1; }
  static bottom(s) { return s.kind === 'box' ? s.min.y : s.y0; }

  static containsXZ(s, x, z, pad = 0) {
    if (s.kind === 'box') {
      return x >= s.min.x - pad && x <= s.max.x + pad && z >= s.min.z - pad && z <= s.max.z + pad;
    }
    const dx = x - s.x, dz = z - s.z, r = s.r + pad;
    return dx * dx + dz * dz <= r * r;
  }

  // Hoogste oppervlak onder de voeten (binnen staphoogte). -Infinity = afgrond.
  groundHeight(x, z, feetY, pad = 0) {
    let best = -Infinity;
    for (const s of this.solids) {
      const t = CollisionWorld.top(s);
      if (t <= feetY + STEP_HEIGHT && t > best && CollisionWorld.containsXZ(s, x, z, pad)) best = t;
    }
    return best;
  }

  // Duw een cirkel (personage) horizontaal uit muren/obstakels.
  resolveHorizontal(pos, radius, height) {
    const feet = pos.y;
    let hitWall = false;
    for (const s of this.solids) {
      const top = CollisionWorld.top(s), bot = CollisionWorld.bottom(s);
      if (top <= feet + STEP_HEIGHT || bot >= feet + height) continue;
      if (s.kind === 'box') {
        const cx = THREE.MathUtils.clamp(pos.x, s.min.x, s.max.x);
        const cz = THREE.MathUtils.clamp(pos.z, s.min.z, s.max.z);
        let dx = pos.x - cx, dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 > radius * radius) continue;
        hitWall = true;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * radius;
          pos.z = cz + (dz / d) * radius;
        } else {
          // midden in de box: kortste uitweg
          const pens = [
            [pos.x - s.min.x + radius, -1, 0], [s.max.x - pos.x + radius, 1, 0],
            [pos.z - s.min.z + radius, 0, -1], [s.max.z - pos.z + radius, 0, 1],
          ].sort((a, b) => a[0] - b[0]);
          pos.x += pens[0][1] * pens[0][0];
          pos.z += pens[0][2] * pens[0][0];
        }
      } else {
        const dx = pos.x - s.x, dz = pos.z - s.z;
        const rr = s.r + radius;
        const d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr) continue;
        hitWall = true;
        const d = Math.sqrt(d2) || 1e-4;
        pos.x = s.x + (dx / d) * rr;
        pos.z = s.z + (dz / d) * rr;
      }
    }
    return hitWall;
  }

  // Plafond: hoogste toegestane voetpositie bij omhoog bewegen.
  ceiling(x, z, feetY, height, radius) {
    let best = Infinity;
    for (const s of this.solids) {
      const bot = CollisionWorld.bottom(s);
      if (bot > feetY + 0.05 && bot < best && CollisionWorld.containsXZ(s, x, z, -radius * 0.5)) best = bot;
    }
    return best - height;
  }

  // Ray / segment tegen de wereld. Geeft {t, point, normal} of null.
  raycast(origin, dir, maxDist) {
    let best = null;
    for (const s of this.solids) {
      const hit = s.kind === 'box' ? rayBox(origin, dir, s, maxDist) : rayCyl(origin, dir, s, maxDist);
      if (hit && (!best || hit.t < best.t)) best = hit;
    }
    if (best) best.point = origin.clone().addScaledVector(dir, best.t);
    return best;
  }
}

function rayBox(o, d, s, maxDist) {
  let tmin = 0, tmax = maxDist, nAxis = -1, nSign = 0;
  const axes = ['x', 'y', 'z'];
  for (let i = 0; i < 3; i++) {
    const a = axes[i];
    if (Math.abs(d[a]) < 1e-9) {
      if (o[a] < s.min[a] || o[a] > s.max[a]) return null;
      continue;
    }
    let t1 = (s.min[a] - o[a]) / d[a];
    let t2 = (s.max[a] - o[a]) / d[a];
    let sign = -1;
    if (t1 > t2) { [t1, t2] = [t2, t1]; sign = 1; }
    if (t1 > tmin) { tmin = t1; nAxis = i; nSign = sign; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (nAxis < 0) return null; // begint binnenin
  const normal = new THREE.Vector3();
  normal[axes[nAxis]] = nSign;
  return { t: tmin, normal };
}

function rayCyl(o, d, s, maxDist) {
  let best = null;
  // mantel
  const ox = o.x - s.x, oz = o.z - s.z;
  const a = d.x * d.x + d.z * d.z;
  if (a > 1e-9) {
    const b = 2 * (ox * d.x + oz * d.z);
    const c = ox * ox + oz * oz - s.r * s.r;
    const disc = b * b - 4 * a * c;
    if (disc >= 0 && c > 0) {
      const t = (-b - Math.sqrt(disc)) / (2 * a);
      if (t >= 0 && t <= maxDist) {
        const y = o.y + d.y * t;
        if (y >= s.y0 && y <= s.y1) {
          best = { t, normal: new THREE.Vector3(ox + d.x * t, 0, oz + d.z * t).normalize() };
        }
      }
    }
  }
  // deksels
  if (Math.abs(d.y) > 1e-9) {
    for (const [yc, ny] of [[s.y1, 1], [s.y0, -1]]) {
      if ((ny > 0 && o.y < yc) || (ny < 0 && o.y > yc)) continue;
      const t = (yc - o.y) / d.y;
      if (t < 0 || t > maxDist || (best && t >= best.t)) continue;
      const x = ox + d.x * t, z = oz + d.z * t;
      if (x * x + z * z <= s.r * s.r) best = { t, normal: new THREE.Vector3(0, ny, 0) };
    }
  }
  return best;
}
