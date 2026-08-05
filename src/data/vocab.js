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
};

export const ALL_WORDS = Object.values(BIOMES).flatMap((b) => b.words.map((w) => w.word));

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
