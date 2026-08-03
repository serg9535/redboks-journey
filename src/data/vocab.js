// Словарь по биомам: каждый монстр биома привязан к английскому слову.
// sprite — имя кадра из public/assets/sprites/<biome>_NN.png (см. manifest.json)
export const BIOMES = {
  forest: {
    label: 'Лесная поляна',
    background: 'background_forest',
    words: [
      { sprite: 'forest_00', word: 'sprout' },
      { sprite: 'forest_01', word: 'mushroom' },
      { sprite: 'forest_02', word: 'bat' },
      { sprite: 'forest_03', word: 'tree' },
      { sprite: 'forest_04', word: 'leaf' },
      { sprite: 'forest_05', word: 'bee' },
      { sprite: 'forest_06', word: 'berry' },
    ],
  },
  desert: {
    label: 'Пустыня',
    background: 'background_desert',
    words: [
      { sprite: 'desert_00', word: 'sand' },
      { sprite: 'desert_01', word: 'scorpion' },
      { sprite: 'desert_02', word: 'sun' },
      { sprite: 'desert_03', word: 'rock' },
      { sprite: 'desert_04', word: 'cactus' },
      { sprite: 'desert_05', word: 'wind' },
    ],
  },
  cave: {
    label: 'Пещера',
    background: 'background_cave',
    words: [
      { sprite: 'cave_00', word: 'rock' },
      { sprite: 'cave_01', word: 'bat' },
      { sprite: 'cave_02', word: 'crystal' },
      { sprite: 'cave_03', word: 'spider' },
      { sprite: 'cave_04', word: 'troll' },
      { sprite: 'cave_05', word: 'mole' },
      { sprite: 'cave_06', word: 'worm' },
    ],
  },
  ocean: {
    label: 'Океан',
    background: 'background_ocean',
    words: [
      { sprite: 'ocean_00', word: 'shark' },
      { sprite: 'ocean_01', word: 'crab' },
      { sprite: 'ocean_02', word: 'jellyfish' },
      { sprite: 'ocean_03', word: 'octopus' },
      { sprite: 'ocean_04', word: 'coral' },
      { sprite: 'ocean_05', word: 'fish' },
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
