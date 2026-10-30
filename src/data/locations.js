// Единый реестр всех локаций игры: боевые биомы (слова из vocab.js) и мирные
// локации (NPC из npcs.js). Сцены работают только через getLocation(), не
// различая источники данных по имени.
//
// palette — цвета стен под фон локации (чтобы стены не были одинаковой
// фиолетовой плашкой во всех биомах): wall — основная масса, top — светлая
// кромка сверху, face — «передняя грань» над полом, edge — тёмный контур.
import { BIOMES } from './vocab.js';
import { MAPS, biomeMap } from './maps.js';
import { getClears } from './progress.js';

const PALETTES = {
  forest: { wall: 0x3d6b2c, top: 0x6aa140, face: 0x2a4a1f, edge: 0x16290f, speck: 0x2f5722 },
  desert: { wall: 0xc4773a, top: 0xf0a65a, face: 0x8f4f22, edge: 0x4f2a10, speck: 0xa9622c },
  cave: { wall: 0x3a3546, top: 0x5f5873, face: 0x24202e, edge: 0x110e17, speck: 0x6a4f9c },
  ocean: { wall: 0x2a6f99, top: 0x56acd6, face: 0x1b4c6b, edge: 0x0c2638, speck: 0x3b8bb8 },
  robots: { wall: 0x4a5560, top: 0x7c8a96, face: 0x2f373f, edge: 0x15191d, speck: 0x3fd0e0 },
  farm: { wall: 0x8a5a32, top: 0xc08a52, face: 0x5e3c20, edge: 0x2e1c0e, speck: 0x7bc950 },
  colors: { wall: 0x7a4fc0, top: 0xb08ae8, face: 0x55358c, edge: 0x2a1748, speck: 0xff8fc8 },
  food: { wall: 0xb5653a, top: 0xe8995e, face: 0x80431f, edge: 0x40200d, speck: 0xfff6e0 },
  winter: { wall: 0x7fa8d0, top: 0xd8ecff, face: 0x5a82ad, edge: 0x263e5c, speck: 0xffffff },
  home: { wall: 0x8c5a3a, top: 0xc48b5c, face: 0x613b24, edge: 0x301c10, speck: 0xe8553e },
  village: { wall: 0x8a6440, top: 0xb88a5a, face: 0x5e4129, edge: 0x2e1f12, speck: 0x9c9488 },
  meadow: { wall: 0x4f8f35, top: 0x86c95a, face: 0x356524, edge: 0x1a3311, speck: 0xffd34d },
  garden: { wall: 0x7a5232, top: 0xa8794c, face: 0x55381f, edge: 0x2a1a0d, speck: 0x8ccf5a },
  arena: { wall: 0x7a4fc0, top: 0xb08ae8, face: 0x55358c, edge: 0x2a1748, speck: 0xffc93c },
};

const PEACEFUL = {
  village: { label: 'Деревня', background: 'background_village' },
  meadow: { label: 'Цветочная поляна', background: 'background_meadow' },
  garden: { label: 'Огород', background: 'background_garden' },
  arena: { label: 'Арена', background: 'background_meadow' },
};

export const BATTLE_KEYS = Object.keys(BIOMES);
export const PEACEFUL_KEYS = Object.keys(PEACEFUL);
export const ALL_LOCATION_KEYS = [...BATTLE_KEYS, ...PEACEFUL_KEYS];

// Победа над Боссом в текущем заходе хранится в том же списке, что и
// побеждённые монстры (defeatedSprites), — под этим ключом.
export const bossKey = (biomeKey) => `boss:${biomeKey}`;

export function isPeaceful(key) {
  return key in PEACEFUL;
}

export function getLocation(key) {
  const peaceful = isPeaceful(key);
  const info = peaceful ? PEACEFUL[key] : BIOMES[key];
  return {
    key,
    peaceful,
    label: info.label,
    background: info.background,
    words: peaceful ? [] : info.words,
    // Босс биома — «король» из его же монстров (BIOMES[key].boss или первый).
    bossEntry: peaceful ? null : info.words.find((w) => w.sprite === info.boss) ?? info.words[0],
    palette: PALETTES[key] ?? PALETTES.forest,
    map: peaceful ? MAPS[key] : biomeMap(key, getClears(key)),
    // Тёмная локация: без факела туман видно только на 1 клетку.
    dark: key === 'cave',
  };
}

export const ALL_BACKGROUNDS = ALL_LOCATION_KEYS.map((key) => getLocation(key).background);
