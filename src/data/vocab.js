// Словарь по биомам: каждый монстр биома привязан к английскому слову.
// sprite — имя кадра из public/assets/sprites/<biome>_NN.png (см. manifest.json)
// ru — русский перевод, показывается опционально (см. src/data/settings.js)
export const BIOMES = {
  forest: {
    label: 'Лесная поляна',
    background: 'background_forest',
    words: [
      { sprite: 'forest_00', word: 'sprout', ru: 'росток' },
      { sprite: 'forest_01', word: 'mushroom', ru: 'гриб' },
      { sprite: 'forest_02', word: 'bat', ru: 'летучая мышь' },
      { sprite: 'forest_03', word: 'tree', ru: 'дерево' },
      { sprite: 'forest_04', word: 'leaf', ru: 'лист' },
      { sprite: 'forest_05', word: 'bee', ru: 'пчела' },
      { sprite: 'forest_06', word: 'berry', ru: 'ягода' },
    ],
  },
  desert: {
    label: 'Пустыня',
    background: 'background_desert',
    words: [
      { sprite: 'desert_00', word: 'sand', ru: 'песок' },
      { sprite: 'desert_01', word: 'scorpion', ru: 'скорпион' },
      { sprite: 'desert_02', word: 'sun', ru: 'солнце' },
      { sprite: 'desert_03', word: 'rock', ru: 'камень' },
      { sprite: 'desert_04', word: 'cactus', ru: 'кактус' },
      { sprite: 'desert_05', word: 'wind', ru: 'ветер' },
    ],
  },
  cave: {
    label: 'Пещера',
    background: 'background_cave',
    words: [
      { sprite: 'cave_00', word: 'rock', ru: 'камень' },
      { sprite: 'cave_01', word: 'bat', ru: 'летучая мышь' },
      { sprite: 'cave_02', word: 'crystal', ru: 'кристалл' },
      { sprite: 'cave_03', word: 'spider', ru: 'паук' },
      { sprite: 'cave_04', word: 'troll', ru: 'тролль' },
      { sprite: 'cave_05', word: 'mole', ru: 'крот' },
      { sprite: 'cave_06', word: 'worm', ru: 'червяк' },
    ],
  },
  ocean: {
    label: 'Океан',
    background: 'background_ocean',
    words: [
      { sprite: 'ocean_00', word: 'shark', ru: 'акула' },
      { sprite: 'ocean_01', word: 'crab', ru: 'краб' },
      { sprite: 'ocean_02', word: 'jellyfish', ru: 'медуза' },
      { sprite: 'ocean_03', word: 'octopus', ru: 'осьминог' },
      { sprite: 'ocean_04', word: 'coral', ru: 'коралл' },
      { sprite: 'ocean_05', word: 'fish', ru: 'рыба' },
    ],
  },
  robots: {
    label: 'Техно-планета',
    background: 'background_robots',
    words: [
      { sprite: 'robots_00', word: 'robot', ru: 'робот' },
      { sprite: 'robots_01', word: 'shield', ru: 'щит' },
      { sprite: 'robots_02', word: 'wing', ru: 'крыло' },
      { sprite: 'robots_03', word: 'antenna', ru: 'антенна' },
      { sprite: 'robots_04', word: 'rocket', ru: 'ракета' },
      { sprite: 'robots_05', word: 'laser', ru: 'лазер' },
    ],
  },
  farm: {
    label: 'Ферма',
    background: 'background_farm',
    words: [
      { sprite: 'farm_00', word: 'cat', ru: 'кошка' },
      { sprite: 'farm_01', word: 'dog', ru: 'собака' },
      { sprite: 'farm_02', word: 'cow', ru: 'корова' },
      { sprite: 'farm_03', word: 'pig', ru: 'свинья' },
      { sprite: 'farm_04', word: 'duck', ru: 'утка' },
      { sprite: 'farm_05', word: 'horse', ru: 'лошадь' },
    ],
  },
  colors: {
    label: 'Радуга',
    background: 'background_colors',
    // одинаковый слайм разного цвета (scripts/recolor_sprite.py) — отличается только цвет
    words: [
      { sprite: 'colors_00', word: 'red', ru: 'красный' },
      { sprite: 'colors_01', word: 'blue', ru: 'синий' },
      { sprite: 'colors_02', word: 'green', ru: 'зелёный' },
      { sprite: 'colors_03', word: 'yellow', ru: 'жёлтый' },
      { sprite: 'colors_04', word: 'purple', ru: 'фиолетовый' },
      { sprite: 'colors_05', word: 'orange', ru: 'оранжевый' },
    ],
  },
  food: {
    label: 'Кухня',
    background: 'background_food',
    words: [
      { sprite: 'food_00', word: 'apple', ru: 'яблоко' },
      { sprite: 'food_01', word: 'banana', ru: 'банан' },
      { sprite: 'food_02', word: 'egg', ru: 'яйцо' },
      { sprite: 'food_03', word: 'milk', ru: 'молоко' },
      { sprite: 'food_04', word: 'cake', ru: 'торт' },
      { sprite: 'food_05', word: 'carrot', ru: 'морковь' },
    ],
  },
  winter: {
    label: 'Зимний край',
    background: 'background_winter',
    words: [
      { sprite: 'winter_00', word: 'snowman', ru: 'снеговик' },
      { sprite: 'winter_01', word: 'penguin', ru: 'пингвин' },
      { sprite: 'winter_02', word: 'snowflake', ru: 'снежинка' },
      { sprite: 'winter_03', word: 'bear', ru: 'медведь' },
      { sprite: 'winter_04', word: 'ice', ru: 'лёд' },
      { sprite: 'winter_05', word: 'fox', ru: 'лиса' },
    ],
  },
  home: {
    label: 'Домик',
    background: 'background_home',
    words: [
      { sprite: 'home_00', word: 'ball', ru: 'мяч' },
      { sprite: 'home_01', word: 'cup', ru: 'чашка' },
      { sprite: 'home_02', word: 'bed', ru: 'кровать' },
      { sprite: 'home_03', word: 'lamp', ru: 'лампа' },
      { sprite: 'home_04', word: 'book', ru: 'книга' },
      { sprite: 'home_05', word: 'chair', ru: 'стул' },
    ],
  },
};

// Без дублей: 'rock' и 'bat' встречаются в двух биомах.
export const ALL_WORDS = [...new Set(Object.values(BIOMES).flatMap((b) => b.words.map((w) => w.word)))];

export const ALL_ENTRIES = Object.values(BIOMES).flatMap((b) => b.words);

// count разных по слову записей (картинок), среди них correct, в случайном порядке.
export function randomEntries(correct, count = 3) {
  const pool = ALL_ENTRIES.filter((e) => e.word !== correct.word);
  const picked = [correct];
  while (picked.length < count && pool.length > 0) {
    const [e] = pool.splice(Math.floor(Math.random() * pool.length), 1);
    if (!picked.some((p) => p.word === e.word)) picked.push(e);
  }
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }
  return picked;
}

export function randomChoices(correctWord, count = 3) {
  const pool = ALL_WORDS.filter((w) => w !== correctWord);
  const picked = [];
  while (picked.length < count - 1 && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    const [w] = pool.splice(idx, 1);
    if (!picked.includes(w)) picked.push(w);
  }
  const choices = [...picked, correctWord];
  // shuffle
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return choices;
}
