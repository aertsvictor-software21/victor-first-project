import * as THREE from 'three';
import { ARENAS, getArena, buildArena } from './world/arenas.js';
import { SKINS, getSkin } from './style/skins.js';
import { Character } from './entities/character.js';
import { Match } from './game/match.js';
import { Input } from './game/input.js';
import { Hud } from './ui/hud.js';
import { Audio } from './game/audio.js';
import { DIFFICULTY } from './game/bot.js';
import { load, save, seasonBoard, rank } from './game/storage.js';

const $ = (s) => document.querySelector(s);
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

// ------------------------------------------------------------------
// Status & instellingen
// ------------------------------------------------------------------
const state = load();
const QUALITY = {
  low:    { label: 'Laag',   pixelRatio: 0.75, shadows: false, shadowMap: 0,    particles: 120 },
  medium: { label: 'Midden', pixelRatio: 1,    shadows: true,  shadowMap: 1024, particles: 250 },
  high:   { label: 'Hoog',   pixelRatio: 2,    shadows: true,  shadowMap: 2048, particles: 400 },
};
let activeQuality = state.settings.quality === 'auto' ? 'medium' : state.settings.quality;

// ------------------------------------------------------------------
// Renderer, scène, licht
// ------------------------------------------------------------------
const canvas = $('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: state.settings.quality !== 'low', powerPreference: 'high-performance' });
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 600);

const hemi = new THREE.HemisphereLight(0xcfeeff, 0x6bbf4e, 1.5);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d0, 2.3);
sun.position.set(28, 46, 18);
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
  preview.root.rotation.y = Math.sin(t * 0.4) * 0.5 + 0.3;
  preview.update(dt, { speed: 0, onGround: true, aimPitch: Math.sin(t * 0.7) * 0.1, t });
  // camera iets links van het personage, zodat het menu-paneel rechts vrij is
  const ang = t * 0.05 + 0.5;
  const wide = innerWidth > 1100;
  const camTarget = new THREE.Vector3(base.x, base.y + 1.1, base.z);
  const offset = new THREE.Vector3(Math.sin(ang) * 7, 2.6, Math.cos(ang) * 7);
  camera.position.copy(camTarget).add(offset);
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
  const p = state.profile, r = rank(p.rating);
  $('#profileChip').innerHTML = `<div class="avatar" style="background:${hex(getSkin(p.skin).body)}"></div><div>${p.name}<small>${p.rating} punten · ${p.xp} XP</small></div><span class="rank-badge" style="background:${r.color}">${r.name}</span>`;
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
  }).join('');
  for (const b of $('#skinGrid').children) b.onclick = () => {
    audio.ensure(); audio.play('click');
    state.profile.skin = b.dataset.id; persist();
    renderSkins(); renderProfile();
    setPreviewSkin(b.dataset.id);
  };
}

function renderBoard() {
  const p = state.profile, r = rank(p.rating);
  const rows = seasonBoard(p);
  const you = rows.find((x) => x.you);
  $('#rankLine').innerHTML = `Je staat op plek <b>#${you.rank}</b> · divisie <b style="color:${r.color}">${r.name}</b>`;
  $('#seasonBoard').innerHTML = rows.map((x) => {
    const t = rank(x.rating);
    return `<div class="board-row ${x.you ? 'you' : ''} ${x.rank <= 3 ? 'r' + x.rank : ''}"><span class="pos">${x.rank}</span><span>${x.name}${x.you ? ' (jij)' : ''}</span><span class="tier" style="background:${t.color}">${t.name}</span><span class="rating">${x.rating}</span></div>`;
  }).join('');
  $('#stats').innerHTML = [['Matches', p.matches], ['Gewonnen', p.wins], ["KO's totaal", p.totalKOs], ['Beste match', p.bestKOs]]
    .map(([l, v]) => `<div class="stat"><b>${v}</b><small>${l}</small></div>`).join('');
}

function renderSettings() {
  const s = state.settings;
  segmented($('#qualitySeg'), [['auto', 'Auto'], ['low', 'Laag'], ['medium', 'Midden'], ['high', 'Hoog']], s.quality, (v) => {
    s.quality = v; persist();
    applyQuality(v === 'auto' ? 'medium' : v);
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
  if (tab === 'skins') renderSkins();
  if (tab === 'board') renderBoard();
  if (tab === 'settings') renderSettings();
}
for (const b of $('#menuNav').children) b.onclick = () => { audio.ensure(); audio.play('click'); setTab(b.dataset.tab); };

segmented($('#difficulty'), Object.entries(DIFFICULTY).map(([k, v]) => [k, v.label]), state.settings.difficulty, (v) => { state.settings.difficulty = v; persist(); });
$('#nameInput').value = state.profile.name;
$('#nameInput').oninput = (e) => { state.profile.name = e.target.value.trim().slice(0, 14) || 'Speler'; persist(); renderProfile(); };

// ------------------------------------------------------------------
// Match-verloop
// ------------------------------------------------------------------
const BOT_NAMES = ['Zefier', 'Pompom', 'Tikkie', 'Noor', 'Bliksem', 'Lotte', 'Rakker', 'Juno', 'Fizz', 'Moos', 'Saffier', 'Wiebel'];

function startMatch() {
  audio.ensure();
  fadeThen(() => {
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
      bots, difficulty: state.settings.difficulty, audio,
    });
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
  });
}

function showResults(st) {
  if (!match) return;
  input.enabled = false;
  input.unlock();
  const p = match.player;
  const place = st.indexOf(p) + 1;
  const prof = state.profile;
  const ratingDelta = [32, 20, 10, 0, -8, -15][place - 1] + Math.min(10, p.kills);
  const xpGain = 60 + p.kills * 15 + [80, 50, 30, 15, 5, 0][place - 1];
  const prevXp = prof.xp;
  prof.xp += xpGain;
  prof.rating = Math.max(0, prof.rating + ratingDelta);
  prof.matches++;
  if (place === 1) prof.wins++;
  prof.totalKOs += p.kills;
  prof.bestKOs = Math.max(prof.bestKOs, p.kills);
  state.history.unshift({ arena: arena.def.id, place, kills: p.kills, deaths: p.deaths, at: Date.now() });
  state.history = state.history.slice(0, 20);
  persist();
  const unlocked = SKINS.filter((s) => s.unlockXp > prevXp && s.unlockXp <= prof.xp);

  $('#resPlace').textContent = `#${place}`;
  $('#resTitle').textContent = place === 1 ? 'Winnaar! Niemand hield je tegen.' : place <= 3 ? 'Op het podium — sterk gespeeld!' : 'Goed gevochten — volgende keer hoger!';
  const order = [st[1], st[0], st[2]];
  $('#podium').innerHTML = order.map((f, i) => f ? `<div class="pod p${[2, 1, 3][i]}"><div class="who">${f.name}${f.isPlayer ? ' (jij)' : ''}</div><div class="ball" style="background:${hex(f.skin.body)}"></div><div class="block">${[2, 1, 3][i]}</div></div>` : '').join('');
  hud.renderBoard($('#resBoard'), st, true);
  $('#resRewards').innerHTML = `<h3>Beloningen</h3>
    <div class="reward"><span>XP verdiend</span><b class="up">+${xpGain}</b></div>
    <div class="reward"><span>Ranglijstpunten</span><b class="${ratingDelta >= 0 ? 'up' : 'down'}">${ratingDelta >= 0 ? '+' : ''}${ratingDelta}</b></div>
    <div class="reward"><span>Nieuwe stand</span><b>${prof.rating}</b></div>
    <div class="reward"><span>Divisie</span><b style="color:${rank(prof.rating).color}">${rank(prof.rating).name}</b></div>
    ${unlocked.map((s) => `<div class="unlock">Nieuw personage vrijgespeeld: <span style="color:${hex(s.body)}">${s.name}</span>!</div>`).join('')}`;
  show('#results');
  hud.setVisible(false);
  if (place === 1) audio.play('win');
}

// ------------------------------------------------------------------
// Hoofdlus + automatische kwaliteit
// ------------------------------------------------------------------
const clock = new THREE.Clock();
let fpsAcc = 0, fpsFrames = 0, fps = 0, lowFpsTime = 0;

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
    if (!paused) match.update(dt, input);
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
frame();

// handig voor debuggen / automatisch testen
window.__arena = { get match() { return match; }, startMatch, state, applyQuality };
window.__renderer = renderer;
