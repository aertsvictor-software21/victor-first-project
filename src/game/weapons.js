import * as THREE from 'three';
import { FX_COLORS } from '../style/palette.js';

// Wapens. Elk wapen heeft een eigen rol, kleur en effect.
export const WEAPONS = {
  blaster: {
    id: 'blaster', name: 'Bubbelblaster', key: '1', icon: '◉',
    fireRate: 9, damage: 9, headMul: 1.6, speed: 70, gravity: 0, spread: 0.012,
    mag: 24, reload: 1.1, radius: 0.16, splash: 0, bounces: 0, life: 1.2, knock: 1.5,
    colors: FX_COLORS.blaster, botRange: 16,
  },
  bouncer: {
    id: 'bouncer', name: 'Stuiterkanon', key: '2', icon: '●',
    fireRate: 2.1, damage: 24, headMul: 1, speed: 30, gravity: 22, spread: 0.01,
    mag: 6, reload: 1.5, radius: 0.28, splash: 2.8, splashDamage: 30, bounces: 2, life: 2.2, knock: 9,
    colors: FX_COLORS.bouncer, botRange: 12,
  },
  rocket: {
    id: 'rocket', name: 'Konfettiraket', key: '3', icon: '▲',
    fireRate: 1.0, damage: 40, headMul: 1, speed: 34, gravity: 0, spread: 0,
    mag: 3, reload: 2.0, radius: 0.3, splash: 3.6, splashDamage: 48, bounces: 0, life: 3, knock: 15,
    colors: FX_COLORS.rocket, botRange: 18, shake: 0.5,
  },
};
export const WEAPON_ORDER = ['blaster', 'bouncer', 'rocket'];

// Special ability en dash
export const SPECIAL = { id: 'sprongstoot', name: 'Sprongstoot', cooldown: 8, radius: 5.5, damage: 25, knock: 16, launch: 15 };
export const DASH = { cooldown: 2.2, speed: 24, time: 0.17 };

// ------------------------------------------------------------------
// Projectielen
// ------------------------------------------------------------------
const projGeo = {
  blaster: new THREE.SphereGeometry(0.16, 8, 6),
  bouncer: new THREE.IcosahedronGeometry(0.28, 1),
  rocket: new THREE.CapsuleGeometry(0.14, 0.45, 3, 8),
};
const projMat = {
  blaster: new THREE.MeshBasicMaterial({ color: 0x8af7ff }),
  bouncer: new THREE.MeshBasicMaterial({ color: 0xffa83d }),
  rocket: new THREE.MeshBasicMaterial({ color: 0xff4f8b }),
};
const glowMat = {
  blaster: new THREE.MeshBasicMaterial({ color: 0x3ff0ff, transparent: true, opacity: 0.35, depthWrite: false }),
  bouncer: new THREE.MeshBasicMaterial({ color: 0xffd23d, transparent: true, opacity: 0.3, depthWrite: false }),
  rocket: new THREE.MeshBasicMaterial({ color: 0xffc83d, transparent: true, opacity: 0.45, depthWrite: false }),
};
const glowGeo = new THREE.SphereGeometry(1, 8, 6);

export class Projectiles {
  constructor(scene, effects, world, hooks) {
    this.scene = scene;
    this.fx = effects;
    this.world = world;
    this.hooks = hooks; // { characters(), damage(target, amount, owner, opts), explode(pos, weapon, owner, direct) }
    this.list = [];
    this.pool = { blaster: [], bouncer: [], rocket: [] };
    this._tmp = new THREE.Vector3();
    this._seg = new THREE.Vector3();
  }

  take(type) {
    let m = this.pool[type].pop();
    if (!m) {
      m = new THREE.Mesh(projGeo[type], projMat[type]);
      const glow = new THREE.Mesh(glowGeo, glowMat[type]);
      glow.scale.setScalar(type === 'blaster' ? 0.32 : 0.5);
      m.add(glow);
      if (type === 'rocket') glow.position.z = -0.35;
    }
    m.visible = true;
    this.scene.add(m);
    return m;
  }

  fire(weapon, owner, origin, dir) {
    const mesh = this.take(weapon.id);
    mesh.position.copy(origin);
    const v = dir.clone().multiplyScalar(weapon.speed);
    if (weapon.id === 'bouncer') v.y += 3;
    this.list.push({ w: weapon, owner, mesh, pos: origin.clone(), vel: v, life: 0, bounces: 0, trailT: 0 });
    // mondingsflits
    this.fx.flash(origin, { color: weapon.colors[0], size: weapon.id === 'blaster' ? 0.25 : 0.45, life: 0.07 });
  }

  update(dt) {
    const chars = this.hooks.characters();
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life += dt;
      p.vel.y -= p.w.gravity * dt;
      const step = this._seg.copy(p.vel).multiplyScalar(dt);
      const dist = step.length();
      const dir = step.clone().divideScalar(dist || 1);
      let done = false;

      // personages
      let hitChar = null, hitT = Infinity, head = false;
      for (const c of chars) {
        if (c === p.owner || !c.alive) continue;
        for (const [cy, cr, isHead] of [[0.75, 0.55, false], [1.5, 0.55, true]]) {
          const center = this._tmp.set(c.pos.x, c.pos.y + cy, c.pos.z);
          const t = segSphere(p.pos, dir, dist, center, cr + p.w.radius);
          if (t !== null && t < hitT) { hitT = t; hitChar = c; head = isHead; }
        }
      }
      const wallHit = this.world.raycast(p.pos, dir, dist + p.w.radius * 0.5);
      if (hitChar && (!wallHit || hitT < wallHit.t)) {
        p.pos.addScaledVector(dir, hitT);
        if (p.w.splash > 0) {
          this.hooks.explode(p.pos.clone(), p.w, p.owner, hitChar);
        } else {
          this.hooks.damage(hitChar, p.w.damage * (head ? p.w.headMul : 1), p.owner, { head, dir, knock: p.w.knock, weapon: p.w });
          this.fx.impact(p.pos, dir.clone().negate(), p.w.colors);
        }
        done = true;
      } else if (wallHit) {
        p.pos.copy(wallHit.point);
        if (p.bounces < p.w.bounces) {
          p.bounces++;
          const n = wallHit.normal;
          p.vel.addScaledVector(n, -2 * p.vel.dot(n)).multiplyScalar(0.72);
          p.pos.addScaledVector(n, 0.05);
          this.fx.ring(p.pos.clone().addScaledVector(n, 0.05), { color: p.w.colors[1], size: 1.2, life: 0.25, normal: n });
          this.fx.burst(p.pos, 5, { speed: 4, colors: p.w.colors, up: 2, life: 0.35, size: 0.7 });
        } else {
          if (p.w.splash > 0) this.hooks.explode(p.pos.clone(), p.w, p.owner, null);
          else this.fx.impact(p.pos, wallHit.normal, p.w.colors);
          done = true;
        }
      } else {
        p.pos.add(step);
      }

      if (!done && (p.life > p.w.life || p.pos.y < -30)) {
        if (p.w.splash > 0 && p.pos.y > -30) this.hooks.explode(p.pos.clone(), p.w, p.owner, null);
        done = true;
      }

      // sporen
      p.trailT -= dt;
      if (!done && p.trailT <= 0) {
        if (p.w.id === 'rocket') {
          p.trailT = 0.025;
          this.fx.spawn(p.pos, new THREE.Vector3((Math.random() - 0.5), Math.random() * 0.8, (Math.random() - 0.5)), { life: 0.45, size: 1.6, grav: -1.5, drag: 2, color: Math.random() < 0.5 ? 0xffffff : 0xffe6f0 });
        } else if (p.w.id === 'bouncer') {
          p.trailT = 0.05;
          this.fx.spawn(p.pos, new THREE.Vector3(), { life: 0.3, size: 0.9, grav: 0, color: 0xffd23d });
        } else {
          p.trailT = 0.04;
          this.fx.spawn(p.pos, new THREE.Vector3(), { life: 0.18, size: 0.6, grav: 0, color: 0xbff9ff });
        }
      }

      if (done) {
        p.mesh.visible = false;
        this.scene.remove(p.mesh);
        this.pool[p.w.id].push(p.mesh);
        this.list.splice(i, 1);
      } else {
        p.mesh.position.copy(p.pos);
        if (p.w.id === 'rocket') p.mesh.lookAt(this._tmp.copy(p.pos).add(p.vel)), p.mesh.rotateX(Math.PI / 2);
        else if (p.w.id === 'bouncer') p.mesh.rotation.x += dt * 12;
      }
    }
  }

  clear() {
    for (const p of this.list) { this.scene.remove(p.mesh); this.pool[p.w.id].push(p.mesh); }
    this.list.length = 0;
  }
}

// Segment (origin + dir * t, 0..maxT) tegen bol. Retourneert t of null.
export function segSphere(o, d, maxT, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  if (cc <= 0) return 0;
  const disc = b * b - cc;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t >= 0 && t <= maxT ? t : null;
}
