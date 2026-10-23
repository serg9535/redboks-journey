// Единый реестр всех локаций игры: боевые биомы (слова из vocab.js) и мирные
// локации (NPC из npcs.js). Сцены работают только через getLocation(), не
// различая источники данных по имени.
//
// palette — цвета стен под фон локации (чтобы стены не были одинаковой
// фиолетовой плашкой во всех биомах): wall — основная масса, top — светлая
// кромка сверху, face — «передняя грань» над полом, edge — тёмный контур.
import { BIOMES } from './vocab.js';
import { MAPS } from './maps.js';

const PALETTES = {
  forest: { wall: 0x3d6b2c, top: 0x6aa140, face: 0x2a4a1f, edge: 0x16290f, speck: 0x2f5722 },
  desert: { wall: 0xc4773a, top: 0xf0a65a, face: 0x8f4f22, edge: 0x4f2a10, speck: 0xa9622c },
  cave: { wall: 0x3a3546, top: 0x5f5873, face: 0x24202e, edge: 0x110e17, speck: 0x6a4f9c },
  ocean: { wall: 0x2a6f99, top: 0x56acd6, face: 0x1b4c6b, edge: 0x0c2638, speck: 0x3b8bb8 },
  robots: { wall: 0x4a5560, top: 0x7c8a96, face: 0x2f373f, edge: 0x15191d, speck: 0x3fd0e0 },
  village: { wall: 0x8a6440, top: 0xb88a5a, face: 0x5e4129, edge: 0x2e1f12, speck: 0x9c9488 },
  meadow: { wall: 0x4f8f35, top: 0x86c95a, face: 0x356524, edge: 0x1a3311, speck: 0xffd34d },
};

const PEACEFUL = {
  village: { label: 'Деревня', background: 'background_village' },
  meadow: { label: 'Цветочная поляна', background: 'background_meadow' },
};

export const BATTLE_KEYS = Object.keys(BIOMES);
export const PEACEFUL_KEYS = Object.keys(PEACEFUL);
export const ALL_LOCATION_KEYS = [...BATTLE_KEYS, ...PEACEFUL_KEYS];

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
    palette: PALETTES[key] ?? PALETTES.forest,
    map: MAPS[key],
  };
}

export const ALL_BACKGROUNDS = ALL_LOCATION_KEYS.map((key) => getLocation(key).background);
