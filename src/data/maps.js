// Тайловые карты биомов: '#' стена, '.' пол.
// Боевые биомы — процедурная генерация (комнаты+коридоры), детерминированная
// по seed на биом (см. src/data/proceduralMap.js). Деревня и поляна —
// фиксированные ручные карты: это спокойные "хаб"-места без боёв, там важна
// конкретная расстановка NPC, а не процедурность.
import { BIOMES } from './vocab.js';
import { generateDungeon } from './proceduralMap.js';
import { VILLAGE_NPCS, MEADOW_NPCS } from './npcs.js';

export const TILE_SIZE = 48;

// Разные seed → разная форма карты у каждого биома, но карта одного и того
// же биома стабильна между заходами (не "плывёт" под уже собранным туманом
// войны игрока).
const BIOME_SEEDS = {
  forest: 1001,
  desert: 2002,
  cave: 3003,
  ocean: 4004,
  robots: 5005,
};

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

export const MAPS = {};
for (const key of Object.keys(BIOMES)) {
  const monsterCount = BIOMES[key].words.length;
  const seed = BIOME_SEEDS[key] ?? hashSeed(key);
  MAPS[key] = generateDungeon({ seed, monsterCount });
}

const VILLAGE_LAYOUT = [
  '##############',
  '#............#',
  '#............#',
  '#....####....#',
  '#....#..#....#',
  '#....####....#',
  '#............#',
  '#............#',
  '#............#',
  '##############',
];

MAPS.village = {
  layout: VILLAGE_LAYOUT,
  playerStart: { col: 7, row: 8 },
  npcTiles: [
    { col: 3, row: 2 },
    { col: 10, row: 2 },
    { col: 7, row: 7 },
  ],
  npcs: VILLAGE_NPCS,
  // тайл-портал: наступил — переход в другую мирную локацию (см. attemptMove
  // в WorldScene). spawnAt — где игрок появится на карте назначения.
  portals: [{ col: 1, row: 8, to: 'meadow', spawnAt: { col: 2, row: 6 } }],
};

const MEADOW_LAYOUT = [
  '##############',
  '#............#',
  '#............#',
  '#............#',
  '#............#',
  '#............#',
  '#............#',
  '##############',
];

MAPS.meadow = {
  layout: MEADOW_LAYOUT,
  playerStart: { col: 7, row: 4 },
  npcTiles: [
    { col: 4, row: 2 },
    { col: 10, row: 2 },
    { col: 7, row: 5 },
  ],
  npcs: MEADOW_NPCS,
  portals: [{ col: 1, row: 6, to: 'village', spawnAt: { col: 2, row: 8 } }],
};

// Деревня и поляна не входят в BIOMES (нет боевых слов), но WorldScene
// ожидает {label, background, words} для любой локации — этим и закрываем
// разрыв. PEACEFUL_LOCATIONS перечисляет все небоевые локации разом, чтобы
// WorldScene (dev-панель, проверка "это бой или диалог") не хардкодила
// каждую по имени.
export const VILLAGE_INFO = { label: 'Деревня', background: 'background_village' };
export const MEADOW_INFO = { label: 'Цветочная поляна', background: 'background_meadow' };
export const PEACEFUL_LOCATIONS = { village: VILLAGE_INFO, meadow: MEADOW_INFO };

export function isWalkable(layout, col, row) {
  const row_ = layout[row];
  if (!row_ || col < 0 || col >= row_.length) return false;
  return row_[col] === '.';
}

export function mapPixelSize(layout) {
  return {
    width: layout[0].length * TILE_SIZE,
    height: layout.length * TILE_SIZE,
  };
}
