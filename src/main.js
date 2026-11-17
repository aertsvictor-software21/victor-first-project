import * as THREE from 'three';
import { ARENAS, getArena, buildArena } from './world/arenas.js';
import { SKINS, STREAK_SKIN, getSkin } from './style/skins.js';
import { Character } from './entities/character.js';
import { Match } from './game/match.js';
import { Input } from './game/input.js';
import { Hud } from './ui/hud.js';
import { Audio } from './game/audio.js';
import { DIFFICULTY } from './game/bot.js';
import { load, save, seasonBoard, rank } from './game/storage.js';
import { levelInfo, titleFor, dailyChallenges, challengeDef, matchStatValues, applyChallenges, ACHIEVEMENTS, streakStatus, STREAK_REWARDS } from './game/progression.js';

// Speelmodi: korte matches houden de "nog één potje"-drempel laag (ideaal voor een pauze).
const MODES = {
  flits: { label: 'Flitsmatch', duration: 90, scoreLimit: 10, meta: '6 spelers · 90 seconden · eerste tot 10 eliminaties' },
  standaard: { label: 'Standaard', duration: 180, scoreLimit: 15, meta: '6 spelers · 3 minuten · eerste tot 15 eliminaties' },
};

const $ = (s) => document.querySelector(s);
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

// ------------------------------------------------------------------
// Status & instellingen
// ------------------------------------------------------------------
const state = load();
state.daily = dailyChallenges(state.daily);
const QUALITY = {
  low:    { label: 'Laag',   pixelRatio: 0.75, shadows: false, shadowMap: 0,    particles: 120 },
  medium: { label: 'Midden', pixelRatio: 1,    shadows: true,  shadowMap: 1024, particles: 250 },
  high:   { label: 'Hoog',   pixelRatio: 2,    shadows: true,  shadowMap: 2048, particles: 400 },
};
const weakDevice = /CrOS/.test(navigator.userAgent) || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
const autoStart = weakDevice ? 'low' : 'medium';
let activeQuality = state.settings.quality === 'auto' ? autoStart : state.settings.quality;

// ------------------------------------------------------------------
// Renderer, scène, licht
// ------------------------------------------------------------------
const canvas = $('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: state.settings.quality !== 'low', powerPreference: 'high-performance' });
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 600);

const hemi = new THREE.HemisphereLight(0xcfeeff, 0x6bbf4e, 1.15);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe4b8, 3.0);
sun.position.set(36, 34, 16);
sun.shadow.camera.left = -38; sun.shadow.camera.right = 38;
sun.shadow.camera.top = 38; sun.shadow.camera.bottom = -38;
sun.shadow.camera.near = 5; sun.shadow.camera.far = 120;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

function applyQuality(q) {
  activeQuality = q;
  const Q = QUALITY[q];
  renderer.setPixelRatio(Math.min(devicePixelRatio, Q.pixelRatio));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.shadowMap.enabled = Q.shadows;
  sun.castShadow = Q.shadows;
  if (Q.shadows && sun.shadow.mapSize.x !== Q.shadowMap) {
    sun.shadow.mapSize.set(Q.shadowMap, Q.shadowMap);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
  }
  scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
}
applyQuality(activeQuality);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
});

// ------------------------------------------------------------------
// Arena laden
// ------------------------------------------------------------------
let arena = null;
function loadArena(id) {
  if (arena) {
    scene.remove(arena.group);
    arena.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
  const def = getArena(id);
  arena = buildArena(def, activeQuality);
  scene.add(arena.group);
  scene.fog = new THREE.Fog(def.sky.horizon, 70, 260);
  hemi.color.set(def.hemi[0]);
  hemi.groundColor.set(def.hemi[1]);
  sun.color.set(def.sun);
  if (preview) placePreview();
}

// ------------------------------------------------------------------
// Menu-showcase: geselecteerd personage in de arena
// ------------------------------------------------------------------
let preview = null;
let previewT = 0;
function setPreviewSkin(id) {
  if (preview) { scene.remove(preview.root); preview.dispose(); }
  preview = new Character(getSkin(id), { ringColor: 0xffc83d });
  preview.setWeapon(['blaster', 'bouncer', 'rocket'][Math.floor(Math.random() * 3)]);
  scene.add(preview.root);
  placePreview();
  preview.spawnIn();
  preview.jump(true);
  $('#previewName').textContent = getSkin(id).name;
}
function placePreview() {
  const p = arena.pickups[arena.pickups.length - 1];
  preview.root.position.copy(p);
  preview.root.visible = true;
}
function updateShowcase(dt, t) {
  if (!preview) return;
  previewT -= dt;
  if (previewT <= 0) {
    previewT = 2.5 + Math.random() * 2;
    if (Math.random() < 0.5) preview.jump(Math.random() < 0.5);
    else preview.fire(1.5);
  }
  const base = preview.root.position;
  preview.update(dt, { speed: 0, onGround: true, aimPitch: Math.sin(t * 0.7) * 0.1, t });
  // camera iets links van het personage, zodat het menu-paneel rechts vrij is
  const ang = t * 0.05 + 0.5;
  const wide = innerWidth > 1100;
  const camTarget = new THREE.Vector3(base.x, base.y + 1.1, base.z);
  const offset = new THREE.Vector3(Math.sin(ang) * 7, 2.6, Math.cos(ang) * 7);
  camera.position.copy(camTarget).add(offset);
  preview.root.rotation.y = ang + Math.sin(t * 0.5) * 0.35 - 0.25; // kijk richting camera
  const right = new THREE.Vector3(Math.cos(ang), 0, -Math.sin(ang));
  camera.lookAt(camTarget.clone().addScaledVector(right, wide ? 1.4 : 0).setY(camTarget.y + 0.3));
  camera.fov = 50;
  camera.updateProjectionMatrix();
}

// ------------------------------------------------------------------
// Systemen
// ------------------------------------------------------------------
const input = new Input(canvas);
const hud = new Hud($('#hud'), camera);
const audio = new Audio();
audio.setVolume(state.settings.volume);
let match = null;
let paused = false;

audio.listener = () => (match ? match.player.pos : new THREE.Vector3());

// ------------------------------------------------------------------
// Menu UI
// ------------------------------------------------------------------
function persist() { save(state); }

function show(screen) {
  for (const s of ['#menu', '#hud', '#results']) $(s).classList.toggle('show', s === screen);
}

function fadeThen(fn) {
  const f = $('#fade');
  f.classList.add('on');
  setTimeout(() => { fn(); requestAnimationFrame(() => f.classList.remove('on')); }, 300);
}

function renderProfile() {
  const p = state.profile, r = rank(p.rating), L = levelInfo(p.xp);
  $('#profileChip').innerHTML = `<div class="avatar" style="background:${hex(getSkin(p.skin).body)}"></div><div>${p.name} <span class="level-pill">Lv ${L.level}</span><small>${titleFor(L.level)} · ${p.rating} punten</small></div><span class="streak-chip" title="Dagreeks">🔥 ${state.streak.count}</span><span class="rank-badge" style="background:${r.color}">${r.name}</span>`;
  $('#profileChip').onclick = () => openDailyReward(true);
}

function renderDaily() {
  state.daily = dailyChallenges(state.daily);
  const done = state.daily.items.filter((i) => i.done).length;
  $('#daily').innerHTML = `<div class="daily-head"><b>Uitdagingen van vandaag</b><small>${done}/3 voltooid · nieuwe morgen</small></div>` +
    state.daily.items.map((it) => {
      const d = challengeDef(it.id);
      return `<div class="chal ${it.done ? 'done' : ''}"><span>${it.done ? '✔ ' : ''}${d.text}</span><em>+${d.xp} XP</em><div class="bar"><i style="width:${(it.value / d.target) * 100}%"></i></div></div>`;
    }).join('');
}

function renderArenaCards() {
  $('#arenaCards').innerHTML = ARENAS.map((a) => `
    <button class="arena-card ${a.id === state.settings.arena ? 'active' : ''}" data-id="${a.id}">
      <div class="thumb" style="background:linear-gradient(180deg, ${hex(a.sky.top)}, ${hex(a.sky.horizon)}); --c1:${a.swatch[0]}; --c3:${a.swatch[2]}"><i></i></div>
      <b>${a.name}</b><small>${a.tagline}</small>
    </button>`).join('');
  for (const b of $('#arenaCards').children) b.onclick = () => {
    audio.ensure(); audio.play('click');
    state.settings.arena = b.dataset.id; persist();
    renderArenaCards();
    fadeThen(() => loadArena(b.dataset.id));
  };
}

function segmented(el, options, current, onPick) {
  el.innerHTML = options.map(([v, l]) => `<button data-v="${v}" class="${v === current ? 'active' : ''}">${l}</button>`).join('');
  for (const b of el.children) b.onclick = () => {
    audio.ensure(); audio.play('click');
    for (const x of el.children) x.classList.toggle('active', x === b);
    onPick(b.dataset.v);
  };
}

function renderSkins() {
  const xp = state.profile.xp;
  const next = SKINS.find((s) => s.unlockXp > xp);
  const prev = [...SKINS].reverse().find((s) => s.unlockXp <= xp)?.unlockXp || 0;
  $('#xpFill').style.width = next ? `${((xp - prev) / (next.unlockXp - prev)) * 100}%` : '100%';
  $('#xpText').textContent = next ? `${xp} / ${next.unlockXp} XP — volgende: ${next.name}` : `${xp} XP — alles vrijgespeeld!`;
  $('#skinGrid').innerHTML = SKINS.map((s) => {
    const locked = s.unlockXp > xp;
    return `<button class="skin ${s.id === state.profile.skin ? 'active' : ''} ${locked ? 'locked' : ''}" data-id="${s.id}" ${locked ? 'disabled' : ''}>
      ${locked ? `<span class="lock">${s.unlockXp} XP</span>` : ''}
      <div class="blob" style="background:${hex(s.body)}"></div><b>${s.name}</b></button>`;
  }).join('') + (() => {
    const s = STREAK_SKIN, locked = !state.profile.streakSkin;
    return `<button class="skin streak ${s.id === state.profile.skin ? 'active' : ''} ${locked ? 'locked' : ''}" data-id="${s.id}" ${locked ? 'disabled' : ''}>
      ${locked ? `<span class="lock">🔥 ${s.streakDays} dagen</span>` : ''}
      <div class="blob" style="background:${hex(s.body)}"></div><b>${s.name}</b></button>`;
  })();
  for (const b of $('#skinGrid').children) b.onclick = () => {
    audio.ensure(); audio.play('click');
    state.profile.skin = b.dataset.id; persist();
    renderSkins(); renderProfile();
    setPreviewSkin(b.dataset.id);
  };
}

function renderBoard() {
  const p = state.profile, r = rank(p.rating);
  $('#achGrid').innerHTML = ACHIEVEMENTS.map((a) => `<div class="ach ${p.achievements.includes(a.id) ? 'got' : ''}" title="${a.text}"><span class="i">${a.icon}</span><b>${a.name}</b>${a.text}</div>`).join('');
  const rows = seasonBoard(p);
  const you = rows.find((x) => x.you);
  $('#rankLine').innerHTML = `Je staat op plek <b>#${you.rank}</b> · divisie <b style="color:${r.color}">${r.name}</b>`;
  $('#seasonBoard').innerHTML = rows.map((x) => {
    const t = rank(x.rating);
    return `<div class="board-row ${x.you ? 'you' : ''} ${x.rank <= 3 ? 'r' + x.rank : ''}"><span class="pos">${x.rank}</span><span>${x.name}${x.you ? ' (jij)' : ''}</span><span class="tier" style="background:${t.color}">${t.name}</span><span class="rating">${x.rating}</span></div>`;
  }).join('');
  $('#stats').innerHTML = [['Matches', p.matches], ['Gewonnen', p.wins], ['Eliminaties', p.totalKOs], ['Beste match', p.bestKOs]]
    .map(([l, v]) => `<div class="stat"><b>${v}</b><small>${l}</small></div>`).join('');
}

function renderSettings() {
  const s = state.settings;
  segmented($('#qualitySeg'), [['auto', 'Auto'], ['low', 'Laag'], ['medium', 'Midden'], ['high', 'Hoog']], s.quality, (v) => {
    s.quality = v; persist();
    applyQuality(v === 'auto' ? autoStart : v);
  });
  $('#sens').value = s.sensitivity; $('#sensVal').textContent = s.sensitivity.toFixed(2) + '×';
  $('#sens').oninput = (e) => { s.sensitivity = +e.target.value; $('#sensVal').textContent = s.sensitivity.toFixed(2) + '×'; persist(); };
  $('#vol').value = s.volume; $('#volVal').textContent = Math.round(s.volume * 100) + '%';
  $('#vol').oninput = (e) => { s.volume = +e.target.value; audio.setVolume(s.volume); $('#volVal').textContent = Math.round(s.volume * 100) + '%'; persist(); };
  $('#shakeToggle').checked = s.screenShake; $('#shakeToggle').onchange = (e) => { s.screenShake = e.target.checked; persist(); };
  $('#fpsToggle').checked = s.showFps; $('#fpsToggle').onchange = (e) => { s.showFps = e.target.checked; persist(); };
}

function setTab(tab) {
  for (const b of $('#menuNav').children) b.classList.toggle('active', b.dataset.tab === tab);
  for (const p of document.querySelectorAll('.panel')) p.classList.toggle('show', p.id === 'panel-' + tab);
  if (tab === 'play') renderDaily();
  if (tab === 'skins') renderSkins();
  if (tab === 'board') renderBoard();
  if (tab === 'settings') renderSettings();
}
for (const b of $('#menuNav').children) b.onclick = () => { audio.ensure(); audio.play('click'); setTab(b.dataset.tab); };

segmented($('#difficulty'), [['auto', 'Auto'], ...Object.entries(DIFFICULTY).map(([k, v]) => [k, v.label])], state.settings.difficulty, (v) => { state.settings.difficulty = v; persist(); });
const renderMode = () => { $('#modeMeta').textContent = MODES[state.settings.mode]?.meta || ''; $('#modeTitle').textContent = 'Vrij-voor-allen · ' + MODES[state.settings.mode].label; };
if (!MODES[state.settings.mode]) state.settings.mode = 'standaard';
segmented($('#modeSeg'), Object.entries(MODES).map(([k, v]) => [k, v.label]), state.settings.mode, (v) => { state.settings.mode = v; persist(); renderMode(); });
renderMode();
// "Auto" past de bots aan je niveau aan: altijd uitdagend, nooit hopeloos.
const resolveDifficulty = () => {
  const d = state.settings.difficulty;
  if (d !== 'auto') return d;
  const r = state.profile.rating;
  return r < 1060 ? 'easy' : r < 1220 ? 'normal' : 'hard';
};
$('#nameInput').value = state.profile.name;
$('#nameInput').oninput = (e) => { state.profile.name = e.target.value.trim().slice(0, 14) || 'Player'; persist(); renderProfile(); };

// ------------------------------------------------------------------
// Match-verloop
// ------------------------------------------------------------------
const BOT_NAMES = ['Zephyr', 'Nyx', 'Kyro', 'Raze', 'Bolt', 'Juno', 'Vex', 'Onyx', 'Kite', 'Rogue', 'Hex', 'Drift', 'Sable', 'Lynx'];

let starting = false;
function startMatch() {
  if (starting) return;
  starting = true;
  audio.ensure();
  fadeThen(() => {
    starting = false;
    if (match) { match.dispose(); match = null; }
    if (arena.def.id !== state.settings.arena) loadArena(state.settings.arena);
    if (preview) preview.root.visible = false;
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    const skins = SKINS.filter((s) => s.id !== state.profile.skin).sort(() => Math.random() - 0.5);
    const bots = Array.from({ length: 5 }, (_, i) => ({ name: names[i], skin: skins[i % skins.length] }));
    match = new Match({
      scene, arena, camera, hud,
      settings: { ...state.settings, maxParticles: QUALITY[activeQuality].particles },
      playerProfile: { name: state.profile.name, skin: getSkin(state.profile.skin) },
      bots, difficulty: resolveDifficulty(), audio, mode: MODES[state.settings.mode],
    });
    liveToasted = new Set();
    match.onFinish = (st) => setTimeout(() => showResults(st), 1600);
    hud.bind(match);
    hud.setVisible(true);
    show('#hud');
    paused = false;
    hud.setPaused(false);
    input.enabled = true;
    camera.fov = 72;
    input.lock();
  });
}

input.onLockChange = (locked) => {
  if (!match || match.over) return;
  paused = !locked;
  hud.setPaused(paused);
};
$('#resumeBtn').onclick = () => input.lock();
$('#quitBtn').onclick = () => toMenu();
$('#startBtn').onclick = startMatch;
$('#againBtn').onclick = startMatch;
$('#menuBtn').onclick = () => toMenu();
// Enter = direct (opnieuw) spelen
addEventListener('keydown', (e) => {
  if (e.code !== 'Enter' || e.target.tagName === 'INPUT') return;
  if ($('#results').classList.contains('show') || ($('#menu').classList.contains('show') && !match)) startMatch();
});

function toMenu() {
  fadeThen(() => {
    if (match) { match.dispose(); match = null; }
    hud.clear();
    input.enabled = false;
    input.unlock();
    paused = false;
    hud.setPaused(false);
    show('#menu');
    renderProfile();
    setPreviewSkin(state.profile.skin);
    setTab('play');
    openDailyReward();
  });
}

// ------------------------------------------------------------------
// Dagreeks: elke dag een beloning, hoger naarmate je reeks langer is
// ------------------------------------------------------------------
function openDailyReward(force = false) {
  const st = streakStatus(state.streak);
  if (!st.claimable && !force) return;
  const day = st.day;
  const tiles = STREAK_REWARDS.map((xp, i) => {
    const d = i + 1;
    const cls = st.claimable ? (d < day ? 'got' : d === day ? 'today' : '') : (d <= day ? 'got' : '');
    const extra = d === 7 ? `<small>${state.profile.streakSkin ? '+ bonuskist' : '+ Zonnestraal'}</small>` : '';
    return `<div class="dr-tile ${cls} ${d === 7 ? 'big' : ''}"><span>Dag ${d}</span><b>+${xp}</b><em>XP</em>${extra}</div>`;
  }).join('');
  $('#dailyReward').innerHTML = `<div class="dr-card">
    <div class="dr-flame">🔥</div>
    <h2>${st.claimable ? `Dag ${st.count} op rij!` : `Reeks: ${st.count} ${st.count === 1 ? 'dag' : 'dagen'}`}</h2>
    <p class="sub">${st.claimable
      ? (st.broken ? `Je reeks van ${st.previous} dagen is gestopt — begin vandaag een nieuwe!` : 'Kom elke dag terug: hoe langer je reeks, hoe groter de beloning.')
      : 'Beloning van vandaag is binnen. Morgen wacht de volgende!'}</p>
    <div class="dr-grid">${tiles}</div>
    ${st.claimable ? `<button class="btn primary big" id="claimBtn">Claim +${STREAK_REWARDS[day - 1]} XP</button>` : `<button class="btn ghost big" id="claimBtn">Sluiten</button>`}
    <div class="dr-best">Langste reeks: <b>${Math.max(state.streak.best || 0, st.count)}</b> ${Math.max(state.streak.best || 0, st.count) === 1 ? 'dag' : 'dagen'}</div>
  </div>`;
  $('#dailyReward').classList.add('show');
  $('#claimBtn').onclick = () => {
    audio.ensure();
    if (st.claimable) claimDailyReward(st);
    $('#dailyReward').classList.remove('show');
  };
}

function claimDailyReward(st) {
  const prof = state.profile;
  const xp = STREAK_REWARDS[st.day - 1];
  let bonus = 0;
  prof.xp += xp;
  let newSkin = false;
  if (st.day === 7) {
    if (!prof.streakSkin) { prof.streakSkin = true; newSkin = true; }
    else { bonus = 150 + Math.floor(Math.random() * 4) * 50; prof.xp += bonus; } // bonuskist: 150–300 XP
  }
  state.streak = { count: st.count, last: new Date().toLocaleDateString('sv'), best: Math.max(state.streak.best || 0, st.count) };
  persist();
  audio.play('win');
  renderProfile();
  renderDaily();
  const msg = newSkin ? `Zonnestraal is vrijgespeeld!` : bonus ? `Bonuskist: +${bonus} XP extra!` : `+${xp} XP`;
  showMenuToast(`🔥 Reeks van ${st.count} ${st.count === 1 ? 'dag' : 'dagen'}`, msg);
  if (newSkin) { state.profile.skin = STREAK_SKIN.id; persist(); setPreviewSkin(STREAK_SKIN.id); renderProfile(); }
}

function showMenuToast(title, text) {
  const el = document.createElement('div');
  el.className = 'toast menu-toast';
  el.innerHTML = `<div class="toast-icon">🔥</div><div><b>${title}</b><span>${text}</span></div>`;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('out'), 3000);
  setTimeout(() => el.remove(), 3500);
}

// Uitdagingen live volgen: direct een toast zodra je er één haalt.
let liveToasted = new Set();
function checkLiveChallenges() {
  if (!match || match.over) return;
  const v = matchStatValues(match.stats, 99);
  for (const it of state.daily.items) {
    if (it.done || liveToasted.has(it.id)) continue;
    const d = challengeDef(it.id);
    if (['matches', 'top3', 'wins'].includes(d.stat)) continue;
    const now = d.mode === 'max' ? Math.max(it.value, v[d.stat] || 0) : it.value + (v[d.stat] || 0);
    if (now >= d.target) { liveToasted.add(it.id); hud.toast('Uitdaging voltooid!', `${d.text} · +${d.xp} XP`); audio.play('heal'); }
  }
}

function showResults(st) {
  if (!match) return;
  input.enabled = false;
  input.unlock();
  const p = match.player;
  const place = st.indexOf(p) + 1;
  const prof = state.profile;
  const ratingDelta = [32, 20, 10, 0, -8, -15][place - 1] + Math.min(10, p.kills);
  const prevXp = prof.xp, prevLevel = levelInfo(prevXp).level;
  const isRecord = p.kills > prof.bestKOs && prof.matches > 0;

  // uitdagingen
  const values = matchStatValues(match.stats, place);
  const doneChallenges = applyChallenges(state.daily, values);
  const challengeXp = doneChallenges.reduce((a, c) => a + c.xp, 0);
  const baseXp = 60, koXp = p.kills * 15, placeXp = [80, 50, 30, 15, 5, 0][place - 1], bonusXp = match.bonusXp || 0;
  const xpGain = baseXp + koXp + placeXp + bonusXp + challengeXp;

  prof.xp += xpGain;
  prof.rating = Math.max(0, prof.rating + ratingDelta);
  prof.matches++;
  if (place === 1) { prof.wins++; if (!prof.arenaWins.includes(arena.def.id)) prof.arenaWins.push(arena.def.id); }
  prof.totalKOs += p.kills;
  prof.bestKOs = Math.max(prof.bestKOs, p.kills);
  prof.lifetime.ringOuts += match.stats.ringOuts;
  prof.lifetime.headshots += match.stats.headshots;
  state.history.unshift({ arena: arena.def.id, place, kills: p.kills, deaths: p.deaths, at: Date.now() });
  state.history = state.history.slice(0, 20);

  const unlocked = SKINS.filter((s) => s.unlockXp > prevXp && s.unlockXp <= prof.xp);
  const allSkins = SKINS.every((s) => s.unlockXp <= prof.xp) && prof.streakSkin;
  const newAch = ACHIEVEMENTS.filter((a) => !prof.achievements.includes(a.id) && a.check(prof, match.stats, place, p.deaths, allSkins));
  prof.achievements.push(...newAch.map((a) => a.id));
  persist();

  const L = levelInfo(prof.xp), leveled = L.level > prevLevel;
  const nextSkin = SKINS.find((s) => s.unlockXp > prof.xp);

  $('#resPlace').textContent = `#${place}`;
  $('#resTitle').innerHTML = (place === 1 ? 'Kampioen van de arena' : place <= 3 ? 'Podiumplek — sterk gespeeld' : 'Goed gevochten — pak ze de volgende ronde') + (isRecord ? '<span class="record">Nieuw record: ' + p.kills + " eliminaties</span>" : '');
  const order = [st[1], st[0], st[2]];
  $('#podium').innerHTML = order.map((f, i) => f ? `<div class="pod p${[2, 1, 3][i]}"><div class="who">${f.name}${f.isPlayer ? ' (jij)' : ''}</div><div class="ball" style="background:${hex(f.skin.body)}"></div><div class="block">${[2, 1, 3][i]}</div></div>` : '').join('');
  hud.renderBoard($('#resBoard'), st, true);
  const row = (label, val, cls = 'up') => `<div class="reward"><span>${label}</span><b class="${cls}">${val}</b></div>`;
  $('#resRewards').innerHTML = `<h3>Beloningen</h3>
    <div class="lvl-row"><div class="lvl-badge ${leveled ? 'up' : ''}">${L.level}</div><div style="flex:1"><div class="lvl-bar"><i id="lvlFill"></i></div>
      <div class="lvl-meta">${leveled ? `<b>Level omhoog!</b>${titleFor(L.level) !== titleFor(prevLevel) ? ` Nieuwe titel: ${titleFor(L.level)}` : ''}` : `Nog ${L.need - L.into} XP tot level ${L.level + 1}`}${nextSkin ? ` · ${nextSkin.unlockXp - prof.xp} XP tot ${nextSkin.name}` : ''}</div></div></div>
    ${row('Match + plaats', '+' + (baseXp + placeXp))}
    ${row("Eliminaties", '+' + koXp)}
    ${bonusXp ? row('Bonussen (multi, reeks, wraak…)', '+' + bonusXp) : ''}
    ${doneChallenges.map((c) => row('✔ ' + c.text, '+' + c.xp)).join('')}
    ${row('Ranglijstpunten', (ratingDelta >= 0 ? '+' : '') + ratingDelta + ` → ${prof.rating}`, ratingDelta >= 0 ? 'up' : 'down')}
    ${unlocked.map((s) => `<div class="unlock">Nieuw personage vrijgespeeld: <span style="color:${hex(s.body)}">${s.name}</span>!</div>`).join('')}
    ${newAch.map((a) => `<div class="unlock">${a.icon} Prestatie behaald: <b>${a.name}</b> — ${a.text}</div>`).join('')}
`;
  requestAnimationFrame(() => requestAnimationFrame(() => { const f = $('#lvlFill'); if (f) f.style.width = L.progress * 100 + '%'; }));
  show('#results');
  hud.setVisible(false);
  if (place === 1) audio.play('win');
}

// ------------------------------------------------------------------
// Hoofdlus + automatische kwaliteit
// ------------------------------------------------------------------
const clock = new THREE.Clock();
let fpsAcc = 0, fpsFrames = 0, fps = 0, lowFpsTime = 0, liveCheckT = 0;

function frame() {
  requestAnimationFrame(frame);
  const raw = clock.getDelta();
  const dt = Math.min(0.05, raw);
  const t = clock.elapsedTime;

  fpsAcc += raw; fpsFrames++;
  if (fpsAcc >= 0.5) {
    fps = Math.round(fpsFrames / fpsAcc);
    fpsAcc = 0; fpsFrames = 0;
    // auto-kwaliteit: stap terug bij aanhoudend lage framerate
    if (state.settings.quality === 'auto' && match && !paused) {
      lowFpsTime = fps < 45 ? lowFpsTime + 0.5 : Math.max(0, lowFpsTime - 0.5);
      if (lowFpsTime >= 3 && activeQuality !== 'low') {
        applyQuality(activeQuality === 'high' ? 'medium' : 'low');
        lowFpsTime = 0;
      }
    }
  }

  arena.update(dt, t);
  if (match) {
    if (!paused) {
      match.update(dt, input);
      liveCheckT -= dt;
      if (liveCheckT <= 0) { liveCheckT = 0.5; checkLiveChallenges(); }
    }
    hud.update(dt, input, state.settings.showFps ? fps : 0);
  } else {
    updateShowcase(dt, t);
  }
  input.endFrame();
  renderer.render(scene, camera);
}

// ------------------------------------------------------------------
// Start
// ------------------------------------------------------------------
loadArena(state.settings.arena);
setPreviewSkin(state.profile.skin);
renderProfile();
renderArenaCards();
setTab('play');
setTimeout(() => openDailyReward(), 700);
frame();

// handig voor debuggen / automatisch testen
window.__arena = { get match() { return match; }, startMatch, state, applyQuality };
window.__renderer = renderer;
