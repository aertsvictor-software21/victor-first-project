import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toon, toonUnique, addOutline } from '../style/materials.js';

// Gestileerd ARENA-personage: heroïsche, licht overdreven proporties
// (brede schouders, smalle taille, stevige boots) in plaats van een "knuffelfiguur".
// Opgebouwd uit primitieven (~2k driehoeken) zodat het licht blijft op laptops.

const GEO = {
  pelvis: new RoundedBoxGeometry(0.46, 0.26, 0.3, 2, 0.1),
  torso: new THREE.CylinderGeometry(0.34, 0.24, 0.56, 10),
  chest: new RoundedBoxGeometry(0.5, 0.3, 0.12, 2, 0.05),
  belt: new THREE.CylinderGeometry(0.255, 0.255, 0.07, 10),
  neck: new THREE.CylinderGeometry(0.1, 0.12, 0.14, 8),
  head: new THREE.SphereGeometry(0.3, 18, 14),
  eye: new THREE.CapsuleGeometry(0.035, 0.05, 2, 6),
  brow: new THREE.BoxGeometry(0.11, 0.025, 0.03),
  leg: new THREE.CapsuleGeometry(0.125, 0.42, 4, 8),
  boot: new RoundedBoxGeometry(0.24, 0.17, 0.36, 2, 0.06),
  arm: new THREE.CapsuleGeometry(0.085, 0.34, 4, 8),
  glove: new THREE.SphereGeometry(0.1, 10, 8),
  shoulder: new THREE.SphereGeometry(0.13, 10, 8),
  pack: new RoundedBoxGeometry(0.38, 0.42, 0.18, 2, 0.06),
  ring: new THREE.RingGeometry(0.55, 0.7, 28),
};

const darkMat = toon(0x232a48);
const eyeMat = toon(0x161b30);

export class Character {
  constructor(skin, { ringColor = 0xffd400 } = {}) {
    this.skin = skin;
    this.root = new THREE.Group();
    this.materials = [];

    const bodyMat = this.mat(skin.body);       // jas / pak
    const trimMat = this.mat(skin.belly);      // lichte accenten
    const accentMat = this.mat(skin.accent);   // signatuurkleur (boots, vest, headgear)
    const toneMat = this.mat(skin.tone || 0xe8b48c);
    const pantsMat = this.mat(skin.pants || 0x2b3358);
    this.accentMat = accentMat;

    // grondring voor herkenbaarheid
    this.ring = new THREE.Mesh(GEO.ring, new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.8, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.04;
    this.root.add(this.ring);

    this.squash = new THREE.Group();
    this.root.add(this.squash);
    this.lean = new THREE.Group();          // heupen
    this.lean.position.y = 0.84;
    this.squash.add(this.lean);
    this.spin = new THREE.Group();          // salto bij dubbelsprong
    this.spin.position.y = 0.25;
    this.lean.add(this.spin);
    const o = -0.25;                         // terug naar heuphoogte binnen spin

    const add = (geo, mat, x, y, z, outline = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      if (outline) addOutline(m, outline);
      return m;
    };

    // ---- benen ----
    this.legs = [];
    for (const sx of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(sx * 0.13, o, 0);
      hip.add(add(GEO.leg, pantsMat, 0, -0.36, 0, 0.04));
      const boot = add(GEO.boot, accentMat, 0, -0.75, 0.06, 0.04);
      hip.add(boot);
      this.spin.add(hip);
      this.legs.push(hip);
    }
    this.spin.add(add(GEO.pelvis, pantsMat, 0, o + 0.02, 0));

    // ---- romp ----
    this.torsoG = new THREE.Group();
    this.torsoG.position.y = o + 0.1;
    this.torsoG.scale.setScalar(1.12); // heroïsch bovenlijf
    this.spin.add(this.torsoG);
    this.torsoG.add(add(GEO.torso, bodyMat, 0, 0.3, 0, 0.035));
    this.torsoG.add(add(GEO.belt, darkMat, 0, 0.04, 0));
    const chest = add(GEO.chest, accentMat, 0, 0.38, 0.19);
    chest.rotation.x = -0.12;
    this.torsoG.add(chest);
    const stripe = add(new THREE.BoxGeometry(0.06, 0.32, 0.02), trimMat, 0.12, 0.38, 0.26);
    stripe.rotation.x = -0.12;
    this.torsoG.add(stripe);
    const pack = add(GEO.pack, darkMat, 0, 0.36, -0.27, 0.04);
    this.torsoG.add(pack);
    this.torsoG.add(add(new THREE.BoxGeometry(0.3, 0.06, 0.04), accentMat, 0, 0.46, -0.37));
    for (const sx of [-1, 1]) this.torsoG.add(add(GEO.shoulder, bodyMat, sx * 0.36, 0.52, 0, 0.05));

    // ---- hoofd ----
    this.torsoG.add(add(GEO.neck, toneMat, 0, 0.63, 0));
    this.head = new THREE.Group();
    this.head.position.y = 0.88;
    this.torsoG.add(this.head);
    const headMesh = add(GEO.head, toneMat, 0, 0, 0, 0.045);
    headMesh.scale.set(0.95, 1.06, 1);
    this.head.add(headMesh);
    this.eyes = [];
    for (const sx of [-1, 1]) {
      const eye = add(GEO.eye, eyeMat, sx * 0.105, 0.02, 0.27);
      eye.castShadow = false;
      this.head.add(eye);
      this.eyes.push(eye);
      const brow = add(GEO.brow, darkMat, sx * 0.11, 0.1, 0.27);
      brow.rotation.z = sx * -0.2;  // vastberaden blik
      brow.castShadow = false;
      this.head.add(brow);
    }
    this.buildHeadgear(skin.accessory, accentMat, bodyMat, trimMat);

    // ---- armen: beide handen aan het wapen ----
    this.gunPivot = new THREE.Group();          // rechterschouder
    this.gunPivot.position.set(0.4, o + 0.68, 0.02);
    this.spin.add(this.gunPivot);
    const rArm = add(GEO.arm, bodyMat, 0, -0.12, 0.16, 0.05);
    rArm.rotation.x = 1.15;
    this.gunPivot.add(rArm);
    this.gunPivot.add(add(GEO.glove, darkMat, 0, -0.22, 0.36));
    this.weapons = buildWeaponModels();
    for (const w of Object.values(this.weapons)) { w.visible = false; w.position.set(-0.04, -0.2, 0.32); this.gunPivot.add(w); }
    this.muzzle = new THREE.Object3D();
    this.gunPivot.add(this.muzzle);

    this.leftArm = new THREE.Group();           // linkerschouder, reikt naar de voorgreep
    this.leftArm.position.set(-0.4, o + 0.68, 0.02);
    this.spin.add(this.leftArm);
    const lArm = add(GEO.arm, bodyMat, 0, -0.1, 0.2, 0.05);
    lArm.rotation.set(1.25, 0, 0);
    this.leftArm.add(lArm);
    this.leftArm.add(add(GEO.glove, darkMat, 0, -0.18, 0.43));
    this.leftArm.rotation.y = 0.55;

    // animatiestatus
    this.phase = 0;
    this.sq = 1; this.sqVel = 0;
    this.flash = 0;
    this.recoil = 0;
    this.flip = 0;
    this.blinkT = 2 + Math.random() * 3;
    this.popT = -1; this.spawnT = -1;
    this.leanX = 0;
    this.setWeapon('blaster');
  }

  mat(color) {
    const m = toonUnique(color, { emissive: 0xffffff, emissiveIntensity: 0 });
    this.materials.push(m);
    return m;
  }

  buildHeadgear(type, accent, body, trim) {
    const h = this.head;
    const add = (geo, mat, pos, rot = [0, 0, 0], scl = [1, 1, 1], outline = 0.05) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(...pos); m.rotation.set(...rot); m.scale.set(...scl);
      m.castShadow = true;
      if (outline) addOutline(m, outline);
      h.add(m);
      return m;
    };
    const hair = (mat) => add(new THREE.SphereGeometry(0.31, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), mat, [0, 0.03, -0.02], [-0.25, 0, 0], [1, 1.05, 1.05]);
    const visorMat = toon(0x1a2244);
    switch (type) {
      case 'helmet': // volledige helm met getint vizier
        add(new THREE.SphereGeometry(0.34, 16, 12), accent, [0, 0.04, -0.01], [0, 0, 0], [1, 1.02, 1.04]);
        add(new THREE.SphereGeometry(0.3, 16, 8, Math.PI / 2 - 1.1, 2.2, 1.15, 0.75), toon(0x39e6ff, { emissive: 0x1aa6c4, emissiveIntensity: 0.4 }), [0, 0.04, 0.06], [0, 0, 0], [1.05, 1, 1.08], 0);
        add(new THREE.BoxGeometry(0.06, 0.12, 0.3), trim, [0, 0.34, 0], [0, 0, 0], [1, 1, 1], 0);
        break;
      case 'cap': // pet achterstevoren
        hair(darkMat);
        add(new THREE.SphereGeometry(0.315, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), accent, [0, 0.06, 0], [0, 0, 0], [1, 1, 1]);
        add(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 12, 1, false, 0, Math.PI), accent, [0, 0.1, -0.3], [-0.2, 0, 0], [1, 1, 1.2]);
        break;
      case 'mohawk':
        hair(toon(0x2b2b38));
        for (let i = 0; i < 5; i++) add(new THREE.ConeGeometry(0.07, 0.22, 5), accent, [0, 0.33 - Math.abs(i - 1) * 0.02, 0.18 - i * 0.1], [-0.3 - i * 0.2, 0, 0], [1, 1, 1], 0.06);
        break;
      case 'beanie':
        add(new THREE.SphereGeometry(0.32, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), accent, [0, 0.05, 0], [-0.1, 0, 0], [1, 1.12, 1.05]);
        add(new THREE.TorusGeometry(0.3, 0.05, 6, 18), trim, [0, 0.07, 0], [Math.PI / 2 - 0.1, 0, 0], [1, 1, 1], 0);
        break;
      case 'headphones':
        hair(toon(0x5a3a24));
        add(new THREE.TorusGeometry(0.32, 0.035, 6, 18, Math.PI), darkMat, [0, 0.03, 0], [0, 0, 0], [1, 1.05, 1], 0);
        for (const sx of [-1, 1]) add(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 12), accent, [sx * 0.31, 0.0, 0], [0, 0, Math.PI / 2], [1, 1, 1]);
        break;
      case 'hood':
        add(new THREE.SphereGeometry(0.37, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), body, [0, 0.02, -0.05], [-0.45, 0, 0], [1, 1.05, 1.1]);
        add(new THREE.BoxGeometry(0.42, 0.1, 0.06), visorMat, [0, 0.03, 0.28], [0, 0, 0], [1, 1, 1], 0);
        add(new THREE.BoxGeometry(0.3, 0.025, 0.02), toon(0xff3d8b, { emissive: 0xff3d8b, emissiveIntensity: 0.6 }), [0, 0.03, 0.315], [0, 0, 0], [1, 1, 1], 0);
        break;
      case 'bandana':
        hair(toon(0x1f1f2a));
        add(new THREE.CylinderGeometry(0.29, 0.25, 0.16, 14, 1, true), accent, [0, -0.11, 0.015], [0.1, 0, 0], [1, 1, 1.08], 0);
        add(new THREE.TorusGeometry(0.29, 0.03, 6, 18), trim, [0, 0.12, 0], [Math.PI / 2 - 0.2, 0, 0], [1, 1, 1], 0);
        break;
      case 'shades':
        for (let i = 0; i < 4; i++) add(new THREE.ConeGeometry(0.1, 0.24, 5), accent, [(i - 1.5) * 0.12, 0.26, -0.02 - Math.abs(i - 1.5) * 0.03], [-0.2, 0, (i - 1.5) * -0.35], [1, 1, 1], 0.06);
        add(new THREE.BoxGeometry(0.4, 0.08, 0.05), darkMat, [0, 0.04, 0.29], [0, 0, 0], [1, 1, 1], 0);
        break;
      case 'crown':
        hair(toon(0xfff1c2));
        add(new THREE.CylinderGeometry(0.22, 0.25, 0.12, 10, 1, true), toon(0xffd400, { emissive: 0xffa800, emissiveIntensity: 0.25 }), [0, 0.3, 0], [0, 0, 0], [1, 1, 1], 0.06);
        for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; add(new THREE.ConeGeometry(0.05, 0.14, 4), toon(0xffd400), [Math.sin(a) * 0.22, 0.42, Math.cos(a) * 0.22], [0, 0, 0], [1, 1, 1], 0); }
        break;
      default:
        hair(darkMat);
    }
  }

  setWeapon(id) {
    for (const [k, w] of Object.entries(this.weapons)) w.visible = k === id;
    const w = this.weapons[id];
    this.muzzle.position.copy(w.userData.tip).add(w.position);
    this.weaponId = id;
  }

  getMuzzle(out) { return this.muzzle.getWorldPosition(out); }

  hit(strength = 1) {
    this.flash = 1;
    this.recoil = Math.min(1, 0.4 + strength * 0.6);
    this.sqVel -= 2.5 * strength;
  }
  jump(double = false) {
    this.sqVel += 4;
    if (double) this.flip = 1;
  }
  land(impact) { this.sqVel -= Math.min(6, impact * 0.3); }
  fire(kick = 1) { this.recoil = Math.max(this.recoil, 0.25 * kick); }

  pop() { this.popT = 0; }
  spawnIn() { this.spawnT = 0; this.popT = -1; this.root.visible = true; this.root.scale.setScalar(0.01); }

  update(dt, { speed = 0, onGround = true, aimPitch = 0, invuln = false, t = 0 }) {
    // eliminatie & spawn
    if (this.popT >= 0) {
      this.popT += dt;
      const k = this.popT / 0.25;
      const s = k < 0.3 ? 1 + k * 0.4 : Math.max(0, 1.12 * (1 - (k - 0.3) / 0.7));
      this.root.scale.setScalar(Math.max(0.001, s));
      this.root.rotation.y += dt * 18;
      if (k >= 1) { this.root.visible = false; this.popT = -1; }
      return;
    }
    if (this.spawnT >= 0) {
      this.spawnT += dt;
      const k = Math.min(1, this.spawnT / 0.4);
      this.root.scale.setScalar(Math.max(0.01, 1 - (1 - k) ** 3 + Math.sin(k * Math.PI) * 0.08));
      if (k >= 1) { this.spawnT = -1; this.root.scale.setScalar(1); }
    }

    // loopcyclus: benen zwaaien vanaf de heup, romp draait licht mee
    const run = Math.min(1, speed / 9);
    this.phase += dt * (3 + speed * 1.15);
    const sw = Math.sin(this.phase);
    if (onGround) {
      this.legs[0].rotation.x = sw * 0.75 * run;
      this.legs[1].rotation.x = -sw * 0.75 * run;
    } else {
      this.legs[0].rotation.x = -0.5;
      this.legs[1].rotation.x = 0.35;
    }
    const bob = onGround ? Math.abs(Math.cos(this.phase)) * 0.06 * run : 0;
    this.lean.position.y = 0.84 + bob + (1 - run) * Math.sin(t * 2) * 0.008;
    this.torsoG.rotation.y = sw * 0.12 * run;

    const targetLean = run * 0.14 - this.recoil * 0.2;
    this.leanX += (targetLean - this.leanX) * Math.min(1, dt * 12);
    this.lean.rotation.x = this.leanX;

    // subtiele squash & stretch (strakker dan voorheen)
    const k = 260, damp = 18;
    this.sqVel += (-(this.sq - 1) * k - this.sqVel * damp) * dt;
    this.sq += this.sqVel * dt;
    const sq = THREE.MathUtils.clamp(this.sq, 0.86, 1.14);
    this.squash.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));

    // salto bij dubbelsprong
    if (this.flip > 0) {
      this.flip = Math.max(0, this.flip - dt / 0.45);
      const e = 1 - this.flip;
      this.spin.rotation.x = (1 - (1 - e) ** 3) * Math.PI * 2;
    } else this.spin.rotation.x = 0;

    // richten: wapen + beide armen volgen de kijkrichting
    const pitch = -aimPitch * 0.9 - this.recoil * 0.35;
    this.gunPivot.rotation.x = pitch;
    this.leftArm.rotation.x = pitch;
    this.head.rotation.x = -aimPitch * 0.35;
    this.recoil = Math.max(0, this.recoil - dt * 5);

    // knipperen
    this.blinkT -= dt;
    const blink = this.blinkT < 0.1 && this.blinkT > 0 ? 0.15 : 1;
    if (this.blinkT <= 0) this.blinkT = 2.5 + Math.random() * 3.5;
    for (const e of this.eyes) e.scale.y = blink;

    // trefferflits
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 7);
      for (const m of this.materials) m.emissiveIntensity = this.flash * 0.9;
    }

    this.squash.visible = !invuln || Math.floor(t * 14) % 2 === 0;
    this.ring.material.opacity = 0.55 + Math.sin(t * 4) * 0.15;
  }

  dispose() {
    for (const m of this.materials) m.dispose();
    this.ring.material.dispose();
  }
}

// Wapens: gunmetal-behuizing met een gloeiende signatuurkleur per wapen.
function buildWeaponModels() {
  const metal = toon(0x2a3150);
  const metalLight = toon(0x4a5480);
  const glow = (c) => toon(c, { emissive: c, emissiveIntensity: 0.55 });
  const box = (w, h, d, r = 0.03) => new RoundedBoxGeometry(w, h, d, 2, r);
  const mk = (parts, tip) => {
    const g = new THREE.Group();
    for (const [geo, mat, pos, rot, outline] of parts) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(...pos);
      if (rot) m.rotation.set(...rot);
      m.castShadow = true;
      if (outline) addOutline(m, 0.06);
      g.add(m);
    }
    g.userData.tip = tip;
    return g;
  };
  return {
    // Pulsgeweer: slank, lang, cyaan energielijn
    blaster: mk([
      [box(0.12, 0.16, 0.6), metal, [0, 0.02, 0.15], null, true],
      [box(0.13, 0.04, 0.5), glow(0x2ee0ff), [0, 0.11, 0.17]],
      [new THREE.CylinderGeometry(0.035, 0.035, 0.3, 8), metalLight, [0, 0.01, 0.55], [Math.PI / 2, 0, 0]],
      [box(0.08, 0.16, 0.08), metal, [0, -0.1, 0.02]],
      [box(0.06, 0.06, 0.12), glow(0x2ee0ff), [0, 0.16, 0.0]],
    ], new THREE.Vector3(0, 0.01, 0.72)),
    // Stuiterwerper: korte, dikke loop met oranje trommel
    bouncer: mk([
      [box(0.16, 0.18, 0.42, 0.05), metal, [0, 0.02, 0.1], null, true],
      [new THREE.CylinderGeometry(0.13, 0.13, 0.2, 10), glow(0xff7a1a), [0, 0.02, 0.06], [Math.PI / 2, 0, 0], true],
      [new THREE.CylinderGeometry(0.09, 0.11, 0.3, 10), metalLight, [0, 0.04, 0.42], [Math.PI / 2, 0, 0]],
      [box(0.08, 0.16, 0.08), metal, [0, -0.1, -0.02]],
    ], new THREE.Vector3(0, 0.04, 0.6)),
    // Raketwerper: brede buis op de schouder met magenta mond
    rocket: mk([
      [new THREE.CylinderGeometry(0.14, 0.14, 0.85, 12), metal, [0, 0.1, 0.18], [Math.PI / 2, 0, 0], true],
      [new THREE.TorusGeometry(0.14, 0.035, 6, 14), glow(0xff3d8b), [0, 0.1, 0.6]],
      [new THREE.TorusGeometry(0.14, 0.035, 6, 14), metalLight, [0, 0.1, -0.24]],
      [box(0.06, 0.1, 0.16), glow(0xffd400), [0.15, 0.14, 0.18]],
      [box(0.08, 0.14, 0.08), metal, [0, -0.06, 0.05]],
    ], new THREE.Vector3(0, 0.1, 0.66)),
  };
}
