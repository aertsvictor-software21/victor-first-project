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
    sun: 0xffe2b0,
    build: buildMeadow,
  },
  {
    id: 'koraalbaai',
    name: 'Koraalbaai',
    tagline: 'Zonnig strand met een turquoise lagune',
    swatch: ['#F6DC9A', '#2FD9E0', '#FF7A63'],
    sky: { top: 0x47c1ff, horizon: 0xd8f6ff, bottom: 0xf0fcff },
    hemi: [0xdaf6ff, 0xf3d999],
    sun: 0xffe6c0,
    build: buildBeach,
  },
  {
    id: 'wolkentuin',
    name: 'Wolkentuin',
    tagline: 'Zwevende eilanden hoog boven de wolken',
    swatch: ['#B9A6FF', '#9FF2C9', '#FFFFFF'],
    sky: { top: 0x6f8dff, horizon: 0xf1e6ff, bottom: 0xffffff },
    hemi: [0xeee6ff, 0xb9a6ff],
    sun: 0xfff0dc,
    build: buildSkyGarden,
  },
  {
    id: 'neonkelder',
    name: 'Neonkelder',
    tagline: 'Nachtelijke containerhal rond een bodemloze put',
    swatch: ['#1D2240', '#FF3D8B', '#2EE0FF'],
    sky: { top: 0x05071a, horizon: 0x2b1550, bottom: 0x0a0818 },
    hemi: [0xb8c0ff, 0x2a1840],
    sun: 0x9fb4ff,
    dark: true,
    light: { hemi: 1.2, sun: 1.4, fog: [26, 110], sunPos: [-20, 30, 12] },
    pitColors: [0x8b5cf6, 0xff3d8b, 0x2ee0ff],
    build: buildNeonVault,
  },
  {
    id: 'lavakrater',
    name: 'Lavakrater',
    tagline: 'Basalten ring rond een kolkende lavaput',
    swatch: ['#2A2228', '#FF5A1F', '#FFC83D'],
    sky: { top: 0x12060c, horizon: 0x6a1e10, bottom: 0x1a0806 },
    hemi: [0xffd6c2, 0x3a1810],
    sun: 0xff8a50,
    dark: true,
    light: { hemi: 1.25, sun: 1.8, fog: [28, 130], sunPos: [30, 18, -16] },
    pitColors: [0xff5a1f, 0xffc83d, 0xff3a00, 0x2a1414],
    build: buildLavaCrater,
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

  // Duidelijke arenagrens: stevige muur + transparante energiebarrière erboven.
  ringWall(x, z, r, { height = 3.4, color = 0xf3ead8, stripe = 0xffd400, barrier = 0xffd400, gaps = [], thick = 0.7, glow = false } = {}) {
    this.world.addRingWall(x, z, r - 0.05, gaps);
    // segmenten tussen de openingen (hoeken in atan2(z, x)-ruimte)
    const spans = [];
    if (!gaps.length) spans.push([0, Math.PI * 2]);
    else {
      const g = [...gaps].map(([a, hw]) => [a - hw, a + hw]).sort((p, q) => p[0] - q[0]);
      for (let i = 0; i < g.length; i++) spans.push([g[i][1], (i + 1 < g.length ? g[i + 1][0] : g[0][0] + Math.PI * 2)]);
    }
    const stripeMat = toon(stripe, glow ? { emissive: stripe, emissiveIntensity: 0.9 } : {});
    const barrierMat = new THREE.MeshBasicMaterial({ color: barrier, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false });
    const edgeMat = new THREE.MeshBasicMaterial({ color: barrier, transparent: true, opacity: 0.6 });
    for (const [a0, a1] of spans) {
      const len = a1 - a0, th0 = Math.PI / 2 - a1;
      const seg = Math.max(6, Math.round(len * 14));
      const mk = (rad, h, y, mat, opts) => { const m = this.mesh(new THREE.CylinderGeometry(rad, rad, h, seg, 1, true, th0, len), mat, opts); m.position.set(x, y, z); return m; };
      mk(r + thick / 2, height, height / 2, toon(color, { side: THREE.DoubleSide }));
      mk(r - 0.02, height, height / 2, toon(color, { side: THREE.DoubleSide }), { shadow: false });
      mk(r - 0.04, 0.35, height - 0.45, stripeMat, { shadow: false });
      // bovenrand
      // afgeronde bovenrand (torusboog, afgeplat)
      const capG = new THREE.Group();
      capG.position.set(x, height, z);
      capG.rotation.y = -a0;
      const cap = new THREE.Mesh(new THREE.TorusGeometry(r + thick / 4, thick / 2, 4, seg, len), toon(color));
      cap.rotation.x = Math.PI / 2;
      cap.scale.z = 0.35;
      capG.add(cap);
      this.group.add(capG);
      mk(r, 4.5, height + 2.25, barrierMat, { shadow: false, receive: false });
      mk(r, 0.06, height + 4.5, edgeMat, { shadow: false, receive: false });
    }
    // openingen afsluiten met een paal aan elke kant
    for (const [a, hw] of gaps) for (const sgn of [-1, 1]) {
      const aa = a + sgn * hw;
      this.pillar(x + Math.cos(aa) * r, z + Math.sin(aa) * r, thick * 0.7, 0, height + 0.3, color, false);
    }
  }

  // Rechte wand (assen-uitgelijnd), oneindig hoog als collider.
  wallBox(x0, z0, x1, z1, { height = 3.4, color = 0xf3ead8, stripe = 0xffd400, barrier = 0xffd400, glow = false, glass = false } = {}) {
    const w = x1 - x0, d = z1 - z0;
    this.world.addBox(new THREE.Vector3(x0, -50, z0), new THREE.Vector3(x1, 200, z1));
    if (glass) {
      const m = this.mesh(new THREE.BoxGeometry(w, height, d), new THREE.MeshBasicMaterial({ color: barrier, transparent: true, opacity: 0.18, depthWrite: false }), { shadow: false, receive: false });
      m.position.set((x0 + x1) / 2, height / 2, (z0 + z1) / 2);
      this.box((x0 + x1) / 2, height - 0.12, (z0 + z1) / 2, w + 0.04, 0.16, d + 0.04, stripe, { radius: 0.05, collide: false });
      return;
    }
    this.box((x0 + x1) / 2, 0, (z0 + z1) / 2, w, height, d, color, { radius: 0.08, collide: false });
    const strip = this.mesh(new THREE.BoxGeometry(w + 0.02, 0.3, d + 0.02), toon(stripe, glow ? { emissive: stripe, emissiveIntensity: 0.9 } : {}), { shadow: false });
    strip.position.set((x0 + x1) / 2, height - 0.5, (z0 + z1) / 2);
    const bar = this.mesh(new THREE.BoxGeometry(w, 4.5, d), new THREE.MeshBasicMaterial({ color: barrier, transparent: true, opacity: 0.1, depthWrite: false }), { shadow: false, receive: false });
    bar.position.set((x0 + x1) / 2, height + 2.25, (z0 + z1) / 2);
  }

  pointLight(x, y, z, color, intensity = 40, distance = 22) {
    const l = new THREE.PointLight(color, intensity, distance, 1.6);
    l.position.set(x, y, z);
    this.group.add(l);
    return l;
  }

  glowMat(color, k = 0.8) { return toon(color, { emissive: color, emissiveIntensity: k }); }

  spawn(x, y, z) { this.spawns.push(new THREE.Vector3(x, y, z)); }

  // Vul spawnpunten aan tot er genoeg zijn voor 20 spelers.
  fillSpawns(n = 24) {
    const tries = 4000, R = this.bounds - 1.5;
    const tmp = new THREE.Vector3();
    for (let i = 0; i < tries && this.spawns.length < n; i++) {
      const x = (Math.random() * 2 - 1) * R, z = (Math.random() * 2 - 1) * R;
      if (Math.hypot(x, z) > R) continue;
      const g = this.world.groundHeight(x, z, 0.3);
      if (g < -0.1 || g > 0.35) continue;
      if (this.world.zoneAt(x, z, g)) continue;
      tmp.set(x, g, z);
      if (this.world.resolveHorizontal(tmp, 0.7, 1.9)) continue;
      if (this.spawns.some((s) => s.distanceTo(tmp) < 3.2)) continue;
      this.spawns.push(tmp.clone());
    }
  }
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
  b.ringWall(0, 0, R - 0.6, { color: 0xf3ead8, stripe: 0x3d8bff, barrier: 0x7fd0ff });
  b.bounds = R - 1;
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
  b.ringWall(0, 0, R - 0.6, { color: 0xf6e7c4, stripe: 0xff7a63, barrier: 0x2fd9e0 });
  b.bounds = R - 1;
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
  // muren rond elk eiland met openingen voor de bruggen + glazen relingen
  const hw = 0.19;
  b.ringWall(0, 0, 9.7, { color: 0xf3ecff, stripe: 0x8b5cf6, barrier: 0xb9a6ff, gaps: [[0, hw], [Math.PI / 2, hw], [Math.PI, hw], [-Math.PI / 2, hw]] });
  const ohw = 0.26;
  b.ringWall(22, 0, 7.2, { color: 0xf3ecff, stripe: 0x2ee6a8, barrier: 0xb9a6ff, gaps: [[Math.PI, ohw]] });
  b.ringWall(-22, 0, 7.2, { color: 0xf3ecff, stripe: 0x2ee6a8, barrier: 0xb9a6ff, gaps: [[0, ohw]] });
  b.ringWall(0, 22, 7.2, { color: 0xf3ecff, stripe: 0x2ee6a8, barrier: 0xb9a6ff, gaps: [[-Math.PI / 2, ohw]] });
  b.ringWall(0, -22, 7.2, { color: 0xf3ecff, stripe: 0x2ee6a8, barrier: 0xb9a6ff, gaps: [[Math.PI / 2, ohw]] });
  const rail = { height: 2.6, barrier: 0xb9a6ff, stripe: 0xffffff, glass: true };
  for (const sx of [-1, 1]) {
    b.wallBox(sx > 0 ? 9.3 : -15.2, 1.6, sx > 0 ? 15.2 : -9.3, 1.85, rail);
    b.wallBox(sx > 0 ? 9.3 : -15.2, -1.85, sx > 0 ? 15.2 : -9.3, -1.6, rail);
    b.wallBox(1.6, sx > 0 ? 9.3 : -15.2, 1.85, sx > 0 ? 15.2 : -9.3, rail);
    b.wallBox(-1.85, sx > 0 ? 9.3 : -15.2, -1.6, sx > 0 ? 15.2 : -9.3, rail);
  }
  b.bounds = 29;
}

// ------------------------------------------------------------------
// Neonkelder — compact, donker, containers en een bodemloze put
// ------------------------------------------------------------------
function buildNeonVault(b) {
  const H = 16.5, P = 3.6; // halve breedte arena, halve breedte put
  b.killY = -5;
  const floorC = 0x1d2240, floorTop = 0x262c52;
  // vloer rondom de put
  for (const [x0, z0, x1, z1] of [[-H, P, H, H], [-H, -H, H, -P], [-H, -P, -P, P], [P, -P, H, P]]) {
    b.box((x0 + x1) / 2, -1, (z0 + z1) / 2, x1 - x0, 1, z1 - z0, floorTop, { radius: 0.04 });
  }
  // neonlijnen in de vloer
  const lineC = b.glowMat(0x2ee0ff, 0.9), lineM = b.glowMat(0xff3d8b, 0.9);
  for (const k of [-8, 8]) {
    const l1 = b.mesh(new THREE.BoxGeometry(2 * H, 0.03, 0.12), lineC, { shadow: false }); l1.position.set(0, 0.015, k);
    const l2 = b.mesh(new THREE.BoxGeometry(0.12, 0.03, 2 * H), lineC, { shadow: false }); l2.position.set(k, 0.015, 0);
  }
  // putrand en diepte
  for (const [x, z, w, d] of [[0, P, 2 * P + 0.3, 0.15], [0, -P, 2 * P + 0.3, 0.15], [P, 0, 0.15, 2 * P], [-P, 0, 0.15, 2 * P]]) {
    const m = b.mesh(new THREE.BoxGeometry(w, 0.1, d), lineM, { shadow: false }); m.position.set(x, 0.03, z);
  }
  const abyss = b.mesh(new THREE.PlaneGeometry(2 * P, 2 * P), new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.55 }), { shadow: false, receive: false });
  abyss.rotation.x = -Math.PI / 2; abyss.position.y = -7;
  for (let i = 1; i <= 3; i++) {
    const fr = b.mesh(new THREE.BoxGeometry(2 * P, 0.08, 2 * P), new THREE.MeshBasicMaterial({ color: 0xff3d8b, transparent: true, opacity: 0.25, wireframe: true }), { shadow: false, receive: false });
    fr.position.y = -i * 1.8;
  }
  b.world.addZone('pit', 0, 0, P, 0);

  // muren
  const wall = { height: 4.2, color: 0x141933, stripe: 0x2ee0ff, barrier: 0xff3d8b, glow: true };
  b.wallBox(-H - 1, -H - 1, H + 1, -H, wall);
  b.wallBox(-H - 1, H, H + 1, H + 1, { ...wall, stripe: 0xff3d8b, barrier: 0x2ee0ff });
  b.wallBox(-H - 1, -H, -H, H, { ...wall, stripe: 0x8b5cf6 });
  b.wallBox(H, -H, H + 1, H, { ...wall, stripe: 0x8b5cf6 });

  // containers als dekking (kleuren + neonstrip)
  const cont = [
    [-10, -3, 2.6, 5.6, 0x1f6f8b], [10, 3, 2.6, 5.6, 0x8b1f5a], [-4, -11.5, 5.6, 2.6, 0x3b2a8b], [4, 11.5, 5.6, 2.6, 0x1f8b5a],
    [-12.5, 9, 2.4, 2.4, 0x8b5a1f], [12.5, -9, 2.4, 2.4, 0x8b5a1f], [-7, 6.5, 2.2, 2.2, 0x2a3150], [7, -6.5, 2.2, 2.2, 0x2a3150],
  ];
  cont.forEach(([x, z, w, d, c], i) => {
    const h = i < 4 ? 2.6 : 1.4;
    b.box(x, 0, z, w, h, d, c, { radius: 0.06, outline: true });
    const s = b.mesh(new THREE.BoxGeometry(w + 0.04, 0.12, d + 0.04), i % 2 ? lineC : lineM, { shadow: false });
    s.position.set(x, h - 0.25, z);
  });
  // tweede laag op twee containers
  b.box(-10, 2.6, -4, 2.4, 1.3, 2.4, 0x2a3150, { radius: 0.06, outline: true });
  b.box(10, 2.6, 4, 2.4, 1.3, 2.4, 0x2a3150, { radius: 0.06, outline: true });

  // neonpilaren bij de put
  for (const [x, z] of [[-6.2, -6.2], [6.2, 6.2], [-6.2, 6.2], [6.2, -6.2]]) {
    b.pillar(x, z, 0.55, 0, 4.2, 0x141933);
    const band = b.mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.18, 14), x * z > 0 ? lineC : lineM, { shadow: false });
    band.position.set(x, 2.2, z);
  }
  // springplatforms naar de containers
  b.jumpPad(-13.5, 0, -3, 15, 0x2ee0ff);
  b.jumpPad(13.5, 0, 3, 15, 0xff3d8b);
  b.jumpPad(0, 0, -8.5, 14, 0x8b5cf6);
  b.jumpPad(0, 0, 8.5, 14, 0x8b5cf6);

  // skyline buiten de muren
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2, r = 45 + (i % 4) * 10;
    const h = 14 + ((i * 7) % 5) * 7;
    const tower = b.mesh(new THREE.BoxGeometry(6, h, 6), toon(0x0e1230), { shadow: false });
    tower.position.set(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r);
    const lamp = b.mesh(new THREE.BoxGeometry(6.1, 0.4, 6.1), i % 3 === 0 ? lineM : i % 3 === 1 ? lineC : b.glowMat(0x8b5cf6), { shadow: false });
    lamp.position.set(tower.position.x, h - 2.6, tower.position.z);
  }

  b.pointLight(-11, 4, -11, 0x2ee0ff, 45, 24);
  b.pointLight(11, 4, 11, 0xff3d8b, 45, 24);
  const pitLight = b.pointLight(0, -1, 0, 0x8b5cf6, 30, 12);
  b.animated.push((dt, t) => { pitLight.intensity = 26 + Math.sin(t * 3) * 8; });

  for (const [x, z] of [[-10, -3], [10, 3], [0, -13.5], [0, 13.5]]) b.pickup(x, x ? 2.6 : 0, z);
  b.bounds = H;
}

// ------------------------------------------------------------------
// Lavakrater — kleine ronde arena met een dodelijke lavaput
// ------------------------------------------------------------------
function buildLavaCrater(b) {
  const R = 18.5, P = 4.6;
  b.killY = -0.9;
  // basaltvloer met put
  const floor = b.mesh(new THREE.RingGeometry(P, R + 0.5, 56, 1), toon(0x2e2529), { shadow: false });
  floor.rotation.x = -Math.PI / 2;
  b.world.addAnnulus(0, 0, P, R + 1, -6, 0);
  const pitWall = b.mesh(new THREE.CylinderGeometry(P, P, 1.4, 40, 1, true), toon(0x1a1416, { side: THREE.BackSide }), { shadow: false });
  pitWall.position.y = -0.7;
  const rim = b.mesh(new THREE.TorusGeometry(P, 0.12, 6, 48), b.glowMat(0xff5a1f, 1), { shadow: false });
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.02;
  const lavaMat = toon(0xff5a1f, { emissive: 0xff3a00, emissiveIntensity: 1 });
  const lava = b.mesh(new THREE.CircleGeometry(P, 40), lavaMat, { shadow: false });
  lava.rotation.x = -Math.PI / 2; lava.position.y = -1.05;
  lava.userData.dynamic = true;
  b.world.addZone('pit', 0, 0, P, 0);
  // stapstenen in de lava (risico = beloning)
  b.pillar(0, 0, 1.15, -1.2, 0.25, 0x3a2e33);
  for (let i = 0; i < 3; i++) {
    const a = i * (Math.PI * 2 / 3) + 0.5;
    b.pillar(Math.cos(a) * 2.9, Math.sin(a) * 2.9, 0.75, -1.2, 0, 0x3a2e33);
  }
  b.pickup(0, 0.25, 0);

  // rotswand met gloeiende scheuren
  b.ringWall(0, 0, R, { height: 4.4, color: 0x221b1f, stripe: 0xff5a1f, barrier: 0xff7a1a, glow: true, thick: 1.2 });
  const crackM = b.glowMat(0xff7a1a, 1);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + 0.1;
    const c = b.mesh(new THREE.BoxGeometry(0.12, 1.4 + (i % 3) * 0.6, 0.05), crackM, { shadow: false });
    c.position.set(Math.cos(a) * (R - 0.08), 1.2 + (i % 2) * 0.6, Math.sin(a) * (R - 0.08));
    c.rotation.y = -a + Math.PI / 2; c.rotation.z = (i % 2 ? 0.3 : -0.25);
    const spike = b.mesh(new THREE.ConeGeometry(0.7, 1.6 + (i % 3) * 0.6, 5), toon(0x221b1f), { shadow: false });
    spike.position.set(Math.cos(a) * (R + 0.4), 4.4 + 0.6, Math.sin(a) * (R + 0.4));
  }

  // basaltzuilen als dekking
  const cols = [[8, 0, 1.0, 3.2], [-8, 0, 1.0, 3.2], [0, 8.5, 1.0, 3.2], [0, -8.5, 1.0, 3.2], [6, 6, 0.8, 1.2], [-6, -6, 0.8, 1.2], [-6, 6, 0.8, 1.2], [6, -6, 0.8, 1.2]];
  for (const [x, z, r, h] of cols) {
    const m = b.mesh(new THREE.CylinderGeometry(r, r * 1.1, h, 6), toon(0x3a2e33), {});
    m.position.set(x, h / 2, z);
    addOutline(m, 0.04);
    b.world.addCylinder(x, z, r, 0, h);
  }
  // verhoogde richels tegen de muur met trap
  for (const sx of [-1, 1]) {
    b.platform(sx * 13.2, 2.6, 0, 3.6, 9, 0x2e2529, 0x4a3a3f, 2.6);
    for (let s = 0; s < 5; s++) b.box(sx * 13.2, 0, -4.95 - (4 - s) * 0.9, 3.6, (s + 1) * 0.52, 0.9, 0x3a2e33, { radius: 0.06 });
  }
  for (const sz of [-1, 1]) {
    b.platform(0, 2.6, sz * 13.2, 9, 3.6, 0x2e2529, 0x4a3a3f, 2.6);
    b.pickup(0, 2.6, sz * 13.2);
  }
  b.jumpPad(10.2, 0, 4.8, 14, 0xff5a1f);
  b.jumpPad(-10.2, 0, -4.8, 14, 0xff5a1f);
  b.jumpPad(4.8, 0, -10.2, 14, 0xff5a1f);
  b.jumpPad(-4.8, 0, 10.2, 14, 0xff5a1f);
  // rotsblokken
  [[11, 9, 1.1], [-11, -9, 1.1], [-11, 9, 1.0], [11, -9, 1.0]].forEach(([x, z, s], i) => b.rock(x, 0, z, s, 0x3a2e33, i));

  // vulkanen in de verte
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3, r = 70 + (i % 3) * 20, h = 25 + (i % 3) * 12;
    const v = b.mesh(new THREE.ConeGeometry(h * 0.9, h, 8), toon(0x1c1215), { shadow: false });
    v.position.set(Math.cos(a) * r, h / 2 - 4, Math.sin(a) * r);
    const top = b.mesh(new THREE.ConeGeometry(h * 0.18, h * 0.2, 8), b.glowMat(0xff5a1f, 1), { shadow: false });
    top.position.set(v.position.x, h - 4 - h * 0.1 + 0.5, v.position.z);
  }

  // opstijgende sintels (1 draw call)
  const N = b.quality === 'low' ? 40 : 90;
  const embers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: 0xffa040 }), N);
  embers.frustumCulled = false;
  const ep = Array.from({ length: N }, () => ({ x: (Math.random() - 0.5) * 2 * R, z: (Math.random() - 0.5) * 2 * R, y: Math.random() * 10, v: 0.6 + Math.random() * 1.4, ph: Math.random() * 6 }));
  b.group.add(embers);
  const m4 = new THREE.Matrix4();
  b.animated.push((dt, t) => {
    for (let i = 0; i < N; i++) {
      const e = ep[i];
      e.y += e.v * dt;
      if (e.y > 12) { e.y = 0; const a = Math.random() * 6.28, r = Math.random() * P; e.x = Math.cos(a) * r * 1.4; e.z = Math.sin(a) * r * 1.4; }
      m4.makeTranslation(e.x + Math.sin(t + e.ph) * 0.4, e.y - 0.5, e.z + Math.cos(t * 0.8 + e.ph) * 0.4);
      embers.setMatrixAt(i, m4);
    }
    embers.instanceMatrix.needsUpdate = true;
    lavaMat.emissiveIntensity = 0.85 + Math.sin(t * 2.2) * 0.2;
    lava.rotation.z = t * 0.05;
  });

  const lavaLight = b.pointLight(0, 1.2, 0, 0xff6a20, 60, 20);
  b.pointLight(-12, 4, -12, 0xff7a1a, 25, 16);
  b.pointLight(12, 4, 12, 0xff7a1a, 25, 16);
  b.animated.push((dt, t) => { lavaLight.intensity = 52 + Math.sin(t * 2.2) * 12; });
  b.bounds = R - 1;
}

// ------------------------------------------------------------------
export function buildArena(def, quality) {
  const b = new Builder(quality);
  def.build(b);
  b.fillSpawns(24);
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
