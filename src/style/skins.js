// Speelbare personageskins. Elke skin heeft een unieke kleur + accessoire
// zodat spelers ook in drukke gevechten herkenbaar blijven.
export const SKINS = [
  { id: 'pip',     name: 'Pip',     body: 0x3d8bff, belly: 0xdff0ff, accent: 0xffc83d, accessory: 'antenna', unlockXp: 0 },
  { id: 'mango',   name: 'Mango',   body: 0xff9a1f, belly: 0xfff0d6, accent: 0xff5d73, accessory: 'ears',    unlockXp: 0 },
  { id: 'kiwi',    name: 'Kiwi',    body: 0x5fd35a, belly: 0xeaffd9, accent: 0xffe14d, accessory: 'sprout',  unlockXp: 0 },
  { id: 'bes',     name: 'Bes',     body: 0xff4f8b, belly: 0xffe3ee, accent: 0x8b5cf6, accessory: 'horns',   unlockXp: 0 },
  { id: 'citroen', name: 'Citroen', body: 0xffd23d, belly: 0xfffbe0, accent: 0x3d8bff, accessory: 'cap',     unlockXp: 300 },
  { id: 'nimbus',  name: 'Nimbus',  body: 0xb9a6ff, belly: 0xffffff, accent: 0x2ee6a8, accessory: 'tuft',    unlockXp: 700 },
  { id: 'koraal',  name: 'Koraal',  body: 0xff7a63, belly: 0xffeee6, accent: 0x3dd6f5, accessory: 'fin',     unlockXp: 1200 },
  { id: 'munt',    name: 'Munt',    body: 0x2ee6a8, belly: 0xe6fff6, accent: 0xff5d73, accessory: 'visor',   unlockXp: 2000 },
];

// Exclusief personage: alleen te verdienen met een dagreeks van 7 dagen.
export const STREAK_SKIN = { id: 'zonnestraal', name: 'Zonnestraal', body: 0xffb81f, belly: 0xfff6d6, accent: 0xff5d73, accessory: 'crown', streakDays: 7 };

export const getSkin = (id) => SKINS.find((s) => s.id === id) || (id === STREAK_SKIN.id ? STREAK_SKIN : SKINS[0]);
