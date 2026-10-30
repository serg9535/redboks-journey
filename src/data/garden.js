// Огород (мирная локация garden): грядки на карте — MAPS.garden.plotTiles.
// Цикл грядки: пусто → посадить (выбор из трёх культур, слово озвучивается) → полить
// (росток → куст) → полить (куст → урожай) → собрать: «Что выросло?» — выбрать слово из
// трёх, как в бою (этап Production). Без таймеров, энергии и штрафов: растение растёт сразу
// от полива — пятилетнему не нужно ждать или планировать. Состояние грядок — progress.garden.
export const CROPS = [
  { id: 'tomato', word: 'tomato', ru: 'помидор' },
  { id: 'carrot', word: 'carrot', ru: 'морковь' },
  { id: 'cucumber', word: 'cucumber', ru: 'огурец' },
  { id: 'cabbage', word: 'cabbage', ru: 'капуста' },
  { id: 'melon', word: 'melon', ru: 'дыня' },
  { id: 'pumpkin', word: 'pumpkin', ru: 'тыква' },
];

export const RIPE_STAGE = 2;

// stage 0 — общий для всех росток; 1 — молодое растение; 2 — спелый урожай (с мордашкой)
export const cropSprite = (cropId, stage) => (stage === 0 ? 'garden_seedling' : `garden_${cropId}_${stage}`);

export const ALL_GARDEN_SPRITES = ['garden_seedling', ...CROPS.flatMap((c) => [cropSprite(c.id, 1), cropSprite(c.id, 2)])];

export const getCrop = (id) => CROPS.find((c) => c.id === id);
