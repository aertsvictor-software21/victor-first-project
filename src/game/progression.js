// Progressie: levels, dagelijkse uitdagingen en prestaties.
// Bewust "eerlijk" ontworpen: geen loot boxes, geen betaalmuren, geen straf als je
// een dag overslaat. Spelers komen terug omdat het spel leuk is, niet uit angst iets te missen.

// ---------- Levels ----------
export function levelInfo(xp) {
  let level = 1, need = 120, rest = xp;
  while (rest >= need) { rest -= need; level++; need = 120 + (level - 1) * 40; }
  return { level, into: rest, need, progress: rest / need };
}

const TITLES = [[1, 'Rookie'], [3, 'Challenger'], [6, 'Contender'], [10, 'Elite'], [15, 'Champion'], [20, 'Legend']];
export function titleFor(level) {
  let t = TITLES[0][1];
  for (const [l, name] of TITLES) if (level >= l) t = name;
  return t;
}

// ---------- Dagelijkse uitdagingen ----------
// stat: sleutel uit de matchstatistieken; mode 'sum' telt op over matches, 'max' = in één match.
const POOL = [
  { id: 'ko10', text: "Maak 10 eliminaties", stat: 'kills', target: 10, xp: 120 },
  { id: 'ko20', text: "Maak 20 eliminaties", stat: 'kills', target: 20, xp: 200 },
  { id: 'blast6', text: "6 eliminaties met het Pulsgeweer", stat: 'ko_blaster', target: 6, xp: 130 },
  { id: 'bounce5', text: "5 eliminaties met de Stuiterwerper", stat: 'ko_bouncer', target: 5, xp: 140 },
  { id: 'rocket5', text: "5 eliminaties met de Raketwerper", stat: 'ko_rocket', target: 5, xp: 140 },
  { id: 'special2', text: "2 eliminaties met de Sprongstoot", stat: 'ko_special', target: 2, xp: 150 },
  { id: 'head15', text: 'Raak 15 headshots', stat: 'headshots', target: 15, xp: 130 },
  { id: 'ringout3', text: '3 tegenstanders uit de arena geblazen', stat: 'ringOuts', target: 3, xp: 150 },
  { id: 'heal4', text: 'Pak 4 health-orbs', stat: 'pickups', target: 4, xp: 90 },
  { id: 'dmg1500', text: 'Deel 1500 schade uit', stat: 'damage', target: 1500, xp: 130 },
  { id: 'top3x2', text: 'Eindig 2× in de top 3', stat: 'top3', target: 2, xp: 150 },
  { id: 'win1', text: 'Win een match', stat: 'wins', target: 1, xp: 180 },
  { id: 'play3', text: 'Speel 3 matches', stat: 'matches', target: 3, xp: 100 },
  { id: 'streak4', text: 'Haal een reeks van 4 eliminaties', stat: 'maxStreak', target: 4, xp: 160, mode: 'max' },
  { id: 'multi2', text: 'Maak een dubbele eliminatie', stat: 'bestMulti', target: 2, xp: 140, mode: 'max' },
  { id: 'revenge2', text: 'Neem 2× wraak', stat: 'revenge', target: 2, xp: 110 },
  { id: 'wall10', text: 'Doe 10 wall-jumps', stat: 'wallJumps', target: 10, xp: 120 },
  { id: 'hskill3', text: '3 headshot-eliminaties', stat: 'headshotKos', target: 3, xp: 150 },
  { id: 'pit3', text: '3 tegenstanders in een put of lava geblazen', stat: 'ringOuts', target: 3, xp: 150 },
];

const localDay = (d) => d.toLocaleDateString('sv'); // JJJJ-MM-DD in lokale tijd
export const today = () => localDay(new Date());
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return localDay(d); };

// ---------- Dagreeks + dagelijkse beloning ----------
// Elke dag dat je ARENA opent, claim je een beloning. Opeenvolgende dagen = hogere beloning.
export const STREAK_REWARDS = [50, 75, 100, 125, 150, 200, 300]; // dag 1..7, daarna herhaalt de cyclus

export function streakStatus(streak = { count: 0, last: null }) {
  const t = today();
  if (streak.last === t) return { claimable: false, count: streak.count, day: ((streak.count - 1) % 7) + 1 };
  const continues = streak.last === yesterday();
  const count = continues ? streak.count + 1 : 1;
  return { claimable: true, count, day: ((count - 1) % 7) + 1, broken: !continues && streak.count > 1, previous: streak.count };
}

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
    damage: stats.damage, maxStreak: stats.maxStreak, wallJumps: stats.wallJumps, headshotKos: stats.headshotKos, bestMulti: stats.bestMulti, revenge: stats.revenge,
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
  { id: 'first_ko', name: 'Eerste knal', text: 'Maak je eerste eliminatie', icon: '✦', check: (p, m) => m.kills >= 1 },
  { id: 'first_win', name: 'Kampioen', text: 'Win een match', icon: '🏆', check: (p, m, place) => place === 1 },
  { id: 'ten_match', name: 'Op dreef', text: "10 eliminaties in één match", icon: '🔥', check: (p, m) => m.kills >= 10 },
  { id: 'streak5', name: 'Niet te stoppen', text: "Reeks van 5 eliminaties", icon: '⚡', check: (p, m) => m.maxStreak >= 5 },
  { id: 'triple', name: 'Driedubbel', text: 'Maak een triple eliminatie', icon: '✸', check: (p, m) => m.bestMulti >= 3 },
  { id: 'ringout', name: 'Wegblazer', text: '25 tegenstanders uit de arena', icon: '💨', check: (p) => p.lifetime.ringOuts >= 25 },
  { id: 'sharp', name: 'Scherpschutter', text: '100 headshots in totaal', icon: '◎', check: (p) => p.lifetime.headshots >= 100 },
  { id: 'veteran', name: 'Veteraan', text: 'Speel 25 matches', icon: '★', check: (p) => p.matches >= 25 },
  { id: 'allarenas', name: 'Wereldreiziger', text: 'Win in alle drie de arena\'s', icon: '🗺', check: (p) => (p.arenaWins || []).length >= 3 },
  { id: 'flawless', name: 'Onaantastbaar', text: 'Win zonder uitgeschakeld te worden', icon: '🛡', check: (p, m, place, deaths) => place === 1 && deaths === 0 },
  { id: 'collector', name: 'Verzamelaar', text: 'Speel alle personages vrij', icon: '🎨', check: (p, m, place, deaths, allSkins) => allSkins },
  { id: 'precise', name: 'Precisie', text: '50% raak in een match (min. 30 schoten)', icon: '◎', check: (p, m) => m.shots >= 30 && m.hits / m.shots >= 0.5 },
  { id: 'wallrunner', name: 'Muurloper', text: '15 wall-jumps in één match', icon: '⤴', check: (p, m) => m.wallJumps >= 15 },
  { id: 'level10', name: 'Arenaheld', text: 'Bereik level 10', icon: '⬆', check: (p) => levelInfo(p.xp).level >= 10 },
];
