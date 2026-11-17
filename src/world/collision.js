import * as THREE from 'three';

// Eenvoudige, snelle collisiewereld van boxen en verticale cilinders.
// Bewust geen physics-engine: voorspelbaar, licht en ruim voldoende voor arena-gameplay.

export const STEP_HEIGHT = 0.55;

export class CollisionWorld {
  constructor() {
    this.solids = [];
    this.zones = []; // water, jumppads, ... (geen botsing, wel effect)
    this.lastWallNormal = new THREE.Vector3();
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

  // Ronde arenamuur: binnen de straal vrij, erbuiten geblokkeerd (oneindig hoog).
  // gaps: [[hoek, halveBreedteInRadialen], ...] voor openingen (bv. bruggen).
  addRingWall(x, z, r, gaps = []) {
    const s = { kind: 'ringwall', x, z, r, gaps, y0: -50, y1: 200 };
    this.solids.push(s);
    return s;
  }

  // Ringvormige vloer (vloer met een gat/put in het midden).
  addAnnulus(x, z, r0, r1, y0, y1) {
    const s = { kind: 'annulus', x, z, r0, r1, y0, y1 };
    this.solids.push(s);
    return s;
  }

  static inGap(s, x, z) {
    if (!s.gaps.length) return false;
    const a = Math.atan2(z - s.z, x - s.x);
    for (const [ga, hw] of s.gaps) {
      let d = a - ga;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      if (Math.abs(d) < hw) return true;
    }
    return false;
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
    if (s.kind === 'ringwall') return false;
    if (s.kind === 'annulus') {
      const d = Math.hypot(x - s.x, z - s.z);
      return d >= s.r0 - pad && d <= s.r1 + pad;
    }
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
      if (s.kind === 'ringwall') {
        const dx = pos.x - s.x, dz = pos.z - s.z;
        const d = Math.hypot(dx, dz);
        if (d > s.r - radius && d < s.r + 1.5 && !CollisionWorld.inGap(s, pos.x, pos.z)) { // alleen vlak bij de muur (meerdere eilanden)
          pos.x = s.x + (dx / d) * (s.r - radius);
          pos.z = s.z + (dz / d) * (s.r - radius);
          hitWall = true;
          this.lastWallNormal.set(-dx / d, 0, -dz / d);
        }
        continue;
      }
      const top = CollisionWorld.top(s), bot = CollisionWorld.bottom(s);
      if (top <= feet + STEP_HEIGHT || bot >= feet + height) continue;
      if (s.kind === 'annulus') {
        // in de put: binnenwand duwt terug naar het midden van de put
        const dx = pos.x - s.x, dz = pos.z - s.z;
        const d = Math.hypot(dx, dz) || 1e-4;
        if (d > s.r0 - radius && d < s.r1) {
          pos.x = s.x + (dx / d) * (s.r0 - radius);
          pos.z = s.z + (dz / d) * (s.r0 - radius);
          hitWall = true;
          this.lastWallNormal.set(-dx / d, 0, -dz / d);
        }
        continue;
      }
      if (s.kind === 'box') {
        const cx = THREE.MathUtils.clamp(pos.x, s.min.x, s.max.x);
        const cz = THREE.MathUtils.clamp(pos.z, s.min.z, s.max.z);
        let dx = pos.x - cx, dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 > radius * radius) continue;
        hitWall = true;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          this.lastWallNormal.set(dx / d, 0, dz / d);
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
        this.lastWallNormal.set(dx / d, 0, dz / d);
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
      if (s.kind === 'ringwall') continue;
      const bot = CollisionWorld.bottom(s);
      if (bot > feetY + 0.05 && bot < best && CollisionWorld.containsXZ(s, x, z, -radius * 0.5)) best = bot;
    }
    return best - height;
  }

  // Ray / segment tegen de wereld. Geeft {t, point, normal} of null.
  raycast(origin, dir, maxDist) {
    let best = null;
    for (const s of this.solids) {
      const hit = s.kind === 'box' ? rayBox(origin, dir, s, maxDist)
        : s.kind === 'ringwall' ? rayRingWall(origin, dir, s, maxDist)
        : s.kind === 'annulus' ? rayAnnulus(origin, dir, s, maxDist)
        : rayCyl(origin, dir, s, maxDist);
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

// Ray van binnenuit tegen een ronde muur (verste snijpunt).
function rayRingWall(o, d, s, maxDist) {
  const ox = o.x - s.x, oz = o.z - s.z;
  const a = d.x * d.x + d.z * d.z;
  if (a < 1e-9) return null;
  const b = 2 * (ox * d.x + oz * d.z);
  const c = ox * ox + oz * oz - s.r * s.r;
  if (c > 0) return null; // begint buiten
  const t = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
  if (t < 0 || t > maxDist) return null;
  const hx = o.x + d.x * t, hz = o.z + d.z * t;
  if (CollisionWorld.inGap(s, hx, hz)) return null;
  return { t, normal: new THREE.Vector3(-(hx - s.x), 0, -(hz - s.z)).normalize() };
}

// Ray tegen een ringvloer: bovenkant + binnenwand van de put.
function rayAnnulus(o, d, s, maxDist) {
  let best = null;
  if (Math.abs(d.y) > 1e-9 && o.y > s.y1) {
    const t = (s.y1 - o.y) / d.y;
    if (t >= 0 && t <= maxDist) {
      const r = Math.hypot(o.x + d.x * t - s.x, o.z + d.z * t - s.z);
      if (r >= s.r0 && r <= s.r1) best = { t, normal: new THREE.Vector3(0, 1, 0) };
    }
  }
  const ox = o.x - s.x, oz = o.z - s.z;
  const a = d.x * d.x + d.z * d.z;
  if (a > 1e-9 && ox * ox + oz * oz < s.r0 * s.r0) {
    const b = 2 * (ox * d.x + oz * d.z), c = ox * ox + oz * oz - s.r0 * s.r0;
    const t = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
    const y = o.y + d.y * t;
    if (t >= 0 && t <= maxDist && y >= s.y0 && y <= s.y1 && (!best || t < best.t)) {
      best = { t, normal: new THREE.Vector3(-(ox + d.x * t), 0, -(oz + d.z * t)).normalize() };
    }
  }
  return best;
}
