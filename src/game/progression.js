// Progressie: levels, dagelijkse uitdagingen en prestaties.
// Bewust "eerlijk" ontworpen: geen loot boxes, geen betaalmuren, geen straf als je
// een dag overslaat. Spelers komen terug omdat het spel leuk is, niet uit angst iets te missen.

// ---------- Levels ----------
export function levelInfo(xp) {
  let level = 1, need = 120, rest = xp;
  while (rest >= need) { rest -= need; level++; need = 120 + (level - 1) * 40; }
  return { level, into: rest, need, progress: rest / need };
}

const TITLES = [[1, 'Nieuwkomer'], [3, 'Knaller'], [6, 'Stuiterexpert'], [10, 'Arenaheld'], [15, 'Konfettikoning'], [20, 'Legende']];
export function titleFor(level) {
  let t = TITLES[0][1];
  for (const [l, name] of TITLES) if (level >= l) t = name;
  return t;
}

// ---------- Dagelijkse uitdagingen ----------
// stat: sleutel uit de matchstatistieken; mode 'sum' telt op over matches, 'max' = in één match.
const POOL = [
  { id: 'ko10', text: "Maak 10 KO's", stat: 'kills', target: 10, xp: 120 },
  { id: 'ko20', text: "Maak 20 KO's", stat: 'kills', target: 20, xp: 200 },
  { id: 'blast6', text: "6 KO's met de Bubbelblaster", stat: 'ko_blaster', target: 6, xp: 130 },
  { id: 'bounce5', text: "5 KO's met het Stuiterkanon", stat: 'ko_bouncer', target: 5, xp: 140 },
  { id: 'rocket5', text: "5 KO's met de Konfettiraket", stat: 'ko_rocket', target: 5, xp: 140 },
  { id: 'special2', text: "2 KO's met de Sprongstoot", stat: 'ko_special', target: 2, xp: 150 },
  { id: 'head15', text: 'Raak 15 headshots', stat: 'headshots', target: 15, xp: 130 },
  { id: 'ringout3', text: '3 tegenstanders uit de arena geblazen', stat: 'ringOuts', target: 3, xp: 150 },
  { id: 'heal4', text: 'Pak 4 health-orbs', stat: 'pickups', target: 4, xp: 90 },
  { id: 'dmg1500', text: 'Deel 1500 schade uit', stat: 'damage', target: 1500, xp: 130 },
  { id: 'top3x2', text: 'Eindig 2× in de top 3', stat: 'top3', target: 2, xp: 150 },
  { id: 'win1', text: 'Win een match', stat: 'wins', target: 1, xp: 180 },
  { id: 'play3', text: 'Speel 3 matches', stat: 'matches', target: 3, xp: 100 },
  { id: 'streak4', text: 'Haal een reeks van 4 KO\'s', stat: 'maxStreak', target: 4, xp: 160, mode: 'max' },
  { id: 'multi2', text: 'Maak een Dubbel-KO', stat: 'bestMulti', target: 2, xp: 140, mode: 'max' },
  { id: 'revenge2', text: 'Neem 2× wraak', stat: 'revenge', target: 2, xp: 110 },
];

export const today = () => new Date().toISOString().slice(0, 10);

function seeded(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
}

// Zelfde 3 uitdagingen voor iedereen op dezelfde dag: leuk om met klasgenoten te vergelijken.
export function dailyChallenges(progress) {
  const day = today();
  if (progress?.day === day) return progress;
  const rnd = seeded('arena-' + day);
  const pool = [...POOL];
  const picks = [];
  while (picks.length < 3) picks.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return { day, items: picks.map((c) => ({ id: c.id, value: 0, done: false, claimed: false })) };
}
export const challengeDef = (id) => POOL.find((c) => c.id === id);

export function matchStatValues(stats, place) {
  return {
    kills: stats.kills, headshots: stats.headshots, ringOuts: stats.ringOuts, pickups: stats.pickups,
    damage: stats.damage, maxStreak: stats.maxStreak, bestMulti: stats.bestMulti, revenge: stats.revenge,
    ko_blaster: stats.killsBy.blaster, ko_bouncer: stats.killsBy.bouncer, ko_rocket: stats.killsBy.rocket, ko_special: stats.killsBy.special,
    top3: place <= 3 ? 1 : 0, wins: place === 1 ? 1 : 0, matches: 1,
  };
}

// Werkt uitdagingen bij; geeft de net voltooide terug.
export function applyChallenges(progress, values) {
  const completed = [];
  for (const it of progress.items) {
    if (it.done) continue;
    const def = challengeDef(it.id);
    const v = values[def.stat] || 0;
    it.value = def.mode === 'max' ? Math.max(it.value, v) : it.value + v;
    if (it.value >= def.target) { it.value = def.target; it.done = true; completed.push(def); }
  }
  return completed;
}

// ---------- Prestaties ----------
export const ACHIEVEMENTS = [
  { id: 'first_ko', name: 'Eerste knal', text: 'Maak je eerste KO', icon: '✦', check: (p, m) => m.kills >= 1 },
  { id: 'first_win', name: 'Kampioen', text: 'Win een match', icon: '🏆', check: (p, m, place) => place === 1 },
  { id: 'ten_match', name: 'Op dreef', text: "10 KO's in één match", icon: '🔥', check: (p, m) => m.kills >= 10 },
  { id: 'streak5', name: 'Niet te stoppen', text: "Reeks van 5 KO's", icon: '⚡', check: (p, m) => m.maxStreak >= 5 },
  { id: 'triple', name: 'Driedubbel', text: 'Maak een Driedubbel-KO', icon: '✸', check: (p, m) => m.bestMulti >= 3 },
  { id: 'ringout', name: 'Wegblazer', text: '25 tegenstanders uit de arena', icon: '💨', check: (p) => p.lifetime.ringOuts >= 25 },
  { id: 'sharp', name: 'Scherpschutter', text: '100 headshots in totaal', icon: '◎', check: (p) => p.lifetime.headshots >= 100 },
  { id: 'veteran', name: 'Veteraan', text: 'Speel 25 matches', icon: '★', check: (p) => p.matches >= 25 },
  { id: 'allarenas', name: 'Wereldreiziger', text: 'Win in alle drie de arena\'s', icon: '🗺', check: (p) => (p.arenaWins || []).length >= 3 },
  { id: 'flawless', name: 'Onaantastbaar', text: 'Win zonder uitgeschakeld te worden', icon: '🛡', check: (p, m, place, deaths) => place === 1 && deaths === 0 },
  { id: 'collector', name: 'Verzamelaar', text: 'Speel alle personages vrij', icon: '🎨', check: (p, m, place, deaths, allSkins) => allSkins },
  { id: 'level10', name: 'Arenaheld', text: 'Bereik level 10', icon: '⬆', check: (p) => levelInfo(p.xp).level >= 10 },
];
