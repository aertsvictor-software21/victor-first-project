import * as THREE from 'three';
import { FX_COLORS } from '../style/palette.js';

// Deeltjessysteem op basis van één InstancedMesh: één draw call voor alle
// confetti, spetters en stof. Schaalt mee met de kwaliteitsinstelling.
export class Effects {
  constructor(scene, maxParticles = 250) {
    this.scene = scene;
    this.max = maxParticles;
    const geo = new THREE.IcosahedronGeometry(0.12, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, maxParticles);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.setColorAt(0, new THREE.Color());
    scene.add(this.mesh);
    this.parts = [];
    this.free = [];
    for (let i = 0; i < maxParticles; i++) {
      this.parts.push({ alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, max: 1, size: 1, grav: 0, drag: 0, color: new THREE.Color(), spin: 0, flat: false });
    }

    // ringen (schokgolven, impact) — kleine pool
    this.rings = [];
    const ringGeo = new THREE.RingGeometry(0.85, 1, 40);
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      m.visible = false;
      scene.add(m);
      this.rings.push({ mesh: m, life: 0, max: 1, size: 1, alive: false });
    }
    // flitsbollen (explosiekern)
    this.flashes = [];
    const flashGeo = new THREE.IcosahedronGeometry(1, 2);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(flashGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
      m.visible = false;
      scene.add(m);
      this.flashes.push({ mesh: m, life: 0, max: 1, size: 1, alive: false });
    }
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._e = new THREE.Euler();
  }

  spawn(pos, vel, { life = 0.6, size = 1, grav = 18, drag = 1.5, color = 0xffffff, flat = false } = {}) {
    let part = null;
    for (let i = 0; i < this.max; i++) {
      const c = this.parts[(this.cursor = ((this.cursor || 0) + 1) % this.max)];
      if (!c.alive) { part = c; break; }
    }
    if (!part) return;
    part.alive = true;
    part.p.copy(pos);
    part.v.copy(vel);
    part.life = 0; part.max = life * (0.75 + Math.random() * 0.5);
    part.size = size; part.grav = grav; part.drag = drag; part.flat = flat;
    part.color.set(color);
    part.spin = Math.random() * 10;
  }

  burst(pos, count, { speed = 6, colors = FX_COLORS.ko, up = 3, life = 0.7, size = 1, grav = 18, flat = false, drag = 1.5 } = {}) {
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      v.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
      v.y += up;
      this.spawn(pos, v, { life, size: size * (0.6 + Math.random() * 0.8), grav, color: colors[i % colors.length], flat, drag });
    }
  }

  ring(pos, { color = 0xffffff, size = 3, life = 0.4, normal = null } = {}) {
    const r = this.rings.find((x) => !x.alive) || this.rings[0];
    r.alive = true; r.life = 0; r.max = life; r.size = size;
    r.mesh.visible = true;
    r.mesh.position.copy(pos);
    r.mesh.material.color.set(color);
    if (normal) r.mesh.lookAt(pos.clone().add(normal));
    else r.mesh.rotation.set(-Math.PI / 2, 0, 0);
  }

  flash(pos, { color = 0xffffff, size = 1.5, life = 0.18 } = {}) {
    const f = this.flashes.find((x) => !x.alive) || this.flashes[0];
    f.alive = true; f.life = 0; f.max = life; f.size = size;
    f.mesh.visible = true;
    f.mesh.position.copy(pos);
    f.mesh.material.color.set(color);
  }

  // Samengestelde effecten -------------------------------------------
  explosion(pos, radius, colors) {
    this.flash(pos, { color: 0xffffff, size: radius * 0.55, life: 0.12 });
    this.flash(pos, { color: colors[0], size: radius * 0.8, life: 0.26 });
    this.ring(pos.clone().setY(pos.y + 0.1), { color: colors[1] || 0xffffff, size: radius * 1.3, life: 0.35 });
    this.burst(pos, 28, { speed: radius * 4, colors, up: 4, life: 0.9, size: 1.3, grav: 14, flat: true });
    this.burst(pos, 8, { speed: 3, colors: [0xffffff, 0xf2f2f2], up: 2, life: 0.6, size: 2.4, grav: -2, drag: 3 });
  }

  impact(pos, normal, colors) {
    this.flash(pos, { color: colors[0], size: 0.45, life: 0.1 });
    const v = new THREE.Vector3();
    for (let i = 0; i < 6; i++) {
      v.copy(normal || new THREE.Vector3(0, 1, 0)).multiplyScalar(3).add(new THREE.Vector3((Math.random() - 0.5) * 5, Math.random() * 3, (Math.random() - 0.5) * 5));
      this.spawn(pos, v, { life: 0.35, size: 0.7, color: colors[i % colors.length], grav: 12 });
    }
  }

  update(dt) {
    let n = 0;
    const m = this._m, q = this._q, s = this._s, e = this._e;
    for (const p of this.parts) {
      if (!p.alive) continue;
      p.life += dt;
      if (p.life >= p.max) { p.alive = false; continue; }
      p.v.y -= p.grav * dt;
      p.v.multiplyScalar(Math.max(0, 1 - p.drag * dt));
      p.p.addScaledVector(p.v, dt);
      const k = 1 - p.life / p.max;
      const size = p.size * (k < 0.3 ? k / 0.3 : 1);
      p.spin += dt * 8;
      e.set(p.spin, p.spin * 0.7, 0);
      q.setFromEuler(e);
      if (p.flat) s.set(size * 1.4, size * 0.35, size); else s.set(size, size, size);
      m.compose(p.p, q, s);
      this.mesh.setMatrixAt(n, m);
      this.mesh.setColorAt(n, p.color);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    for (const r of this.rings) {
      if (!r.alive) continue;
      r.life += dt;
      const k = r.life / r.max;
      if (k >= 1) { r.alive = false; r.mesh.visible = false; continue; }
      const ease = 1 - (1 - k) ** 3;
      r.mesh.scale.setScalar(0.2 + ease * r.size);
      r.mesh.material.opacity = 1 - k;
    }
    for (const f of this.flashes) {
      if (!f.alive) continue;
      f.life += dt;
      const k = f.life / f.max;
      if (k >= 1) { f.alive = false; f.mesh.visible = false; continue; }
      f.mesh.scale.setScalar(f.size * (0.6 + k * 0.6));
      f.mesh.material.opacity = 1 - k * k;
    }
  }

  clear() {
    for (const p of this.parts) p.alive = false;
    for (const r of this.rings) { r.alive = false; r.mesh.visible = false; }
    for (const f of this.flashes) { f.alive = false; f.mesh.visible = false; }
    this.mesh.count = 0;
  }

  dispose() {
    this.scene.remove(this.mesh);
    for (const r of this.rings) this.scene.remove(r.mesh);
    for (const f of this.flashes) this.scene.remove(f.mesh);
  }
}
