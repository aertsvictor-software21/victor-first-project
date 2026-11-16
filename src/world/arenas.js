import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CollisionWorld } from './collision.js';
import { toon, addOutline } from '../style/materials.js';

// ------------------------------------------------------------------
// Arena-definities. Elke arena heeft een eigen karakter en kleurenset.
// ------------------------------------------------------------------
export const ARENAS = [
  {
    id: 'zonneweide',
    name: 'Zonneweide',
    tagline: 'Glooiend grasland rond een heldere vijver',
    swatch: ['#6BD35A', '#3DD6F5', '#FFC83D'],
    sky: { top: 0x3ea6ff, horizon: 0xc4ecff, bottom: 0xe9f8ff },
    hemi: [0xcfeeff, 0x6bbf4e],
    sun: 0xfff1d0,
    build: buildMeadow,
  },
  {
    id: 'koraalbaai',
    name: 'Koraalbaai',
    tagline: 'Zonnig strand met een turquoise lagune',
    swatch: ['#F6DC9A', '#2FD9E0', '#FF7A63'],
    sky: { top: 0x47c1ff, horizon: 0xd8f6ff, bottom: 0xf0fcff },
    hemi: [0xdaf6ff, 0xf3d999],
    sun: 0xfff3dc,
    build: buildBeach,
  },
  {
    id: 'wolkentuin',
    name: 'Wolkentuin',
    tagline: 'Zwevende eilanden hoog boven de wolken',
    swatch: ['#B9A6FF', '#9FF2C9', '#FFFFFF'],
    sky: { top: 0x6f8dff, horizon: 0xf1e6ff, bottom: 0xffffff },
    hemi: [0xeee6ff, 0xb9a6ff],
    sun: 0xfff6ea,
    build: buildSkyGarden,
  },
];

export const getArena = (id) => ARENAS.find((a) => a.id === id) || ARENAS[0];

// ------------------------------------------------------------------
// Bouwstenen
// ------------------------------------------------------------------
class Builder {
  constructor(quality) {
    this.group = new THREE.Group();
    this.world = new CollisionWorld();
    this.spawns = [];
    this.pickups = [];
    this.animated = []; // (dt, t) => void
    this.quality = quality;
    this.killY = -8;
    this.bounds = 40;
  }

  mesh(geo, mat, { shadow = true, receive = true } = {}) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = shadow;
    m.receiveShadow = receive;
    this.group.add(m);
    return m;
  }

  island(x, z, r, topY, depth, top, side) {
    const seg = 40;
    const cap = this.mesh(new THREE.CylinderGeometry(r, r, 0.6, seg), toon(top), { shadow: false });
    cap.position.set(x, topY - 0.3, z);
    const body = this.mesh(new THREE.CylinderGeometry(r * 0.98, r * 0.55, depth, seg, 1), toon(side), { shadow: false });
    body.position.set(x, topY - 0.6 - depth / 2, z);
    // afgeronde rand
    const rim = this.mesh(new THREE.TorusGeometry(r - 0.05, 0.32, 6, seg), toon(top), { shadow: false });
    rim.rotation.x = Math.PI / 2;
    rim.position.set(x, topY - 0.32, z);
    this.world.addCylinder(x, z, r, topY - 0.6 - depth, topY);
    return cap;
  }

  box(x, y, z, w, h, d, color, { radius = 0.25, collide = true, outline = false } = {}) {
    const m = this.mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 2, h / 2, d / 2)), toon(color));
    m.position.set(x, y + h / 2, z);
    if (outline) addOutline(m, 0.03);
    if (collide) this.world.addBox(new THREE.Vector3(x - w / 2, y, z - d / 2), new THREE.Vector3(x + w / 2, y + h, z + d / 2));
    return m;
  }

  // Platform met een lichtere bovenlaag voor een duidelijke loopzone
  platform(x, y, z, w, d, base, top, h = 0.8) {
    this.box(x, y - h, z, w, h, d, base, { radius: 0.3, collide: false });
    this.box(x, y - 0.25, z, w + 0.2, 0.3, d + 0.2, top, { radius: 0.12, collide: false });
    this.world.addBox(new THREE.Vector3(x - w / 2 - 0.1, y - h, z - d / 2 - 0.1), new THREE.Vector3(x + w / 2 + 0.1, y + 0.05, z + d / 2 + 0.1));
  }

  pillar(x, z, r, y0, y1, color, collide = true) {
    const m = this.mesh(new THREE.CylinderGeometry(r, r * 1.08, y1 - y0, 20), toon(color));
    m.position.set(x, (y0 + y1) / 2, z);
    if (collide) this.world.addCylinder(x, z, r, y0, y1);
    return m;
  }

  rock(x, y, z, s, color, rotY = 0) {
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const m = this.mesh(geo, toon(color, { flatShading: true }));
    m.scale.set(s * 1.2, s * 0.85, s);
    m.rotation.y = rotY;
    m.position.set(x, y + s * 0.55, z);
    addOutline(m, 0.035);
    const ext = s * 0.85;
    this.world.addBox(new THREE.Vector3(x - ext, y, z - ext), new THREE.Vector3(x + ext, y + s * 1.3, z + ext));
    return m;
  }

  tree(x, y, z, s = 1, leaf = 0x4fc45a, collide = true) {
    const trunk = this.mesh(new THREE.CylinderGeometry(0.28 * s, 0.4 * s, 2.4 * s, 8), toon(0xa86b45));
    trunk.position.set(x, y + 1.2 * s, z);
    const blobs = [[0, 3.1, 0, 1.5], [0.9, 2.6, 0.3, 1.0], [-0.8, 2.7, -0.4, 1.1], [0.1, 3.9, -0.2, 1.0]];
    for (const [bx, by, bz, br] of blobs) {
      const b = this.mesh(new THREE.IcosahedronGeometry(br * s, 1), toon(leaf, { flatShading: true }));
      b.position.set(x + bx * s, y + by * s, z + bz * s);
    }
    if (collide) this.world.addCylinder(x, z, 0.45 * s, y, y + 4.5 * s);
  }

  palm(x, y, z, s = 1, lean = 0.25) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = Math.random() * Math.PI * 2;
    this.group.add(g);
    const segs = 6;
    let px = 0, py = 0;
    for (let i = 0; i < segs; i++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.26 * s, 0.32 * s, 0.75 * s, 8), toon(i % 2 ? 0xc99363 : 0xb5794b));
      px = Math.sin(i / segs * lean * 2) * i * 0.18 * s;
      py = (i + 0.5) * 0.72 * s;
      seg.position.set(px, py, 0);
      seg.rotation.z = -lean * i / segs;
      seg.castShadow = true;
      g.add(seg);
    }
    const crownY = segs * 0.72 * s;
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.55 * s, 2.6 * s, 4), toon(i % 2 ? 0x3fbf5a : 0x5fd35a, { flatShading: true }));
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(px + Math.cos(a) * 1.1 * s, crownY - 0.2 * s, Math.sin(a) * 1.1 * s);
      leaf.rotation.set(0, -a, Math.PI / 2 + 0.35);
      leaf.rotation.order = 'YZX';
      leaf.castShadow = true;
      g.add(leaf);
    }
    const coco = new THREE.Mesh(new THREE.SphereGeometry(0.25 * s, 8, 6), toon(0x7a4a2a));
    coco.position.set(px + 0.25, crownY - 0.45 * s, 0.15);
    g.add(coco);
    this.world.addCylinder(x, z, 0.4 * s, y, y + crownY);
  }

  jumpPad(x, y, z, power = 21, color = 0xffc83d) {
    const base = this.mesh(new THREE.CylinderGeometry(1.25, 1.4, 0.3, 24), toon(0xffffff));
    base.position.set(x, y + 0.15, z);
    const top = this.mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.12, 24), toon(color, { emissive: color, emissiveIntensity: 0.35 }));
    top.position.set(x, y + 0.33, z);
    const arrow = this.mesh(new THREE.ConeGeometry(0.45, 0.6, 3), toon(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.4 }), { shadow: false });
    arrow.position.set(x, y + 1.0, z);
    const ring = this.mesh(new THREE.TorusGeometry(1.0, 0.07, 6, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }), { shadow: false, receive: false });
    ring.rotation.x = Math.PI / 2;
    ring.userData.dynamic = arrow.userData.dynamic = true;
    this.world.addZone('jumppad', x, z, 1.1, y + 0.45, { power });
    this.world.addBox(new THREE.Vector3(x - 1.0, y, z - 1.0), new THREE.Vector3(x + 1.0, y + 0.45, z + 1.0));
    this.animated.push((dt, t) => {
      const k = (t * 1.4) % 1;
      ring.position.set(x, y + 0.45 + k * 2.2, z);
      ring.scale.setScalar(1 - k * 0.45);
      ring.material.opacity = 0.85 * (1 - k);
      arrow.position.y = y + 1.05 + Math.sin(t * 4) * 0.15;
      arrow.rotation.y = t * 1.5;
    });
  }

  pond(x, y, z, r) {
    const water = this.mesh(new THREE.CircleGeometry(r, 40), toon(0x3dd6f5, { transparent: true, opacity: 0.92 }), { shadow: false });
    water.rotation.x = -Math.PI / 2;
    water.position.set(x, y + 0.04, z);
    const edge = this.mesh(new THREE.TorusGeometry(r, 0.35, 6, 40), toon(0xe8dcc6, { flatShading: true }));
    edge.rotation.x = Math.PI / 2;
    edge.position.set(x, y + 0.05, z);
    this.world.addZone('water', x, z, r, y);
    // waterlelies
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2, d = (0.3 + Math.random() * 0.6) * r;
      const pad = this.mesh(new THREE.CircleGeometry(0.45 + Math.random() * 0.3, 10, 0.3, Math.PI * 1.8), toon(0x4fc45a), { shadow: false });
      pad.rotation.x = -Math.PI / 2;
      pad.rotation.z = Math.random() * 6;
      pad.position.set(x + Math.cos(a) * d, y + 0.07, z + Math.sin(a) * d);
    }
    const sparkleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0 });
    const sparkles = [];
    for (let i = 0; i < 6; i++) {
      const s = this.mesh(new THREE.CircleGeometry(0.12, 4), sparkleMat.clone(), { shadow: false, receive: false });
      s.rotation.x = -Math.PI / 2;
      s.userData.phase = Math.random() * 5;
      s.userData.dynamic = true;
      sparkles.push(s);
    }
    this.animated.push((dt, t) => {
      for (const s of sparkles) {
        const k = ((t + s.userData.phase) * 0.5) % 1;
        if (k < 0.02) {
          const a = Math.random() * 6.28, d = Math.random() * r * 0.9;
          s.position.set(x + Math.cos(a) * d, y + 0.08, z + Math.sin(a) * d);
        }
        s.material.opacity = Math.sin(k * Math.PI) * 0.9;
        s.scale.setScalar(0.5 + k);
      }
    });
  }

  sea(y, color, foam = true, islandR = 0, cx = 0, cz = 0) {
    const sea = this.mesh(new THREE.CircleGeometry(260, 48), toon(color), { shadow: false });
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = y;
    if (foam && islandR > 0) {
      const ring = this.mesh(new THREE.RingGeometry(islandR + 0.2, islandR + 1.4, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }), { shadow: false, receive: false });
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(cx, y + 0.03, cz);
      ring.userData.dynamic = true;
      this.animated.push((dt, t) => {
        const k = 1 + Math.sin(t * 1.3) * 0.02;
        ring.scale.set(k, k, 1);
        ring.material.opacity = 0.55 + Math.sin(t * 1.3) * 0.2;
      });
    }
    this.killY = y - 0.8;
  }

  clouds(count, minR, maxR, yMin, yMax, color = 0xffffff, scale = 1) {
    const mat = toon(color);
    const geo = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      g.userData.dynamic = true;
      const a = Math.random() * Math.PI * 2, d = minR + Math.random() * (maxR - minR);
      g.position.set(Math.cos(a) * d, yMin + Math.random() * (yMax - yMin), Math.sin(a) * d);
      const n = 3 + Math.floor(Math.random() * 3);
      const parts = [];
      for (let j = 0; j < n; j++) {
        const s = (1.6 + Math.random() * 1.6) * scale;
        const part = geo.clone();
        part.scale(s, s * 0.75, s);
        part.translate((j - n / 2) * 1.8 * scale, Math.random() * 0.8 * scale, (Math.random() - 0.5) * 1.5 * scale);
        parts.push(part);
      }
      g.add(new THREE.Mesh(mergeGeometries(parts, false), mat)); // één draw call per wolk
      parts.forEach((p) => p.dispose());
      this.group.add(g);
      const speed = 0.4 + Math.random() * 0.6;
      this.animated.push((dt) => {
        const ang = Math.atan2(g.position.z, g.position.x) + dt * speed * 0.01;
        const r = Math.hypot(g.position.x, g.position.z);
        g.position.x = Math.cos(ang) * r;
        g.position.z = Math.sin(ang) * r;
      });
    }
  }

  // Grasplukjes en bloemen met instancing (1 draw call per soort)
  tufts(cx, cz, r, y, count, color, avoid = []) {
    count = Math.floor(count * (this.quality === 'low' ? 0.5 : 1));
    const geo = new THREE.ConeGeometry(0.12, 0.45, 3);
    geo.translate(0, 0.22, 0);
    const inst = new THREE.InstancedMesh(geo, toon(color), count);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    let n = 0;
    for (let tries = 0; n < count && tries < count * 4; tries++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * (r - 0.8);
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (avoid.some(([ax, az, ar]) => (x - ax) ** 2 + (z - az) ** 2 < ar * ar)) continue;
      p.set(x, y, z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6);
      const k = 0.7 + Math.random() * 0.8;
      s.set(k, k, k);
      inst.setMatrixAt(n++, m.compose(p, q, s));
    }
    inst.count = n;
    inst.receiveShadow = true;
    this.group.add(inst);
  }

  flowers(cx, cz, r, y, count, colors, avoid = []) {
    count = Math.floor(count * (this.quality === 'low' ? 0.5 : 1));
    const geo = new THREE.IcosahedronGeometry(0.16, 0);
    geo.translate(0, 0.3, 0);
    const inst = new THREE.InstancedMesh(geo, toon(0xffffff), count);
    const m = new THREE.Matrix4(), c = new THREE.Color();
    let n = 0;
    for (let tries = 0; n < count && tries < count * 4; tries++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * (r - 1);
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (avoid.some(([ax, az, ar]) => (x - ax) ** 2 + (z - az) ** 2 < ar * ar)) continue;
      m.makeTranslation(x, y, z);
      inst.setMatrixAt(n, m);
      inst.setColorAt(n, c.set(colors[n % colors.length]));
      n++;
    }
    inst.count = n;
    this.group.add(inst);
  }

  spawn(x, y, z) { this.spawns.push(new THREE.Vector3(x, y, z)); }
  pickup(x, y, z) { this.pickups.push(new THREE.Vector3(x, y, z)); }
}

// ------------------------------------------------------------------
// Zonneweide
// ------------------------------------------------------------------
function buildMeadow(b) {
  const R = 28;
  b.sea(-1.6, 0x3dc8f0, true, R);
  b.island(0, 0, R, 0, 7, 0x6bd35a, 0xc98d5a);

  // centrale vijver met stapstenen
  b.pond(0, 0, 0, 6.5);
  b.pillar(0, 0, 2.0, -0.2, 2.2, 0xe8dcc6);
  b.box(0, 2.2, 0, 3.4, 0.35, 3.4, 0xffc83d, { radius: 0.15 });
  for (let i = 0; i < 3; i++) {
    const a = i * (Math.PI * 2 / 3) + 0.4;
    b.pillar(Math.cos(a) * 4.2, Math.sin(a) * 4.2, 0.9, -0.2, 0.9, 0xe8dcc6);
  }

  // vier verhoogde terrassen met trap en springplatform
  const terr = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  terr.forEach(([sx, sz], i) => {
    const x = sx * 15, z = sz * 15;
    b.platform(x, 3.2, z, 7, 7, 0xe8dcc6, i % 2 ? 0xffc83d : 0x3d8bff, 3.2);
    // trap
    for (let s = 0; s < 6; s++) {
      const h = (s + 1) * 0.53;
      b.box(x - sx * 4.4, 0, z - sz * (2.6 - s * 0.95), 1.8, h, 0.95, 0xf3ead8, { radius: 0.1 });
    }
    b.jumpPad(x - sx * 1.0, 0, z - sz * 6.2);
    b.pickup(x, 3.2, z);
  });

  // rotsen als dekking
  const rocks = [[8, -3, 1.3], [-8, 3, 1.3], [3, 9, 1.1], [-3, -9, 1.1], [20, 0, 1.6], [-20, 0, 1.6], [0, 20, 1.5], [0, -20, 1.5]];
  rocks.forEach(([x, z, s], i) => b.rock(x, 0, z, s, i % 2 ? 0xd9cbb3 : 0xe8dcc6, i));

  // bomen langs de rand
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.31;
    b.tree(Math.cos(a) * 24.5, 0, Math.sin(a) * 24.5, 0.9 + (i % 3) * 0.12, i % 2 ? 0x4fc45a : 0x6fd65e);
  }

  // decor: heuvels in de verte
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const hill = b.mesh(new THREE.SphereGeometry(18 + (i % 3) * 7, 16, 10), toon(i % 2 ? 0x5fcf63 : 0x7ddc6a), { shadow: false });
    hill.position.set(Math.cos(a) * 120, -6, Math.sin(a) * 120);
    hill.scale.y = 0.55;
  }
  b.clouds(10, 70, 140, 25, 45);

  const avoid = [[0, 0, 7.2]].concat(terr.map(([sx, sz]) => [sx * 15, sz * 15, 5.5]));
  b.tufts(0, 0, R, 0, 700, 0x4fbf4a, avoid);
  b.flowers(0, 0, R, 0, 160, [0xffffff, 0xffc83d, 0xff5d73, 0xb9a6ff], avoid);

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    b.spawn(Math.cos(a) * 19, 0, Math.sin(a) * 19);
  }
  b.pickup(0, 2.55, 0);
  b.bounds = R;
}

// ------------------------------------------------------------------
// Koraalbaai
// ------------------------------------------------------------------
function buildBeach(b) {
  const R = 29;
  b.sea(-1.4, 0x2fd9e0, true, R);
  b.island(0, 0, R, 0, 6, 0xf6dc9a, 0xe0b870);

  // lagune met eiland in het midden
  const lag = b.mesh(new THREE.CircleGeometry(10, 48), toon(0x5ee8ef, { transparent: true, opacity: 0.95 }), { shadow: false });
  lag.rotation.x = -Math.PI / 2;
  lag.position.y = 0.04;
  b.world.addZone('water', 0, 0, 10, 0);
  b.island(0, 0, 4.2, 1.3, 1.6, 0xf6dc9a, 0xe0b870);
  b.palm(0.6, 1.3, 0.4, 1.0);
  b.jumpPad(0, 0, 7.2, 19, 0xff5d73);
  b.jumpPad(0, 0, -7.2, 19, 0xff5d73);

  // houten steigers de zee in
  for (const [x, z, w, d] of [[24, 0, 12, 3.2], [-24, 0, 12, 3.2]]) {
    b.box(x, -0.2, z, w, 0.5, d, 0xc28a5a, { radius: 0.08 });
    for (let i = -2; i <= 2; i++) b.pillar(x + i * 2.6, z + d / 2 - 0.3, 0.2, -2, -0.2, 0x9a6440, false);
  }

  // kratstapels als dekking
  const crates = [[10, 12], [-10, -12], [-12, 10], [12, -10], [18, 7], [-18, -7]];
  crates.forEach(([x, z], i) => {
    b.box(x, 0, z, 2, 2, 2, 0xd9a066, { radius: 0.15, outline: true });
    if (i % 2 === 0) b.box(x + 1.1, 0, z + 0.6, 1.4, 1.4, 1.4, 0xe8b57a, { radius: 0.12, outline: true });
    else b.box(x + 0.1, 2, z, 1.5, 1.5, 1.5, 0xe8b57a, { radius: 0.12, outline: true });
  });

  // twee duinen-platforms
  b.platform(0, 2.8, 19, 9, 5, 0xf0cf86, 0xff7a63, 2.8);
  b.platform(0, 2.8, -19, 9, 5, 0xf0cf86, 0x3dd6f5, 2.8);
  for (const sz of [1, -1]) {
    for (let s = 0; s < 5; s++) b.box(-6.2 + s * 0.9, 0, sz * 15.3, 0.9, (s + 1) * 0.54, 1.8, 0xf6e2b0, { radius: 0.1 });
    b.pickup(0, 2.8, sz * 19);
  }

  // koraalrotsen
  const coral = [[7, -4, 1.1, 0xff7a63], [-7, 4, 1.1, 0xff9ab0], [20, -16, 1.4, 0xff9ab0], [-20, 16, 1.4, 0xff7a63], [15, 18, 1.0, 0xffb38a], [-15, -18, 1.0, 0xffb38a]];
  coral.forEach(([x, z, s, c], i) => b.rock(x, 0, z, s, c, i));

  // palmen langs de rand
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.6;
    b.palm(Math.cos(a) * 25, 0, Math.sin(a) * 25, 0.9 + (i % 3) * 0.1);
  }

  // parasols (decor)
  for (const [x, z, c] of [[16, 2, 0xff5d73], [-16, -2, 0x3d8bff]]) {
    b.pillar(x, z, 0.08, 0, 2.6, 0xffffff, false);
    const top = b.mesh(new THREE.ConeGeometry(1.8, 0.8, 8), toon(c, { flatShading: true }));
    top.position.set(x, 2.8, z);
  }

  // verre eilandjes
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const isl = b.mesh(new THREE.SphereGeometry(8 + (i % 3) * 4, 14, 8), toon(i % 2 ? 0x5fd35a : 0xf6dc9a), { shadow: false });
    isl.position.set(Math.cos(a) * 110, -4, Math.sin(a) * 110);
    isl.scale.y = 0.45;
  }
  b.clouds(9, 70, 140, 25, 45);

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.spawn(Math.cos(a) * 17, 0, Math.sin(a) * 17);
  }
  b.pickup(0, 1.3, 0);
  b.bounds = R;
}

// ------------------------------------------------------------------
// Wolkentuin
// ------------------------------------------------------------------
function buildSkyGarden(b) {
  b.killY = -14;
  const top = 0x9ff2c9, side = 0xb9a6ff;
  b.island(0, 0, 10, 0, 6, top, side);
  const outer = [[22, 0], [-22, 0], [0, 22], [0, -22]];
  outer.forEach(([x, z]) => b.island(x, z, 7.5, 0, 5, top, side));

  // bruggen
  b.box(15.5, -0.5, 0, 12, 0.5, 3, 0xffffff, { radius: 0.15 });
  b.box(-15.5, -0.5, 0, 12, 0.5, 3, 0xffffff, { radius: 0.15 });
  b.box(0, -0.5, 15.5, 3, 0.5, 12, 0xffffff, { radius: 0.15 });
  b.box(0, -0.5, -15.5, 3, 0.5, 12, 0xffffff, { radius: 0.15 });

  // centrale toren
  b.pillar(0, 0, 3.2, 0, 3.6, 0xf3ecff);
  b.box(0, 3.6, 0, 7.2, 0.3, 7.2, 0xffc83d, { radius: 0.15, collide: false });
  b.world.addBox(new THREE.Vector3(-3.6, 0, -3.6), new THREE.Vector3(3.6, 3.9, 3.6));
  b.pillar(0, 0, 1.4, 3.9, 7.4, 0xf3ecff);
  b.box(0, 7.4, 0, 3.6, 0.3, 3.6, 0x8b5cf6, { radius: 0.12 });
  b.jumpPad(6.2, 0, 0, 18, 0x8b5cf6);
  b.jumpPad(-6.2, 0, 0, 18, 0x8b5cf6);
  // tweede niveau via springplatforms op het torendak
  b.jumpPad(2.2, 3.9, 2.2, 17, 0x2ee6a8);

  // kristallen op de buiteneilanden
  outer.forEach(([x, z], i) => {
    const cx = x * 1.05, cz = z * 1.05;
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + i;
      const px = cx + Math.cos(a) * 3.2, pz = cz + Math.sin(a) * 3.2;
      const cr = b.mesh(new THREE.OctahedronGeometry(0.9, 0), toon(k % 2 ? 0xff9ab0 : 0x7fe3ff, { flatShading: true }));
      cr.position.set(px, 1.5, pz);
      cr.scale.set(0.8, 1.7, 0.8);
      cr.userData.dynamic = true;
      addOutline(cr, 0.04);
      b.world.addCylinder(px, pz, 0.75, 0, 3);
      b.animated.push((dt, t) => { cr.rotation.y = t * 0.6 + k; });
    }
    b.tree(x + (x ? 0 : 3), 0, z + (z ? 0 : 3), 0.8, 0xff9ab0);
    b.pickup(x * 0.95, 0, z * 0.95 + (x ? 2.2 : 0));
  });

  // wolkenzee
  b.clouds(18, 10, 90, -18, -10, 0xffffff, 3);
  b.clouds(10, 60, 140, 10, 40, 0xffffff, 1.2);
  // zwevende mini-eilandjes
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.4;
    const g = b.mesh(new THREE.ConeGeometry(2 + (i % 3), 3 + (i % 2) * 2, 7), toon(side, { flatShading: true }), { shadow: false });
    g.rotation.x = Math.PI;
    const r = 45 + (i % 3) * 15;
    g.position.set(Math.cos(a) * r, 4 + (i % 4) * 4, Math.sin(a) * r);
    const cap = b.mesh(new THREE.CylinderGeometry(2 + (i % 3), 2 + (i % 3), 0.5, 7), toon(top), { shadow: false });
    cap.position.copy(g.position).y += (3 + (i % 2) * 2) / 2;
    const baseY = g.position.y;
    g.userData.dynamic = cap.userData.dynamic = true;
    b.animated.push((dt, t) => {
      const o = Math.sin(t * 0.6 + i) * 0.6;
      g.position.y = baseY + o;
      cap.position.y = baseY + o + (3 + (i % 2) * 2) / 2;
    });
  }

  const avoid = [[0, 0, 4]];
  b.tufts(0, 0, 10, 0, 160, 0x7fe0b0, avoid);
  outer.forEach(([x, z]) => b.flowers(x, z, 7.5, 0, 40, [0xffffff, 0xff9ab0, 0xffc83d]));

  outer.forEach(([x, z]) => {
    b.spawn(x * 1.05 + (z ? 2 : 0), 0, z * 1.05 + (x ? 2 : 0));
    b.spawn(x * 1.05 - (z ? 2 : 0), 0, z * 1.05 - (x ? 2 : 0));
  });
  b.pickup(0, 7.7, 0);
  b.bounds = 30;
}

// ------------------------------------------------------------------
export function buildArena(def, quality) {
  const b = new Builder(quality);
  def.build(b);
  mergeStatic(b.group);
  b.group.add(makeSky(def.sky));
  return {
    def,
    group: b.group,
    world: b.world,
    spawns: b.spawns,
    pickups: b.pickups,
    killY: b.killY,
    bounds: b.bounds,
    update: (dt, t) => { for (const f of b.animated) f(dt, t); },
  };
}

// Voeg alle statische meshes per materiaal samen: veel minder draw calls.
function mergeStatic(group) {
  group.updateMatrixWorld(true);
  const buckets = new Map();
  const remove = [];
  const visit = (obj) => {
    if (obj.userData.dynamic) return;
    if (obj.isMesh && !obj.isInstancedMesh) {
      const key = obj.material.uuid + (obj.castShadow ? 's' : '') + (obj.receiveShadow ? 'r' : '');
      if (!buckets.has(key)) buckets.set(key, { material: obj.material, cast: obj.castShadow, receive: obj.receiveShadow, geos: [] });
      let g = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone();
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal'].includes(name)) g.deleteAttribute(name);
      g.applyMatrix4(obj.matrixWorld);
      // gespiegelde schaal (negatieve determinant) → winding omdraaien niet nodig voor onze objecten
      buckets.get(key).geos.push(g);
      remove.push(obj);
    }
    for (const c of obj.children) visit(c);
  };
  for (const c of group.children) visit(c);
  for (const o of remove) o.removeFromParent();
  // lege groepen opruimen
  for (const c of [...group.children]) if (c.isGroup && !c.userData.dynamic && c.children.length === 0) c.removeFromParent();
  for (const { material, cast, receive, geos } of buckets.values()) {
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const m = new THREE.Mesh(merged, material);
    m.castShadow = cast;
    m.receiveShadow = receive;
    group.add(m);
  }
}

function makeSky({ top, horizon, bottom }) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(top) },
      horizon: { value: new THREE.Color(horizon) },
      bottom: { value: new THREE.Color(bottom) },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.7, h), 0.8)) : mix(horizon, bottom, smoothstep(0.0,-0.3,h));
      gl_FragColor = vec4(c,1.0);
      #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 12), mat);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  return sky;
}
