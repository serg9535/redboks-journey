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
  farm: 6006,
  colors: 7007,
  food: 8008,
  winter: 9009,
  home: 1010,
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

// Повтор пройденного биома — новая карта: seed сдвигается на номер зачистки
// (стабильна в пределах одной «зачистки», чтобы не плыть под туманом).
const variants = {};
export function biomeMap(key, variant) {
  if (!variant) return MAPS[key];
  const id = `${key}:${variant}`;
  variants[id] ??= generateDungeon({ seed: (BIOME_SEEDS[key] ?? hashSeed(key)) + variant * 7919, monsterCount: BIOMES[key].words.length });
  return variants[id];
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
    { col: 7, row: 2 },
  ],
  npcs: VILLAGE_NPCS,
  // Запертая кладовая в центре деревни: дверь открывается KEY (ключом, progress.keys),
  // внутри — клад (treasureTiles, один раз). Открытая дверь становится полом.
  doors: [{ col: 6, row: 5, id: 'village_vault' }],
  treasureTiles: [{ col: 7, row: 4, id: 'village_vault_loot', stars: 10 }],
  // клетки для спасённых жителей биомов (см. rescuedNpcs в npcs.js), по одной на биом
  rescueTiles: [
    { col: 2, row: 4 },
    { col: 11, row: 4 },
    { col: 2, row: 6 },
    { col: 11, row: 6 },
    { col: 10, row: 8 },
    { col: 4, row: 8 },
  ],
  // тайл-портал: наступил — переход в другую мирную локацию (см. attemptMove
  // в WorldScene). spawnAt — где игрок появится на карте назначения.
  portals: [
    { col: 1, row: 8, to: 'meadow', spawnAt: { col: 2, row: 6 } },
    { col: 12, row: 8, to: 'garden', spawnAt: { col: 2, row: 7 } },
    { col: 12, row: 1, to: 'arena', spawnAt: { col: 2, row: 6 } },
  ],
};

// Игровая площадка: станции мини-игр (stationTiles) — бамп открывает сцену station.scene.
const ARENA_LAYOUT = [
  '#############',
  '#...........#',
  '#...........#',
  '#...........#',
  '#...........#',
  '#...........#',
  '#...........#',
  '#############',
];

MAPS.arena = {
  layout: ARENA_LAYOUT,
  playerStart: { col: 2, row: 6 },
  npcTiles: [],
  npcs: [],
  stationTiles: [
    { col: 2, row: 2, scene: 'Dictation', icon: 'item_map', label: 'Карта' },
    { col: 4, row: 2, scene: 'Memory', icon: 'item_box', label: 'Память' },
    { col: 6, row: 2, scene: 'Whack', icon: 'item_hammer', label: 'Молоток' },
    { col: 8, row: 2, scene: 'Stroop', icon: 'colors_00', label: 'Цвета' },
    { col: 10, row: 2, scene: 'Schulte', icon: 'item_shield', label: 'Числа' },
    { col: 2, row: 4, scene: 'Logic', icon: 'item_potion_green', label: 'Лишнее' },
    { col: 4, row: 4, scene: 'Fruits', icon: 'item_basket', label: 'Корзина' },
    { col: 6, row: 4, scene: 'SimonSays', icon: 'redbok_10', label: 'Саймон' },
    { col: 8, row: 4, scene: 'Phrase', icon: 'home_04', label: 'Фразы' },
    { col: 10, row: 4, scene: 'Rhythm', icon: 'item_wand', label: 'Ритм' },
    { col: 10, row: 6, scene: 'Tower', icon: 'item_sword', label: 'Башня' },
  ],
  portals: [{ col: 1, row: 6, to: 'village', spawnAt: { col: 11, row: 1 } }],
};

// Огород: грядки (plotTiles) — бамп по грядке открывает GardenScene (см. data/garden.js).
const GARDEN_LAYOUT = [
  '############',
  '#..........#',
  '#..........#',
  '#..........#',
  '#..........#',
  '#..........#',
  '#..........#',
  '#..........#',
  '############',
];

MAPS.garden = {
  layout: GARDEN_LAYOUT,
  playerStart: { col: 2, row: 7 },
  npcTiles: [],
  npcs: [],
  plotTiles: [
    { col: 3, row: 2 },
    { col: 5, row: 2 },
    { col: 7, row: 2 },
    { col: 3, row: 4 },
    { col: 5, row: 4 },
    { col: 7, row: 4 },
  ],
  portals: [{ col: 1, row: 7, to: 'village', spawnAt: { col: 11, row: 8 } }],
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
  // Цветы для поручений (quests: fetch): бамп срывает (+1 в progress.bag), до нового захода.
  pickTiles: [
    { col: 2, row: 1, item: 'flower_red' },
    { col: 6, row: 1, item: 'flower_red' },
    { col: 12, row: 3, item: 'flower_red' },
    { col: 8, row: 6, item: 'flower_red' },
    { col: 1, row: 3, item: 'flower_blue' },
    { col: 11, row: 6, item: 'flower_blue' },
    { col: 5, row: 4, item: 'flower_blue' },
    { col: 3, row: 5, item: 'flower_yellow' },
    { col: 9, row: 1, item: 'flower_yellow' },
    { col: 12, row: 1, item: 'flower_yellow' },
    { col: 9, row: 4, item: 'flower_yellow' },
    { col: 4, row: 6, item: 'flower_yellow' },
  ],
  portals: [{ col: 1, row: 6, to: 'village', spawnAt: { col: 2, row: 8 } }],
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
