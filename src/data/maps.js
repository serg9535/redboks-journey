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

export const MAPS = {
  forest: {
    layout: FOREST_LAYOUT,
    playerStart: { col: 3, row: 3 },
    // индексы соответствуют порядку BIOMES.forest.words в vocab.js
    monsterTiles: [
      { col: 2, row: 2 },
      { col: 5, row: 4 },
      { col: 15, row: 2 },
      { col: 16, row: 4 },
      { col: 4, row: 9 },
      { col: 9, row: 9 },
      { col: 14, row: 9 },
    ],
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
