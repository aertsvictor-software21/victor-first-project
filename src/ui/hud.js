import * as THREE from 'three';
import { WEAPONS, WEAPON_ORDER, SPECIAL, DASH } from '../game/weapons.js';

const $ = (s, r = document) => r.querySelector(s);
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

// In-game HUD (DOM): licht, scherp en goed leesbaar.
export class Hud {
  constructor(root, camera) {
    this.root = root;
    this.camera = camera;
    this.match = null;
    this.tags = new Map();
    this.nums = [];
    root.innerHTML = `
      <div class="hud-top">
        <div class="killfeed" id="killfeed"></div>
        <div class="timer-card">
          <div class="timer" id="timer">3:00</div>
          <div class="goal" id="goal"></div>
        </div>
        <div class="mini-board" id="miniBoard"></div>
      </div>
      <div class="crosshair" id="crosshair"><i></i><i></i><i></i><i></i><span class="dot"></span>
        <div class="hitmarker" id="hitmarker"><i></i><i></i><i></i><i></i></div></div>
      <div class="ko-banner" id="koBanner"></div>
      <div class="xp-pops" id="xpPops"></div>
      <div class="toasts" id="toasts"></div>
      <div class="down-card" id="downCard"></div>
      <div class="hurt" id="hurt"></div>
      <div class="hurt-dir" id="hurtDir"></div>
      <div class="hud-bottom">
        <div class="vitals">
          <div class="portrait" id="portrait"></div>
          <div class="hp-wrap">
            <div class="hp-label"><span id="pname">Speler</span><b id="hpText">100</b></div>
            <div class="hp-bar"><div class="hp-ghost" id="hpGhost"></div><div class="hp-fill" id="hpFill"></div></div>
          </div>
        </div>
        <div class="weapons" id="weapons">
          ${WEAPON_ORDER.map((id) => `<div class="wslot" data-w="${id}"><kbd>${WEAPONS[id].key}</kbd><span class="wicon w-${id}">${WEAPONS[id].icon}</span><div class="wname">${WEAPONS[id].name}</div><div class="ammo"><b></b><span></span></div><div class="reload"></div></div>`).join('')}
        </div>
        <div class="abilities">
          <div class="ability" id="abDash"><div class="sweep"></div><span>⇢</span><kbd>Shift</kbd><em>Dash</em></div>
          <div class="ability special" id="abSpecial"><div class="sweep"></div><span>✦</span><kbd>E</kbd><em>${SPECIAL.name}</em></div>
        </div>
      </div>
      <div class="scoreboard" id="scoreboard"></div>
      <div class="tags" id="tags"></div>
      <div class="nums" id="nums"></div>
      <div class="fps" id="fps"></div>
      <div class="pause" id="pause">
        <div class="pause-card">
          <h2>Gepauzeerd</h2>
          <p>Klik om verder te spelen</p>
          <div class="row"><button class="btn primary" id="resumeBtn">Verder spelen</button><button class="btn ghost" id="quitBtn">Match verlaten</button></div>
          <div class="controls-hint">
            <span><kbd>WASD</kbd> bewegen</span><span><kbd>Muis</kbd> richten / schieten</span><span><kbd>Spatie</kbd> (dubbel)sprong</span>
            <span><kbd>Shift</kbd> dash</span><span><kbd>E</kbd> Sprongstoot</span><span><kbd>1-3</kbd> wapens</span><span><kbd>R</kbd> herladen</span><span><kbd>Tab</kbd> scorebord</span>
          </div>
        </div>
      </div>`;
    this.el = {
      timer: $('#timer', root), mini: $('#miniBoard', root), feed: $('#killfeed', root),
      hpFill: $('#hpFill', root), hpGhost: $('#hpGhost', root), hpText: $('#hpText', root), pname: $('#pname', root), portrait: $('#portrait', root),
      weapons: $('#weapons', root), dash: $('#abDash', root), special: $('#abSpecial', root),
      cross: $('#crosshair', root), hitmarker: $('#hitmarker', root), ko: $('#koBanner', root), down: $('#downCard', root),
      hurt: $('#hurt', root), hurtDir: $('#hurtDir', root), board: $('#scoreboard', root), tags: $('#tags', root), nums: $('#nums', root),
      fps: $('#fps', root), pause: $('#pause', root), goal: $('#goal', root), pops: $('#xpPops', root), toasts: $('#toasts', root),
    };
    this.ghostHp = 100;
    this.hurtV = 0;
    this.lastMini = '';
  }

  bind(match) {
    this.match = match;
    this.el.feed.innerHTML = '';
    this.el.tags.innerHTML = '';
    this.tags.clear();
    const p = match.player;
    this.el.pname.textContent = p.name;
    this.el.goal.innerHTML = `Eerste tot <b>${match.rules.scoreLimit}</b> KO's`;
    this.el.pops.innerHTML = '';
    this.el.portrait.style.background = `radial-gradient(circle at 35% 30%, #fff8 0 18%, transparent 19%), ${hex(p.skin.body)}`;
    this.el.portrait.style.borderColor = hex(p.skin.accent);
    for (const f of match.fighters) {
      if (f.isPlayer) continue;
      const t = document.createElement('div');
      t.className = 'tag';
      t.innerHTML = `<span>${f.name}</span><div class="tag-hp"><i></i></div>`;
      this.el.tags.appendChild(t);
      this.tags.set(f, t);
    }
    this.ghostHp = 100;
    this.el.down.classList.remove('show');
    this.el.ko.classList.remove('show');
    this.el.hurt.style.opacity = 0;
  }

  setVisible(v) { this.root.classList.toggle('show', v); }
  setPaused(v) { this.el.pause.classList.toggle('show', v); }

  update(dt, input, fps) {
    const m = this.match; if (!m) return;
    const p = m.player;
    // timer
    const s = Math.ceil(m.remaining);
    this.el.timer.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    this.el.timer.classList.toggle('urgent', s <= 30);

    // health
    const hp = Math.max(0, p.hp);
    this.el.hpFill.style.width = hp + '%';
    this.el.hpFill.classList.toggle('low', hp <= 35);
    this.ghostHp += (hp - this.ghostHp) * Math.min(1, dt * 3);
    if (this.ghostHp < hp) this.ghostHp = hp;
    this.el.hpGhost.style.width = this.ghostHp + '%';
    this.el.hpText.textContent = Math.ceil(hp);

    // wapens
    for (const slot of this.el.weapons.children) {
      const id = slot.dataset.w, w = WEAPONS[id];
      slot.classList.toggle('active', p.weapon === id);
      slot.querySelector('.ammo b').textContent = p.ammo[id];
      slot.querySelector('.ammo span').textContent = '/' + w.mag;
      const rl = slot.querySelector('.reload');
      rl.style.transform = p.weapon === id && p.reloadT > 0 ? `scaleX(${1 - p.reloadT / w.reload})` : 'scaleX(0)';
    }
    // abilities
    this.cool(this.el.dash, p.dashCd / DASH.cooldown);
    this.cool(this.el.special, p.specialCd / SPECIAL.cooldown);

    // crosshair spreiding
    this.el.cross.style.setProperty('--gap', `${6 + Math.min(8, p.speed * 0.6) + (p.fireCd > 0 ? 3 : 0)}px`);
    this.el.cross.classList.toggle('hidden', !p.alive);

    // pijn-vignet
    this.hurtV = Math.max(hp <= 30 ? 0.35 + Math.sin(m.time * 6) * 0.1 : 0, this.hurtV - dt * 1.8);
    this.el.hurt.style.opacity = this.hurtV;

    // mini-ranglijst
    const st = m.standings();
    const key = st.map((f) => f.id + f.kills).join();
    if (key !== this.lastMini) {
      this.lastMini = key;
      const top = st.slice(0, 4);
      if (!top.includes(p)) top.push(p);
      this.el.mini.innerHTML = top.map((f) => `<div class="mini-row ${f.isPlayer ? 'you' : ''}"><b>${st.indexOf(f) + 1}</b><i style="background:${hex(f.skin.body)}"></i><span>${f.name}</span><em>${f.kills}</em></div>`).join('');
    }

    // naamlabels boven bots
    const v = new THREE.Vector3();
    const w = innerWidth, h = innerHeight;
    for (const [f, tag] of this.tags) {
      v.set(f.pos.x, f.pos.y + 2.55, f.pos.z).project(this.camera);
      const dist = f.pos.distanceTo(p.pos);
      const show = f.alive && v.z < 1 && dist < 40 && f.character.popT < 0;
      tag.style.display = show ? '' : 'none';
      if (!show) continue;
      const sc = THREE.MathUtils.clamp(1.25 - dist / 40, 0.6, 1.05);
      tag.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%, -100%) scale(${sc})`;
      tag.querySelector('i').style.width = Math.max(0, f.hp) + '%';
    }

    // schadecijfers
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i];
      n.t += dt;
      if (n.t > 0.8) { n.el.remove(); this.nums.splice(i, 1); continue; }
      v.copy(n.pos).project(this.camera);
      const k = n.t / 0.8;
      const pop = k < 0.15 ? 0.6 + k / 0.15 * 0.7 : 1.3 - Math.min(0.3, (k - 0.15) * 1.2);
      n.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w + n.dx * k}px, ${(-v.y * 0.5 + 0.5) * h - k * 50}px) translate(-50%,-50%) scale(${pop})`;
      n.el.style.opacity = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
      n.el.style.display = v.z < 1 ? '' : 'none';
    }

    // scorebord (Tab)
    const showBoard = input.down('Tab') && !m.over;
    this.el.board.classList.toggle('show', showBoard);
    if (showBoard) this.renderBoard(this.el.board, st, false);

    this.el.fps.textContent = fps ? `${fps} FPS` : '';
  }

  cool(el, k) {
    el.classList.toggle('ready', k <= 0);
    el.querySelector('.sweep').style.background = k > 0 ? `conic-gradient(rgba(27,35,64,.55) ${k * 360}deg, transparent 0)` : 'transparent';
  }

  renderBoard(el, st, final) {
    el.innerHTML = `<div class="board-card">
      <h3>${final ? 'Eindstand' : 'Scorebord'}</h3>
      <table><thead><tr><th>#</th><th>Speler</th><th>KO</th><th>Uit</th><th>Schade</th></tr></thead><tbody>
      ${st.map((f, i) => `<tr class="${f.isPlayer ? 'you' : ''} ${i < 3 ? 'p' + (i + 1) : ''}"><td><span class="pos">${i + 1}</span></td><td><i style="background:${hex(f.skin.body)}"></i>${f.name}</td><td><b>${f.kills}</b></td><td>${f.deaths}</td><td>${f.damageDealt}</td></tr>`).join('')}
      </tbody></table></div>`;
  }

  // ---- gebeurtenissen ----
  onFire() {
    this.el.cross.classList.remove('kick'); void this.el.cross.offsetWidth; this.el.cross.classList.add('kick');
  }

  hitmarker(head) {
    const h = this.el.hitmarker;
    h.classList.remove('show', 'head'); void h.offsetWidth;
    h.classList.add('show'); if (head) h.classList.add('head');
  }

  damageNumber(pos, amount, head) {
    const el = document.createElement('div');
    el.className = 'dmg' + (head ? ' crit' : '') + (amount >= 40 ? ' big' : '');
    el.textContent = amount;
    this.el.nums.appendChild(el);
    this.nums.push({ el, pos: pos.clone(), t: 0, dx: (Math.random() - 0.5) * 50 });
    if (this.nums.length > 24) { this.nums[0].el.remove(); this.nums.shift(); }
  }

  hurt(amount, fromPos) {
    this.hurtV = Math.min(0.9, this.hurtV + amount / 50);
    if (fromPos && this.match) {
      const p = this.match.player;
      const a = Math.atan2(fromPos.x - p.pos.x, fromPos.z - p.pos.z) - this.match.camYaw;
      const d = this.el.hurtDir;
      d.style.transform = `translate(-50%,-50%) rotate(${-a}rad)`;
      d.classList.remove('show'); void d.offsetWidth; d.classList.add('show');
    }
  }

  healed() {
    this.el.hpFill.classList.remove('heal'); void this.el.hpFill.offsetWidth; this.el.hpFill.classList.add('heal');
  }

  koBanner(victim, streak, multi = 1) {
    const labels = { 2: 'Reeks van 2', 3: 'Op dreef!', 4: 'Niet te stoppen!', 5: 'Legendarisch!' };
    const titles = { 2: 'DUBBEL!', 3: 'DRIEDUBBEL!', 4: 'VIERVOUDIG!' };
    const k = this.el.ko;
    k.innerHTML = `<div class="ko-title ${multi > 1 ? 'multi' : ''}">${titles[Math.min(multi, 4)] || 'KO!'}</div><div class="ko-sub">Je raakte <b style="color:${hex(victim.skin.body)}">${victim.name}</b>${streak > 1 ? ` · <span class="streak">${labels[Math.min(streak, 5)]}</span>` : ''}</div>`;
    k.classList.remove('show'); void k.offsetWidth; k.classList.add('show');
  }

  // "+15 XP"-popjes rechts van het vizier
  xpPop(label, xp) {
    const el = document.createElement('div');
    el.className = 'xp-pop';
    el.innerHTML = `<b>+${xp}</b> ${label}`;
    this.el.pops.appendChild(el);
    setTimeout(() => el.remove(), 1600);
    while (this.el.pops.children.length > 5) this.el.pops.firstChild.remove();
  }

  // Toast voor voltooide uitdagingen / prestaties tijdens de match
  toast(title, text, kind = 'challenge') {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.innerHTML = `<div class="toast-icon">${kind === 'challenge' ? '✔' : '★'}</div><div><b>${title}</b><span>${text}</span></div>`;
    this.el.toasts.appendChild(el);
    setTimeout(() => el.classList.add('out'), 3200);
    setTimeout(() => el.remove(), 3700);
  }

  playerDown(killer, t) {
    const d = this.el.down;
    d.innerHTML = `<div class="down-title">Uitgeschakeld</div><div class="down-sub">${killer ? `door <b style="color:${hex(killer.skin.body)}">${killer.name}</b>` : 'Uit de arena gevallen'}</div><div class="down-timer">Terug over <b id="respawnT">${t.toFixed(1)}</b>s</div>`;
    d.classList.add('show');
    clearInterval(this.downTimer);
    const start = performance.now();
    this.downTimer = setInterval(() => {
      const left = Math.max(0, t - (performance.now() - start) / 1000);
      const el = $('#respawnT', d); if (el) el.textContent = left.toFixed(1);
      if (left <= 0) { clearInterval(this.downTimer); d.classList.remove('show'); }
    }, 100);
  }

  killFeed(killer, victim, cause) {
    const row = document.createElement('div');
    row.className = 'feed-row' + (killer?.isPlayer || victim.isPlayer ? ' mine' : '');
    const name = (f) => `<b style="color:${hex(f.skin.body)}">${f.name}</b>`;
    row.innerHTML = killer
      ? `${name(killer)}<span class="feed-icon ${cause === 'fall' ? 'fall' : ''}">${cause === 'fall' ? '⤓' : '✦'}</span>${name(victim)}`
      : `${name(victim)}<span class="feed-icon fall">⤓</span><span class="muted">viel eraf</span>`;
    this.el.feed.prepend(row);
    while (this.el.feed.children.length > 5) this.el.feed.lastChild.remove();
    setTimeout(() => row.classList.add('fade'), 4500);
    setTimeout(() => row.remove(), 5200);
  }

  clear() {
    for (const n of this.nums) n.el.remove();
    this.nums.length = 0;
    clearInterval(this.downTimer);
    this.el.board.classList.remove('show');
  }
}
