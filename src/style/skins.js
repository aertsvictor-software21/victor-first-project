// Speelbare personages. Elk heeft een unieke signatuurkleur + headgear
// zodat spelers ook in drukke gevechten direct herkenbaar zijn.
// (id's blijven gelijk zodat opgeslagen profielen blijven werken)
export const SKINS = [
  { id: 'pip',     name: 'Volt',   body: 0x2f6bff, belly: 0xdfe9ff, accent: 0xffd400, pants: 0x232a48, tone: 0xe8b48c, accessory: 'helmet',     unlockXp: 0 },
  { id: 'mango',   name: 'Blaze',  body: 0xff6a1a, belly: 0xffe2c8, accent: 0x232a48, pants: 0x3a2c2a, tone: 0xc68863, accessory: 'cap',        unlockXp: 0 },
  { id: 'kiwi',    name: 'Viper',  body: 0x1fbf6a, belly: 0xd9ffe9, accent: 0xb6ff3d, pants: 0x1f2f2a, tone: 0xf2c6a0, accessory: 'mohawk',     unlockXp: 0 },
  { id: 'bes',     name: 'Nova',   body: 0xff3d8b, belly: 0xffe0ee, accent: 0x8f5bff, pants: 0x2c2448, tone: 0x8d5a3c, accessory: 'headphones', unlockXp: 0 },
  { id: 'citroen', name: 'Flash',  body: 0xffc400, belly: 0xfff6cc, accent: 0x2ee0ff, pants: 0x232a48, tone: 0xa86f4c, accessory: 'beanie',     unlockXp: 300 },
  { id: 'nimbus',  name: 'Echo',   body: 0x8f5bff, belly: 0xece4ff, accent: 0x33f0a8, pants: 0x1d1838, tone: 0xf7d7b5, accessory: 'hood',       unlockXp: 700 },
  { id: 'koraal',  name: 'Reef',   body: 0x14b8c8, belly: 0xd6fbff, accent: 0xff5d73, pants: 0x1b2b40, tone: 0x6b4430, accessory: 'bandana',    unlockXp: 1200 },
  { id: 'munt',    name: 'Glitch', body: 0x2a3150, belly: 0x9af3ff, accent: 0x33f0a8, pants: 0x161b30, tone: 0xe0a982, accessory: 'shades',     unlockXp: 2000 },
];

// Exclusief personage: alleen te verdienen met een dagreeks van 7 dagen.
export const STREAK_SKIN = { id: 'zonnestraal', name: 'Solaris', body: 0xffffff, belly: 0xffe58a, accent: 0xffb400, pants: 0x2a3150, tone: 0xc68863, accessory: 'crown', streakDays: 7 };

export const getSkin = (id) => SKINS.find((s) => s.id === id) || (id === STREAK_SKIN.id ? STREAK_SKIN : SKINS[0]);
