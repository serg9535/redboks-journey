// Ручная тайловая карта: '#' стена, '.' пол.
// Комнаты соединены узкими коридорами — как в дандженкроулере, но без процедурной генерации.
export const TILE_SIZE = 48;

const FOREST_LAYOUT = [
  '####################',
  '#......######......#',
  '#......######......#',
  '#..................#',
  '#......######......#',
  '#......######......#',
  '###.############.###',
  '###.############.###',
  '#..................#',
  '#..................#',
  '#..................#',
  '#..................#',
  '####################',
];

// Общая раскладка комнат переиспользуется всеми биомами — визуальную
// идентичность даёт фон/спрайты биома, не форма карты (см. CLAUDE.md).
const SIX_MONSTER_TILES = [
  { col: 2, row: 2 },
  { col: 5, row: 4 },
  { col: 15, row: 2 },
  { col: 16, row: 4 },
  { col: 4, row: 9 },
  { col: 9, row: 9 },
];

export const MAPS = {
  forest: {
    layout: FOREST_LAYOUT,
    playerStart: { col: 3, row: 3 },
    // индексы соответствуют порядку BIOMES.forest.words в vocab.js
    monsterTiles: [...SIX_MONSTER_TILES, { col: 14, row: 9 }],
  },
  desert: {
    layout: FOREST_LAYOUT,
    playerStart: { col: 3, row: 3 },
    monsterTiles: SIX_MONSTER_TILES,
  },
  cave: {
    layout: FOREST_LAYOUT,
    playerStart: { col: 3, row: 3 },
    monsterTiles: [...SIX_MONSTER_TILES, { col: 14, row: 9 }],
  },
  ocean: {
    layout: FOREST_LAYOUT,
    playerStart: { col: 3, row: 3 },
    monsterTiles: SIX_MONSTER_TILES,
  },
  robots: {
    layout: FOREST_LAYOUT,
    playerStart: { col: 3, row: 3 },
    monsterTiles: SIX_MONSTER_TILES,
  },
};

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
