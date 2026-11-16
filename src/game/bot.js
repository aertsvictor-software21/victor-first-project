import * as THREE from 'three';
import { WEAPONS } from './weapons.js';

export const DIFFICULTY = {
  easy:   { label: 'Ontspannen', reaction: 0.55, error: 0.09, lead: 0.3, burst: 0.55, strafe: 0.6 },
  normal: { label: 'Uitdagend',  reaction: 0.32, error: 0.05, lead: 0.7, burst: 0.75, strafe: 0.85 },
  hard:   { label: 'Fel',        reaction: 0.18, error: 0.025, lead: 0.95, burst: 0.92, strafe: 1 },
};

// Eenvoudige maar levendige bot-AI: kiest doelwit, houdt afstand per wapen,
// strafet, springt, ontwijkt randen en haalt health op wanneer nodig.
export class BotBrain {
  constructor(fighter, match, difficulty = 'normal') {
    this.f = fighter;
    this.m = match;
    this.d = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    this.target = null;
    this.retarget = 0;
    this.strafeDir = Math.random() < 0.5 ? 1 : -1;
    this.strafeT = 0;
    this.seenT = 0;
    this.wander = new THREE.Vector3();
    this.wanderT = 0;
    this.stuckT = 0;
    this.aimErr = new THREE.Vector3();
    this.aimErrT = 0;
    this.burstT = 0;
    this.goal = null;
  }

  los(a, b) {
    const dir = b.clone().sub(a);
    const len = dir.length();
    return !this.m.world.raycast(a, dir.divideScalar(len), len);
  }

  think(dt) {
    const f = this.f, m = this.m, it = f.intent;
    it.jump = it.dash = it.special = it.reload = false;
    it.weapon = null;

    // doelwit kiezen
    this.retarget -= dt;
    if (this.retarget <= 0 || !this.target?.alive) {
      this.retarget = 1 + Math.random();
      let best = null, bestS = Infinity;
      for (const o of m.fighters) {
        if (o === f || !o.alive) continue;
        const d = o.pos.distanceTo(f.pos);
        const s = d - (this.los(f.chest, o.chest) ? 12 : 0) - (o === f.lastAttacker ? 8 : 0) + (o.invuln > 0 ? 10 : 0);
        if (s < bestS) { bestS = s; best = o; }
      }
      this.target = best;
    }

    const t = this.target;
    const toT = t ? t.pos.clone().sub(f.pos) : null;
    const dist = toT ? toT.length() : Infinity;
    const visible = t && dist < 45 && this.los(f.chest, t.chest);
    this.seenT = visible ? this.seenT + dt : 0;

    // wapenkeuze per afstand
    if (t && Math.random() < dt * 0.6) {
      const want = dist < 9 ? 'bouncer' : dist > 15 ? (Math.random() < 0.5 ? 'rocket' : 'blaster') : (Math.random() < 0.6 ? 'blaster' : 'rocket');
      if (want !== f.weapon) it.weapon = want;
    }

    // doel van beweging
    let goal = null;
    const lowHp = f.hp < 45;
    if (lowHp) {
      let bp = null, bd = Infinity;
      for (const p of m.pickups) if (p.active) { const d = p.pos.distanceTo(f.pos); if (d < bd) { bd = d; bp = p; } }
      if (bp && bd < 30) goal = bp.pos;
    }

    let moveDir = new THREE.Vector3();
    if (goal) {
      moveDir.copy(goal).sub(f.pos).setY(0).normalize();
    } else if (t) {
      const ideal = WEAPONS[f.weapon].botRange;
      const flat = toT.clone().setY(0).normalize();
      const side = new THREE.Vector3(-flat.z, 0, flat.x).multiplyScalar(this.strafeDir * this.d.strafe);
      if (!visible) moveDir.copy(flat);
      else if (dist > ideal + 3) moveDir.copy(flat).add(side.multiplyScalar(0.5));
      else if (dist < ideal - 4) moveDir.copy(flat).negate().add(side);
      else moveDir.copy(side);
      this.strafeT -= dt;
      if (this.strafeT <= 0) { this.strafeT = 0.7 + Math.random() * 1.4; this.strafeDir *= -1; }
    } else {
      this.wanderT -= dt;
      if (this.wanderT <= 0) {
        this.wanderT = 2 + Math.random() * 2;
        const a = Math.random() * Math.PI * 2, r = Math.random() * m.arena.bounds * 0.6;
        this.wander.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      }
      moveDir.copy(this.wander).sub(f.pos).setY(0).normalize();
    }

    // randen vermijden
    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      const probe = f.pos.clone().addScaledVector(moveDir, 2.2);
      const g = m.world.groundHeight(probe.x, probe.z, f.pos.y + 0.2);
      if (g === -Infinity || g < f.pos.y - 3.5) {
        const toCenter = new THREE.Vector3(-f.pos.x, 0, -f.pos.z).normalize();
        moveDir.copy(toCenter).add(moveDir.multiplyScalar(-0.3)).normalize();
        this.strafeDir *= -1;
      }
    }

    // vastzitten? springen
    if (moveDir.lengthSq() > 0.1 && f.onGround && f.speed < 2) {
      this.stuckT += dt;
      if (this.stuckT > 0.25) { it.jump = true; this.stuckT = 0; }
    } else this.stuckT = 0;
    if (visible && f.onGround && Math.random() < dt * 0.6) it.jump = true;
    if (!f.onGround && f.vel.y < 0 && f.jumps === 1 && Math.random() < dt * 1.5) it.jump = true;

    // ontwijken / dash
    if (visible && f.dashCd <= 0 && f.hp < 70 && Math.random() < dt * 0.8) it.dash = true;
    if (t && dist < 4.5 && f.specialCd <= 0 && Math.random() < dt * 3) it.special = true;

    // omzetten naar lokale input (yaw = kijkrichting)
    const aim = this.aimPoint();
    const look = aim.clone().sub(f.chest);
    const targetYaw = Math.atan2(look.x, look.z);
    const targetPitch = -Math.atan2(look.y, Math.hypot(look.x, look.z));
    let dy = targetYaw - f.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    const turn = Math.min(1, dt * (6 + 8 * (1 - this.d.reaction)));
    f.yaw += dy * turn;
    f.pitch += (targetPitch - f.pitch) * turn;
    const fw = f.forward, rt = f.right;
    it.moveY = moveDir.dot(fw);
    it.moveX = moveDir.dot(rt);

    // vuren
    this.burstT -= dt;
    if (this.burstT <= 0) this.burstT = 0.4 + Math.random() * 0.8;
    const facing = Math.abs(dy) < 0.25;
    it.fire = visible && this.seenT > this.d.reaction && facing && this.burstT > 0.4 * (1 - this.d.burst);
    if (!visible && f.ammo[f.weapon] < WEAPONS[f.weapon].mag * 0.5 && Math.random() < dt) it.reload = true;
  }

  aimPoint() {
    const f = this.f, t = this.target;
    if (!t || !t.alive) return f.chest.add(f.forward.multiplyScalar(10));
    const w = WEAPONS[f.weapon];
    const aim = t.chest;
    const dist = aim.distanceTo(f.chest);
    const flight = dist / w.speed;
    aim.addScaledVector(t.vel.clone().setY(t.onGround ? 0 : t.vel.y * 0.5), flight * this.d.lead);
    if (w.gravity) aim.y += 0.5 * w.gravity * flight * flight - 3 * flight;
    if (w.splash) aim.y -= 0.7; // mik op de voeten voor splash
    this.aimErrT -= 1 / 60;
    if (this.aimErrT <= 0) {
      this.aimErrT = 0.35;
      this.aimErr.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2 * this.d.error * dist);
    }
    return aim.add(this.aimErr);
  }
}
