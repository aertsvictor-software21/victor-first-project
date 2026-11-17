import * as THREE from 'three';
import { toon, toonUnique, addOutline } from '../style/materials.js';
import { PALETTE } from '../style/palette.js';

// Gestileerd ARENA-personage: groot hoofd, compact lijf, grote ogen.
// Opgebouwd uit primitieven (~1.5k driehoeken) zodat het licht blijft op laptops.

const GEO = {
  torso: new THREE.CapsuleGeometry(0.42, 0.34, 4, 12),
  head: new THREE.SphereGeometry(0.56, 18, 14),
  eye: new THREE.SphereGeometry(0.16, 12, 10),
  pupil: new THREE.SphereGeometry(0.085, 10, 8),
  shine: new THREE.SphereGeometry(0.035, 6, 4),
  hand: new THREE.SphereGeometry(0.15, 10, 8),
  foot: new THREE.SphereGeometry(0.19, 10, 8),
  belly: new THREE.SphereGeometry(0.33, 12, 10),
  cheek: new THREE.CircleGeometry(0.08, 10),
  ring: new THREE.RingGeometry(0.55, 0.72, 28),
};

const inkMat = toon(PALETTE.ink);
const whiteMat = toon(0xffffff);
const cheekMat = new THREE.MeshBasicMaterial({ color: 0xff8fa3, transparent: true, opacity: 0.7 });

export class Character {
  constructor(skin, { ringColor = 0xffc83d } = {}) {
    this.skin = skin;
    this.root = new THREE.Group();
    this.materials = [];

    const bodyMat = this.mat(skin.body);
    const bellyMat = this.mat(skin.belly);
    const accentMat = this.mat(skin.accent);
    this.bodyMat = bodyMat;

    // grondring voor herkenbaarheid in drukke gevechten
    this.ring = new THREE.Mesh(GEO.ring, new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.85, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.04;
    this.root.add(this.ring);

    this.squash = new THREE.Group();
    this.root.add(this.squash);

    this.lean = new THREE.Group();
    this.lean.position.y = 0.3;
    this.squash.add(this.lean);

    this.spin = new THREE.Group(); // voor salto bij dubbelsprong
    this.spin.position.y = 0.6;
    this.lean.add(this.spin);
    const off = -0.9; // offset zodat spin rond het midden draait

    const torso = new THREE.Mesh(GEO.torso, bodyMat);
    torso.position.y = 0.55 + off;
    torso.castShadow = true;
    addOutline(torso, 0.07);
    this.spin.add(torso);

    const belly = new THREE.Mesh(GEO.belly, bellyMat);
    belly.position.set(0, 0.5 + off, 0.2);
    belly.scale.set(1, 1.05, 0.7);
    this.spin.add(belly);

    this.head = new THREE.Group();
    this.head.position.y = 1.38 + off;
    this.spin.add(this.head);
    const headMesh = new THREE.Mesh(GEO.head, bodyMat);
    headMesh.scale.set(1.05, 0.95, 1);
    headMesh.castShadow = true;
    addOutline(headMesh, 0.06);
    this.head.add(headMesh);

    // ogen
    this.eyes = [];
    for (const sx of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(sx * 0.21, 0.06, 0.46);
      const white = new THREE.Mesh(GEO.eye, whiteMat);
      white.scale.set(0.9, 1.15, 0.55);
      eye.add(white);
      const pupil = new THREE.Mesh(GEO.pupil, inkMat);
      pupil.position.set(0, -0.01, 0.07);
      pupil.scale.set(1, 1.3, 0.6);
      eye.add(pupil);
      const shine = new THREE.Mesh(GEO.shine, whiteMat);
      shine.position.set(0.03, 0.05, 0.12);
      eye.add(shine);
      this.head.add(eye);
      this.eyes.push(eye);
      const cheek = new THREE.Mesh(GEO.cheek, cheekMat);
      cheek.position.set(sx * 0.36, -0.14, 0.46);
      cheek.rotation.y = sx * 0.45;
      this.head.add(cheek);
    }

    this.buildAccessory(skin.accessory, accentMat, bodyMat);

    // handen
    this.leftHand = new THREE.Mesh(GEO.hand, bodyMat);
    this.leftHand.position.set(-0.5, 0.6 + off, 0.05);
    this.leftHand.castShadow = true;
    this.spin.add(this.leftHand);

    this.gunPivot = new THREE.Group();
    this.gunPivot.position.set(0.42, 0.72 + off, 0.12);
    this.spin.add(this.gunPivot);
    const rightHand = new THREE.Mesh(GEO.hand, bodyMat);
    rightHand.castShadow = true;
    this.gunPivot.add(rightHand);
    this.weapons = buildWeaponModels();
    for (const w of Object.values(this.weapons)) { w.visible = false; this.gunPivot.add(w); }
    this.muzzle = new THREE.Object3D();
    this.gunPivot.add(this.muzzle);

    // voeten
    this.feet = [];
    for (const sx of [-1, 1]) {
      const f = new THREE.Mesh(GEO.foot, accentMat);
      f.scale.set(1, 0.7, 1.35);
      f.position.set(sx * 0.21, 0.12, 0.05);
      f.castShadow = true;
      this.squash.add(f);
      this.feet.push(f);
    }

    // animatiestatus
    this.phase = 0;
    this.sq = 1; this.sqVel = 0;
    this.flash = 0;
    this.recoil = 0;
    this.flip = 0;
    this.blinkT = 2 + Math.random() * 3;
    this.popT = -1; this.spawnT = -1;
    this.leanX = 0; this.leanZ = 0;
    this.setWeapon('blaster');
  }

  mat(color) {
    const m = toonUnique(color, { emissive: 0xffffff, emissiveIntensity: 0 });
    this.materials.push(m);
    return m;
  }

  buildAccessory(type, accent, body) {
    const h = this.head;
    const add = (geo, mat, pos, rot = [0, 0, 0], scl = [1, 1, 1], outline = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(...pos); m.rotation.set(...rot); m.scale.set(...scl);
      m.castShadow = true;
      if (outline) addOutline(m, 0.08);
      h.add(m);
      return m;
    };
    switch (type) {
      case 'antenna': {
        add(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 6), toon(PALETTE.ink), [0, 0.7, 0], [0, 0, 0.15], [1, 1, 1], false);
        this.bob = add(new THREE.SphereGeometry(0.12, 10, 8), accent, [-0.035, 0.95, 0]);
        break;
      }
      case 'ears':
        for (const sx of [-1, 1]) add(new THREE.SphereGeometry(0.2, 10, 8), body, [sx * 0.42, 0.42, -0.05], [0, 0, -sx * 0.5], [0.8, 1.2, 0.5]);
        for (const sx of [-1, 1]) add(new THREE.SphereGeometry(0.11, 8, 6), accent, [sx * 0.43, 0.43, 0.04], [0, 0, -sx * 0.5], [0.8, 1.2, 0.4], false);
        break;
      case 'sprout': {
        add(new THREE.CylinderGeometry(0.03, 0.04, 0.3, 6), toon(0x3fae4a), [0, 0.65, 0], [0, 0, 0], [1, 1, 1], false);
        for (const sx of [-1, 1]) add(new THREE.SphereGeometry(0.15, 8, 6), accent, [sx * 0.14, 0.8, 0], [0, 0, sx * 0.6], [1.2, 0.5, 0.7]);
        break;
      }
      case 'horns':
        for (const sx of [-1, 1]) add(new THREE.ConeGeometry(0.11, 0.32, 8), accent, [sx * 0.28, 0.55, 0], [0, 0, -sx * 0.4]);
        break;
      case 'cap':
        add(new THREE.SphereGeometry(0.58, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), accent, [0, 0.08, 0], [-0.1, 0, 0], [1.06, 0.85, 1.04]);
        add(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 16, 1, false, -Math.PI / 2, Math.PI), accent, [0, 0.12, 0.3], [0.15, 0, 0], [1, 1, 1.1]);
        break;
      case 'tuft':
        for (let i = 0; i < 3; i++) add(new THREE.SphereGeometry(0.17, 8, 6), toon(0xffffff), [(i - 1) * 0.16, 0.56 + (i === 1 ? 0.08 : 0), 0.05], [0, 0, 0], [1, 0.8, 1]);
        break;
      case 'fin':
        add(new THREE.ConeGeometry(0.22, 0.55, 3), accent, [0, 0.62, -0.1], [-0.4, 0, 0], [0.35, 1, 1.4]);
        break;
      case 'crown': {
        add(new THREE.CylinderGeometry(0.3, 0.34, 0.16, 10, 1, true), toon(0xffd23d), [0, 0.6, 0], [0, 0, 0], [1, 1, 1]);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          add(new THREE.ConeGeometry(0.07, 0.2, 5), toon(0xffd23d), [Math.sin(a) * 0.3, 0.77, Math.cos(a) * 0.3], [0, 0, 0], [1, 1, 1], false);
        }
        add(new THREE.SphereGeometry(0.06, 8, 6), accent, [0, 0.62, 0.33], [0, 0, 0], [1, 1, 1], false);
        break;
      }
      case 'visor':
        add(new THREE.TorusGeometry(0.5, 0.07, 6, 20, Math.PI), accent, [0, 0.1, 0.05], [0, 0, 0], [1.05, 1, 1.1]);
        add(new THREE.BoxGeometry(0.62, 0.14, 0.08), toon(0xffffff), [0, 0.3, 0.5], [-0.2, 0, 0], [1, 1, 1]);
        break;
    }
  }

  setWeapon(id) {
    for (const [k, w] of Object.entries(this.weapons)) w.visible = k === id;
    const tip = this.weapons[id].userData.tip;
    this.muzzle.position.copy(tip);
    this.weaponId = id;
  }

  getMuzzle(out) { return this.muzzle.getWorldPosition(out); }

  hit(strength = 1) {
    this.flash = 1;
    this.recoil = Math.min(1, 0.4 + strength * 0.6);
    this.sqVel -= 4 * strength;
  }
  jump(double = false) {
    this.sqVel += 7;
    if (double) this.flip = 1;
  }
  land(impact) { this.sqVel -= Math.min(10, impact * 0.5); }
  fire(kick = 1) { this.recoil = Math.max(this.recoil, 0.25 * kick); }

  pop() { this.popT = 0; }
  spawnIn() { this.spawnT = 0; this.popT = -1; this.root.visible = true; this.root.scale.setScalar(0.01); }

  update(dt, { speed = 0, onGround = true, aimPitch = 0, invuln = false, t = 0 }) {
    // KO-pop en spawn-animatie
    if (this.popT >= 0) {
      this.popT += dt;
      const k = this.popT / 0.22;
      const s = k < 0.4 ? 1 + k * 0.6 : Math.max(0, 1.24 * (1 - (k - 0.4) / 0.6));
      this.root.scale.setScalar(Math.max(0.001, s));
      this.root.rotation.y += dt * 20;
      if (k >= 1) { this.root.visible = false; this.popT = -1; }
      return;
    }
    if (this.spawnT >= 0) {
      this.spawnT += dt;
      const k = Math.min(1, this.spawnT / 0.45);
      const s = 1 + Math.sin(k * Math.PI) * 0.25 * (1 - k) - (1 - k) ** 3;
      this.root.scale.setScalar(Math.max(0.01, s));
      if (k >= 1) { this.spawnT = -1; this.root.scale.setScalar(1); }
    }

    // loopcyclus
    const run = Math.min(1, speed / 9);
    this.phase += dt * (4 + speed * 1.35);
    const sw = Math.sin(this.phase);
    const bob = onGround ? Math.abs(Math.cos(this.phase)) * 0.12 * run : 0;
    this.lean.position.y = 0.3 + bob + (1 - run) * Math.sin(t * 2.5) * 0.015;
    const strideZ = onGround ? sw * 0.32 * run : 0.15;
    this.feet[0].position.z = 0.05 + strideZ;
    this.feet[1].position.z = 0.05 - strideZ;
    this.feet[0].position.y = 0.12 + (onGround ? Math.max(0, -Math.cos(this.phase)) * 0.18 * run : 0.1);
    this.feet[1].position.y = 0.12 + (onGround ? Math.max(0, Math.cos(this.phase)) * 0.18 * run : 0.1);
    this.leftHand.position.z = 0.05 - sw * 0.25 * run;
    this.leftHand.position.y = 0.6 - 0.9 + (onGround ? 0 : 0.2);

    // voorover leunen in looprichting
    const targetLean = run * 0.18 + this.recoil * -0.35;
    this.leanX += (targetLean - this.leanX) * Math.min(1, dt * 12);
    this.lean.rotation.x = this.leanX;
    this.lean.rotation.z = Math.sin(this.phase * 0.5) * 0.05 * run;

    // squash & stretch (veer)
    const k = 220, damp = 16;
    this.sqVel += (-(this.sq - 1) * k - this.sqVel * damp) * dt;
    this.sq += this.sqVel * dt;
    const sq = THREE.MathUtils.clamp(this.sq, 0.65, 1.4);
    this.squash.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));

    // salto bij dubbelsprong
    if (this.flip > 0) {
      this.flip = Math.max(0, this.flip - dt / 0.42);
      const e = 1 - this.flip;
      this.spin.rotation.x = (1 - (1 - e) ** 3) * Math.PI * 2;
    } else this.spin.rotation.x = 0;

    // richten
    this.gunPivot.rotation.x = -aimPitch * 0.85 - this.recoil * 0.5;
    this.head.rotation.x = -aimPitch * 0.3;
    this.recoil = Math.max(0, this.recoil - dt * 4);

    // knipperen
    this.blinkT -= dt;
    const blink = this.blinkT < 0.12 && this.blinkT > 0 ? 0.1 : 1;
    if (this.blinkT <= 0) this.blinkT = 2 + Math.random() * 3.5;
    for (const e of this.eyes) e.scale.y = blink;
    if (this.bob) this.bob.position.x = -0.035 + Math.sin(t * 6) * 0.04 * (0.4 + run);

    // trefferflits
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 7);
      for (const m of this.materials) m.emissiveIntensity = this.flash * 0.9;
    }

    // knipperen tijdens onkwetsbaarheid
    this.squash.visible = !invuln || Math.floor(t * 14) % 2 === 0;
    this.ring.material.opacity = 0.55 + Math.sin(t * 4) * 0.15;
  }

  dispose() {
    for (const m of this.materials) m.dispose();
    this.ring.material.dispose();
  }
}

// Wapens: herkenbare silhouetten en kleuren per wapen.
function buildWeaponModels() {
  const models = {};
  {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.38, 4, 8), toon(0x3ff0ff));
    body.rotation.x = Math.PI / 2; body.position.z = 0.25;
    const tank = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), toon(0xffffff, { transparent: true, opacity: 0.85 }));
    tank.position.set(0, 0.14, 0.15);
    const tip = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.035, 6, 12), toon(0xffffff));
    tip.position.z = 0.52;
    g.add(body, tank, tip);
    addOutline(body, 0.1);
    g.userData.tip = new THREE.Vector3(0, 0, 0.6);
    models.blaster = g;
  }
  {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.55, 12), toon(0xff9a1f));
    body.rotation.x = Math.PI / 2; body.position.z = 0.25;
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.04, 6, 14), toon(0xffd23d));
    band.position.z = 0.48;
    g.add(body, band);
    addOutline(body, 0.1);
    g.userData.tip = new THREE.Vector3(0, 0, 0.6);
    models.bouncer = g;
  }
  {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.75, 12), toon(0xff4f8b));
    body.rotation.x = Math.PI / 2; body.position.set(0, 0.08, 0.2);
    const cap = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.05, 6, 14), toon(0xffc83d));
    cap.position.set(0, 0.08, 0.58);
    const back = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.05, 6, 14), toon(0x8b5cf6));
    back.position.set(0, 0.08, -0.17);
    g.add(body, cap, back);
    addOutline(body, 0.1);
    g.userData.tip = new THREE.Vector3(0, 0.08, 0.68);
    models.rocket = g;
  }
  return models;
}
