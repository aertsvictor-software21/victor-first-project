// Lokale opslag van profiel, instellingen en seizoensranglijst.
const KEY = 'arena.v2';

const RIVALS = [
  ['Zefier', 1420], ['Pompom', 1360], ['Tikkie', 1310], ['Noor', 1265], ['Bliksem', 1220],
  ['Lotte', 1180], ['Rakker', 1140], ['Juno', 1105], ['Fizz', 1070], ['Moos', 1030],
  ['Saffier', 990], ['Kobus', 960], ['Wiebel', 930], ['Ster', 900],
];

const defaults = () => ({
  profile: { name: 'Speler', skin: 'pip', xp: 0, rating: 1000, matches: 0, wins: 0, bestKOs: 0, totalKOs: 0, lifetime: { ringOuts: 0, headshots: 0 }, achievements: [], arenaWins: [] },
  settings: { quality: 'auto', sensitivity: 1, screenShake: true, showFps: false, volume: 0.5, difficulty: 'auto', arena: 'zonneweide', mode: 'standaard', breakReminder: true },
  daily: null,
  history: [],
});

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const d = JSON.parse(raw), base = defaults();
    const profile = { ...base.profile, ...d.profile };
    profile.lifetime = { ...base.profile.lifetime, ...(d.profile?.lifetime || {}) };
    return { profile, settings: { ...base.settings, ...d.settings }, history: d.history || [], daily: d.daily || null };
  } catch { return defaults(); }
}

export function save(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* opslag niet beschikbaar */ }
}

// Seizoensranglijst: AI-rivalen + jij.
export function seasonBoard(profile) {
  const rows = RIVALS.map(([name, rating], i) => ({ name, rating, wins: Math.round(rating / 28) - i, you: false }));
  rows.push({ name: profile.name, rating: profile.rating, wins: profile.wins, you: true });
  return rows.sort((a, b) => b.rating - a.rating).map((r, i) => ({ ...r, rank: i + 1 }));
}

export function rank(rating) {
  if (rating >= 1400) return { name: 'Diamant', color: '#3DD6F5' };
  if (rating >= 1250) return { name: 'Goud', color: '#FFC83D' };
  if (rating >= 1100) return { name: 'Zilver', color: '#A9B4C8' };
  return { name: 'Brons', color: '#E0945A' };
}
