// Тайловые карты биомов: '#' стена, '.' пол.
// Боевые биомы — процедурная генерация (комнаты+коридоры), детерминированная
// по seed на биом (см. src/data/proceduralMap.js). Деревня — фиксированная
// ручная карта: это единственное спокойное "хаб"-место без боёв.
import { BIOMES } from './vocab.js';
import { generateDungeon } from './proceduralMap.js';

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
};

// Деревня не входит в BIOMES (нет боевых слов), но WorldScene ожидает
// {label, background, words} для любой локации — этим и закрываем разрыв.
export const VILLAGE_INFO = { label: 'Деревня', background: 'background_village' };

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
