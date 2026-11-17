import * as THREE from 'three';
import { Character } from '../entities/character.js';
import { WEAPONS, WEAPON_ORDER, SPECIAL, DASH, Projectiles, segSphere } from './weapons.js';
import { Effects } from './effects.js';
import { BotBrain } from './bot.js';
import { FX_COLORS } from '../style/palette.js';
import { toon } from '../style/materials.js';

export const MATCH_RULES = { duration: 180, scoreLimit: 15, respawn: 2.4, invuln: 1.5, maxHp: 100 };

const GRAVITY = 32;
const RADIUS = 0.45;
const HEIGHT = 1.9;
const MAX_SPEED = 9.2;
const JUMP_V = 12;
const DOUBLE_JUMP_V = 10.5;

// ------------------------------------------------------------------
// Fighter: één speler of bot in de match
// ------------------------------------------------------------------
export class Fighter {
  constructor({ id, name, skin, isPlayer, ringColor }) {
    this.id = id;
    this.name = name;
    this.skin = skin;
    this.isPlayer = isPlayer;
    this.character = new Character(skin, { ringColor });
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.hp = MATCH_RULES.maxHp;
    this.alive = false;
    this.onGround = false;
    this.coyote = 0;
    this.jumps = 0;
    this.dashT = 0; this.dashCd = 0; this.dashDir = new THREE.Vector3();
    this.specialCd = 2;
    this.weapon = 'blaster';
    this.ammo = Object.fromEntries(WEAPON_ORDER.map((w) => [w, WEAPONS[w].mag]));
    this.reloadT = 0;
    this.fireCd = 0;
    this.invuln = 0;
    this.respawnT = 0;
    this.lastAttacker = null; this.lastAttackT = -99;
    this.kills = 0; this.deaths = 0; this.streak = 0; this.damageDealt = 0;
    this.intent = { moveX: 0, moveY: 0, jump: false, dash: false, fire: false, special: false, weapon: null, reload: false };
    this.inWater = false;
    this.splashT = 0;
  }

  get forward() { return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  get right() { return new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw)); }
  get speed() { return Math.hypot(this.vel.x, this.vel.z); }
  get chest() { return new THREE.Vector3(this.pos.x, this.pos.y + 1.0, this.pos.z); }

  setWeapon(id) {
    if (this.weapon === id || !WEAPONS[id]) return;
    this.weapon = id;
    this.reloadT = 0;
    this.fireCd = Math.max(this.fireCd, 0.18);
    this.character.setWeapon(id);
    if (this.ammo[id] <= 0) this.reloadT = WEAPONS[id].reload;
  }
}

// ------------------------------------------------------------------
// Match
// ------------------------------------------------------------------
export class Match {
  constructor({ scene, arena, camera, hud, settings, playerProfile, bots, difficulty, audio, mode = {} }) {
    this.scene = scene;
    this.arena = arena;
    this.world = arena.world;
    this.camera = camera;
    this.hud = hud;
    this.settings = settings;
    this.audio = audio;
    this.time = 0;
    this.rules = { ...MATCH_RULES, ...mode };
    this.remaining = this.rules.duration;
    this.over = false;
    // spelersstatistieken voor uitdagingen, prestaties en XP
    this.stats = { kills: 0, killsBy: { blaster: 0, bouncer: 0, rocket: 0, special: 0 }, headshots: 0, ringOuts: 0, maxStreak: 0, pickups: 0, damage: 0, bestMulti: 0, revenge: 0 };
    this.multi = 0; this.lastKoT = -99; this.nemesis = null;
    this.shake = 0;
    this.camYaw = 0; this.camPitch = 0.15;
    this.camPos = new THREE.Vector3();
    this.effects = new Effects(scene, settings.maxParticles);
    this.projectiles = new Projectiles(scene, this.effects, this.world, {
      characters: () => this.fighters,
      damage: (t, a, o, opts) => this.damage(t, a, o, opts),
      explode: (p, w, o, d) => this.explode(p, w, o, d),
    });

    this.fighters = [];
    const player = new Fighter({ id: 'player', name: playerProfile.name, skin: playerProfile.skin, isPlayer: true, ringColor: 0xffc83d });
    this.player = player;
    this.fighters.push(player);
    bots.forEach((b, i) => {
      const f = new Fighter({ id: 'bot' + i, name: b.name, skin: b.skin, isPlayer: false, ringColor: 0xff5d73 });
      f.brain = new BotBrain(f, this, difficulty);
      this.fighters.push(f);
    });
    for (const f of this.fighters) {
      scene.add(f.character.root);
      this.respawn(f, true);
    }
    this.camYaw = player.yaw;

    // gezondheids-pickups
    this.pickups = arena.pickups.map((p) => this.makePickup(p));
  }

  makePickup(pos) {
    const g = new THREE.Group();
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 2), toon(0x2ee6a8, { emissive: 0x2ee6a8, emissiveIntensity: 0.35 }));
    const crossA = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.13, 0.13), toon(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.5 }));
    const crossB = crossA.clone(); crossB.rotation.z = Math.PI / 2;
    const cross = new THREE.Group(); cross.add(crossA, crossB); cross.position.z = 0.0;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.12, 20), toon(0xffffff));
    base.position.y = 0.06;
    orb.position.y = 1.0; cross.position.y = 1.0;
    orb.castShadow = true;
    g.add(orb, cross, base);
    g.position.copy(pos);
    this.scene.add(g);
    return { group: g, orb, cross, pos: pos.clone(), active: true, timer: 0 };
  }

  // ----------------------------------------------------------------
  respawn(f, initial = false) {
    // kies het spawnpunt het verst van tegenstanders
    let best = this.arena.spawns[0], bestScore = -Infinity;
    for (const s of this.arena.spawns) {
      let minD = Infinity;
      for (const o of this.fighters) if (o !== f && o.alive) minD = Math.min(minD, o.pos.distanceTo(s));
      const score = (minD === Infinity ? 100 : minD) + Math.random() * (initial ? 40 : 4);
      if (initial && this.fighters.some((o) => o !== f && o.alive && o.pos.distanceTo(s) < 2)) continue;
      if (score > bestScore) { bestScore = score; best = s; }
    }
    f.pos.copy(best);
    f.vel.set(0, 0, 0);
    f.yaw = Math.atan2(-best.x, -best.z); // kijk naar het midden
    f.pitch = 0;
    f.hp = MATCH_RULES.maxHp;
    f.alive = true;
    f.invuln = MATCH_RULES.invuln;
    for (const w of WEAPON_ORDER) f.ammo[w] = WEAPONS[w].mag;
    f.reloadT = 0;
    f.lastAttacker = null;
    f.character.spawnIn();
    f.character.root.position.copy(f.pos);
    this.effects.ring(f.pos.clone().setY(f.pos.y + 0.1), { color: f.isPlayer ? 0xffc83d : 0xffffff, size: 2.5, life: 0.5 });
    this.effects.burst(f.pos.clone().setY(f.pos.y + 0.5), 12, { speed: 4, colors: [0xffffff, f.skin.body, f.skin.accent], up: 3, life: 0.5 });
    if (f.isPlayer) { this.camYaw = f.yaw; this.camPitch = 0.15; }
  }

  // ----------------------------------------------------------------
  update(dt, input) {
    this.time += dt;
    if (!this.over) this.remaining = Math.max(0, this.remaining - dt);

    if (!this.over) this.readPlayerInput(input);
    for (const f of this.fighters) {
      if (!f.isPlayer && f.alive && !this.over) f.brain.think(dt);
      this.stepFighter(f, dt);
    }
    this.projectiles.update(dt);
    this.updatePickups(dt);
    this.effects.update(dt);
    this.updateCamera(dt);

    for (const f of this.fighters) {
      const c = f.character;
      c.root.position.copy(f.pos);
      if (f.alive && c.popT < 0) c.root.rotation.y = f.yaw;
      c.update(dt, { speed: f.speed, onGround: f.onGround, aimPitch: f.pitch, invuln: f.invuln > 0, t: this.time });
    }
    if (this.hidePlayer) this.player.character.squash.visible = false;

    if (!this.over) {
      const leader = this.standings()[0];
      if (this.remaining <= 0 || leader.kills >= this.rules.scoreLimit) this.finish();
    }
  }

  readPlayerInput(input) {
    const p = this.player;
    const sens = 0.0022 * this.settings.sensitivity;
    this.camYaw -= input.mouseDX * sens;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + input.mouseDY * sens, -1.1, 1.25);
    const it = p.intent;
    it.moveX = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
    it.moveY = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
    it.jump = input.hit('Space');
    it.dash = input.hit('ShiftLeft') || input.hit('ShiftRight');
    it.fire = input.mouseDown;
    it.special = input.hit('KeyE') || input.hit('KeyQ');
    it.reload = input.hit('KeyR');
    it.weapon = null;
    WEAPON_ORDER.forEach((w, i) => { if (input.hit('Digit' + (i + 1))) it.weapon = w; });
    if (input.wheel) {
      const i = WEAPON_ORDER.indexOf(p.weapon);
      it.weapon = WEAPON_ORDER[(i + input.wheel + WEAPON_ORDER.length) % WEAPON_ORDER.length];
    }
    p.yaw = this.camYaw;
    p.pitch = this.camPitch;
  }

  stepFighter(f, dt) {
    if (!f.alive) {
      if (!this.over) {
        f.respawnT -= dt;
        if (f.respawnT <= 0) this.respawn(f);
      }
      return;
    }
    const it = f.intent;
    f.invuln = Math.max(0, f.invuln - dt);
    f.dashCd = Math.max(0, f.dashCd - dt);
    f.specialCd = Math.max(0, f.specialCd - dt);
    f.fireCd = Math.max(0, f.fireCd - dt);

    if (it.weapon) f.setWeapon(it.weapon);

    // beweging
    const wish = new THREE.Vector3().addScaledVector(f.forward, it.moveY).addScaledVector(f.right, it.moveX);
    if (wish.lengthSq() > 1) wish.normalize();
    const maxSpeed = MAX_SPEED * (f.inWater ? 0.62 : 1);
    wish.multiplyScalar(maxSpeed);
    const accel = f.onGround ? 75 : 28;
    if (f.dashT > 0) {
      f.dashT -= dt;
      f.vel.x = f.dashDir.x * DASH.speed;
      f.vel.z = f.dashDir.z * DASH.speed;
      if (Math.random() < 0.8) this.effects.spawn(f.pos.clone().setY(f.pos.y + 0.8), new THREE.Vector3(), { life: 0.25, size: 1.6, grav: 0, color: f.skin.body });
    } else {
      const dvx = wish.x - f.vel.x, dvz = wish.z - f.vel.z;
      const dl = Math.hypot(dvx, dvz);
      const maxDv = accel * dt;
      if (dl > maxDv) { f.vel.x += (dvx / dl) * maxDv; f.vel.z += (dvz / dl) * maxDv; }
      else { f.vel.x = wish.x; f.vel.z = wish.z; }
    }

    // springen (incl. dubbelsprong)
    if (it.jump) {
      if (f.onGround || f.coyote > 0) {
        f.vel.y = JUMP_V; f.onGround = false; f.coyote = 0; f.jumps = 1;
        f.character.jump(false);
        this.effects.burst(f.pos, 5, { speed: 2.5, colors: FX_COLORS.dust, up: 1, life: 0.35, size: 1.2, grav: 2 });
      } else if (f.jumps < 2) {
        f.vel.y = DOUBLE_JUMP_V; f.jumps = 2;
        f.character.jump(true);
        this.effects.ring(f.pos.clone(), { color: 0xffffff, size: 1.6, life: 0.3 });
      }
      this.audio?.play('jump', f);
    }

    // dash
    if (it.dash && f.dashCd <= 0) {
      f.dashCd = DASH.cooldown;
      f.dashT = DASH.time;
      f.dashDir.copy(wish.lengthSq() > 0.01 ? wish.normalize() : f.forward);
      this.effects.ring(f.pos.clone().setY(f.pos.y + 0.9), { color: f.skin.accent, size: 1.8, life: 0.25, normal: f.dashDir });
      this.audio?.play('dash', f);
    }

    // special: Sprongstoot
    if (it.special && f.specialCd <= 0) this.special(f);

    // herladen & vuren
    const w = WEAPONS[f.weapon];
    if (it.reload && f.reloadT <= 0 && f.ammo[f.weapon] < w.mag) f.reloadT = w.reload;
    if (f.reloadT > 0) {
      f.reloadT -= dt;
      if (f.reloadT <= 0) f.ammo[f.weapon] = w.mag;
    } else if (it.fire && f.fireCd <= 0) {
      this.fire(f, w);
    }

    // zwaartekracht & integratie
    f.vel.y -= GRAVITY * dt;
    if (f.vel.y < -40) f.vel.y = -40;
    const prevY = f.pos.y;
    const vyBefore = f.vel.y;
    f.pos.x += f.vel.x * dt;
    f.pos.z += f.vel.z * dt;
    this.world.resolveHorizontal(f.pos, RADIUS, HEIGHT);
    f.pos.y += f.vel.y * dt;

    if (f.vel.y > 0) {
      const ceil = this.world.ceiling(f.pos.x, f.pos.z, prevY, HEIGHT, RADIUS);
      if (f.pos.y > ceil) { f.pos.y = ceil; f.vel.y = 0; }
    }
    const ground = this.world.groundHeight(f.pos.x, f.pos.z, Math.max(prevY, f.pos.y), RADIUS * 0.4);
    const wasGround = f.onGround;
    if (f.vel.y <= 0 && f.pos.y <= ground + (wasGround ? 0.25 : 0.001)) {
      f.pos.y = ground;
      if (!wasGround) {
        f.character.land(-vyBefore);
        if (vyBefore < -14) this.effects.burst(f.pos, 7, { speed: 3, colors: FX_COLORS.dust, up: 1, life: 0.35, size: 1.3, grav: 3 });
      }
      f.vel.y = 0;
      f.onGround = true;
      f.jumps = 0;
      f.coyote = 0.1;
    } else {
      f.onGround = false;
      f.coyote = Math.max(0, f.coyote - dt);
    }

    // zones: water & springplatforms
    const zone = f.onGround ? this.world.zoneAt(f.pos.x, f.pos.z, f.pos.y) : null;
    f.inWater = zone?.type === 'water';
    if (zone?.type === 'jumppad') {
      f.vel.y = zone.power; f.onGround = false; f.jumps = 1;
      f.character.jump(false);
      this.effects.ring(f.pos.clone().setY(f.pos.y + 0.1), { color: 0xffc83d, size: 2.4, life: 0.35 });
      this.effects.burst(f.pos, 10, { speed: 4, colors: [0xffc83d, 0xffffff], up: 6, life: 0.5 });
      this.audio?.play('pad', f);
    }
    if (f.inWater && f.speed > 2) {
      f.splashT -= dt;
      if (f.splashT <= 0) {
        f.splashT = 0.08;
        this.effects.burst(f.pos.clone().setY(f.pos.y + 0.1), 3, { speed: 2.5, colors: FX_COLORS.splash, up: 4, life: 0.4, size: 0.8 });
      }
    }

    // uit de arena gevallen
    if (f.pos.y < this.arena.killY) {
      this.effects.burst(new THREE.Vector3(f.pos.x, this.arena.killY + 0.8, f.pos.z), 22, { speed: 5, colors: FX_COLORS.splash, up: 9, life: 0.8, size: 1.2 });
      const killer = f.lastAttacker && this.time - f.lastAttackT < 6 ? f.lastAttacker : null;
      this.ko(f, killer, 'fall');
    }
  }

  // Richten: speler mikt via het camera-midden, bots via hun brein.
  aimPoint(f) {
    if (!f.isPlayer) return f.brain.aimPoint();
    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    // start voorbij het personage om zelf-treffers te vermijden
    const startT = origin.distanceTo(f.chest) * 0.9;
    let best = 120;
    const wh = this.world.raycast(origin.clone().addScaledVector(dir, startT), dir, 120);
    if (wh) best = wh.t + startT;
    for (const o of this.fighters) {
      if (o === f || !o.alive) continue;
      for (const cy of [0.75, 1.5]) {
        const t = segSphere(origin, dir, best, new THREE.Vector3(o.pos.x, o.pos.y + cy, o.pos.z), 0.6);
        if (t !== null && t > startT && t < best) best = t;
      }
    }
    return origin.addScaledVector(dir, best);
  }

  fire(f, w) {
    if (f.ammo[f.weapon] <= 0) { f.reloadT = w.reload; return; }
    f.fireCd = 1 / w.fireRate;
    f.ammo[f.weapon]--;
    f.character.root.updateMatrixWorld(true);
    let muzzle = f.character.getMuzzle(new THREE.Vector3());
    const chest = f.chest;
    const toM = muzzle.clone().sub(chest);
    if (this.world.raycast(chest, toM.clone().normalize(), toM.length())) muzzle = chest;
    const target = this.aimPoint(f);
    const dir = target.sub(muzzle).normalize();
    if (w.spread) {
      dir.x += (Math.random() - 0.5) * w.spread * 2;
      dir.y += (Math.random() - 0.5) * w.spread * 2;
      dir.z += (Math.random() - 0.5) * w.spread * 2;
      dir.normalize();
    }
    this.projectiles.fire(w, f, muzzle, dir);
    f.character.fire(w.id === 'rocket' ? 2.5 : w.id === 'bouncer' ? 1.6 : 0.6);
    if (f.ammo[f.weapon] <= 0) f.reloadT = w.reload;
    if (f.isPlayer) {
      this.shake = Math.max(this.shake, w.id === 'rocket' ? 0.12 : w.id === 'bouncer' ? 0.06 : 0.015);
      this.hud.onFire();
    }
    this.audio?.play('fire_' + w.id, f);
  }

  special(f) {
    f.specialCd = SPECIAL.cooldown;
    f.vel.y = SPECIAL.launch;
    f.onGround = false;
    f.jumps = 2;
    f.character.jump(true);
    const at = f.pos.clone().setY(f.pos.y + 0.15);
    this.effects.ring(at, { color: 0x8b5cf6, size: SPECIAL.radius * 1.1, life: 0.45 });
    this.effects.ring(at.clone().setY(at.y + 0.3), { color: 0xc4a8ff, size: SPECIAL.radius * 0.8, life: 0.35 });
    this.effects.flash(at, { color: 0x8b5cf6, size: 1.6, life: 0.2 });
    this.effects.burst(at, 30, { speed: 9, colors: FX_COLORS.special, up: 3, life: 0.6, size: 1.2, grav: 10, flat: true });
    for (const o of this.fighters) {
      if (o === f || !o.alive) continue;
      const d = o.pos.distanceTo(f.pos);
      if (d < SPECIAL.radius) {
        const dir = o.pos.clone().sub(f.pos).setY(0).normalize();
        this.damage(o, SPECIAL.damage, f, { dir, knock: SPECIAL.knock, up: 9, special: true });
      }
    }
    if (f.isPlayer || f.pos.distanceTo(this.player.pos) < 10) this.shake = Math.max(this.shake, 0.2);
    this.audio?.play('special', f);
  }

  explode(pos, w, owner, direct) {
    this.effects.explosion(pos, w.splash, w.colors);
    const dPlayer = pos.distanceTo(this.player.pos);
    if (dPlayer < 14) this.shake = Math.max(this.shake, (w.shake || 0.25) * (1 - dPlayer / 14));
    for (const o of this.fighters) {
      if (!o.alive) continue;
      const c = o.pos.clone(); c.y += 0.9;
      const d = c.distanceTo(pos);
      if (o === direct) {
        this.damage(o, w.damage + w.splashDamage * 0.5, owner, { dir: c.clone().sub(pos).normalize(), knock: w.knock, up: 5, weapon: w, direct: true });
      } else if (d < w.splash + 0.4) {
        const fall = 1 - Math.min(1, d / (w.splash + 0.4)) * 0.6;
        const self = o === owner;
        const dmg = w.splashDamage * fall * (self ? 0.3 : 1);
        const dir = c.clone().sub(pos).normalize();
        this.damage(o, dmg, owner, { dir, knock: w.knock * fall * (self ? 1.1 : 1), up: 6 * fall, weapon: w, self });
      }
    }
    this.audio?.play('boom', { pos });
  }

  damage(target, amount, attacker, { head = false, dir = null, knock = 0, up = 1, self = false, weapon = null, special = false } = {}) {
    if (!target.alive || target.invuln > 0 || this.over) return;
    amount = Math.round(amount);
    if (dir && knock) {
      target.vel.addScaledVector(dir.clone().setY(0).normalize(), knock);
      target.vel.y = Math.max(target.vel.y, up + (dir.y > 0 ? dir.y * knock * 0.4 : 0));
      if (up > 2) target.onGround = false;
    }
    if (amount <= 0) return;
    target.hp -= amount;
    target.character.hit(Math.min(1.5, amount / 30));
    if (!self && attacker) {
      target.lastAttacker = attacker;
      target.lastAttackT = this.time;
      attacker.damageDealt += amount;
      target.lastHitWeapon = special ? 'special' : weapon?.id || 'blaster';
      if (attacker.isPlayer) { this.stats.damage += amount; if (head) this.stats.headshots++; }
    }
    const hitPos = target.pos.clone(); hitPos.y += head ? 2.1 : 1.6;
    if (attacker?.isPlayer && !self) {
      this.hud.damageNumber(hitPos, amount, head);
      this.hud.hitmarker(head);
      this.audio?.play('hit');
    }
    if (target.isPlayer) {
      this.hud.hurt(amount, attacker && !self ? attacker.pos : null);
      this.shake = Math.max(this.shake, Math.min(0.25, amount / 120));
    }
    this.effects.burst(hitPos.clone().setY(hitPos.y - 0.6), Math.min(10, 3 + amount / 6), { speed: 4, colors: [0xffffff, target.skin.body], up: 3, life: 0.35, size: 0.8 });
    if (target.hp <= 0) this.ko(target, self ? (target.lastAttacker || null) : attacker, 'hit');
  }

  ko(f, killer, cause) {
    if (!f.alive) return;
    f.alive = false;
    f.hp = 0;
    f.deaths++;
    f.streak = 0;
    f.respawnT = MATCH_RULES.respawn;
    f.dashT = 0;
    f.character.pop();
    const at = f.pos.clone(); at.y = Math.max(at.y, this.arena.killY + 1) + 1;
    this.effects.burst(at, 34, { speed: 8, colors: FX_COLORS.ko, up: 5, life: 1.0, size: 1.3, grav: 12, flat: true });
    this.effects.flash(at, { color: 0xffffff, size: 1.6, life: 0.2 });
    this.effects.ring(at, { color: f.skin.body, size: 3, life: 0.4, normal: new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.camYaw) });
    if (killer && killer !== f) {
      killer.kills++;
      killer.streak++;
      if (killer.isPlayer) this.playerKo(f, cause);
    }
    this.hud.killFeed(killer && killer !== f ? killer : null, f, cause);
    if (f.isPlayer) {
      this.nemesis = killer && killer !== f ? killer : this.nemesis;
      this.hud.playerDown(killer && killer !== f ? killer : null, MATCH_RULES.respawn);
    }
  }

  // Directe beloning per KO: XP-popups, multi-KO's, wraak en streaks
  playerKo(victim, cause) {
    const st = this.stats, p = this.player;
    st.kills++;
    st.killsBy[victim.lastHitWeapon || 'blaster']++;
    st.maxStreak = Math.max(st.maxStreak, p.streak);
    this.multi = this.time - this.lastKoT < 4 ? this.multi + 1 : 1;
    this.lastKoT = this.time;
    st.bestMulti = Math.max(st.bestMulti, this.multi);
    const pops = [['KO', 15]];
    if (cause === 'fall') { st.ringOuts++; pops.push(['Uit de arena!', 10]); }
    if (victim.lastHitWeapon === 'special') pops.push(['Sprongstoot-KO', 10]);
    if (this.multi >= 2) pops.push([['', '', 'Dubbel-KO', 'Driedubbel-KO', 'Viervoudig-KO'][Math.min(this.multi, 4)] || 'Multi-KO', 10 * this.multi]);
    if (victim === this.nemesis) { st.revenge++; pops.push(['Wraak!', 10]); this.nemesis = null; }
    if (p.streak === 3 || p.streak === 5 || p.streak === 8) pops.push([`Reeks van ${p.streak}`, 5 * p.streak]);
    pops.forEach(([label, xp], i) => setTimeout(() => this.hud.xpPop(label, xp), i * 180));
    this.bonusXp = (this.bonusXp || 0) + pops.slice(1).reduce((a, [, xp]) => a + xp, 0);
    this.hud.koBanner(victim, p.streak, this.multi);
    this.audio?.play('ko');
  }

  updatePickups(dt) {
    for (const p of this.pickups) {
      if (!p.active) {
        p.timer -= dt;
        if (p.timer <= 0) { p.active = true; p.orb.visible = p.cross.visible = true; this.effects.ring(p.pos.clone().setY(p.pos.y + 0.15), { color: 0x2ee6a8, size: 1.5, life: 0.4 }); }
        continue;
      }
      const bob = Math.sin(this.time * 2.5 + p.pos.x) * 0.15;
      p.orb.position.y = 1.0 + bob; p.cross.position.y = 1.0 + bob;
      p.orb.rotation.y += dt * 1.2;
      p.cross.rotation.y = this.time * 2;
      for (const f of this.fighters) {
        if (!f.alive || f.hp >= MATCH_RULES.maxHp) continue;
        if (f.pos.distanceTo(p.pos) < 1.3) {
          f.hp = Math.min(MATCH_RULES.maxHp, f.hp + 45);
          p.active = false; p.timer = 14;
          p.orb.visible = p.cross.visible = false;
          this.effects.burst(p.pos.clone().setY(p.pos.y + 1), 16, { speed: 3, colors: FX_COLORS.heal, up: 5, life: 0.7, grav: -2 });
          this.effects.ring(p.pos.clone().setY(p.pos.y + 0.15), { color: 0x2ee6a8, size: 2.2, life: 0.4 });
          if (f.isPlayer) { this.stats.pickups++; this.hud.healed(); this.audio?.play('heal'); }
          break;
        }
      }
    }
  }

  updateCamera(dt) {
    const p = this.player;
    const cam = this.camera;
    const target = new THREE.Vector3(p.pos.x, p.pos.y + 1.75, p.pos.z);
    const fwd = new THREE.Vector3(Math.sin(this.camYaw) * Math.cos(this.camPitch), -Math.sin(this.camPitch), Math.cos(this.camYaw) * Math.cos(this.camPitch));
    const right = new THREE.Vector3(-Math.cos(this.camYaw), 0, Math.sin(this.camYaw));
    const shoulder = target.clone().addScaledVector(right, 0.85);
    let dist = 5.2;
    const back = fwd.clone().negate();
    const hit = this.world.raycast(shoulder, back, dist + 0.3);
    if (hit) dist = Math.max(0.8, hit.t - 0.3);
    const desired = shoulder.clone().addScaledVector(back, dist);
    // houd camera boven de grond
    const g = this.world.groundHeight(desired.x, desired.z, desired.y);
    if (desired.y < g + 0.4) desired.y = g + 0.4;
    if (this.camPos.lengthSq() === 0) this.camPos.copy(desired);
    this.camPos.lerp(desired, Math.min(1, dt * 22));
    cam.position.copy(this.camPos);
    cam.lookAt(this.camPos.clone().add(fwd));
    // personage verbergen als de camera er (tegen een muur) bijna in zit
    this.hidePlayer = this.camPos.distanceTo(target) < 1.4;
    if (this.shake > 0) {
      const s = this.shake * (this.settings.screenShake ? 1 : 0);
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
      cam.rotation.z += (Math.random() - 0.5) * s * 0.08;
      this.shake = Math.max(0, this.shake - dt * 1.2);
    }
    const targetFov = p.dashT > 0 ? 80 : 72;
    cam.fov += (targetFov - cam.fov) * Math.min(1, dt * 10);
    cam.updateProjectionMatrix();
  }

  standings() {
    return [...this.fighters].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths || b.damageDealt - a.damageDealt);
  }

  finish() {
    this.over = true;
    this.onFinish?.(this.standings());
  }

  dispose() {
    for (const f of this.fighters) { this.scene.remove(f.character.root); f.character.dispose(); }
    for (const p of this.pickups) this.scene.remove(p.group);
    this.projectiles.clear();
    this.effects.dispose();
  }
}
