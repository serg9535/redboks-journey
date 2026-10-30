import { BIOMES } from './vocab.js';

// Жители мирных локаций (деревня, поляна) — не бойцы, при встрече открывают
// диалог вместо боя. Реплики на русском с вкраплениями английских слов
// (ЗАГЛАВНЫМИ, с переводом в скобках) — тот же принцип "картинка/слово +
// перевод", что и в бою, но в форме простого разговора.
// Каждая мирная локация держит свой список — см. MAPS.<location>.npcs в maps.js.
export const VILLAGE_NPCS = [
  {
    id: 'elder',
    sprite: 'npc_elder',
    name: 'Старейшина Мосс',
    lines: [
      'Здравствуй, юный герой! Добро пожаловать в нашу деревню.',
      'Когда-то с неба прилетели чужаки — теперь их ROBOT (робот) можно встретить на техно-планете.',
      'Иди и находи новые слова — это сделает тебя сильнее!',
    ],
  },
  {
    id: 'merchant',
    sprite: 'npc_merchant',
    name: 'Торговец Пузырь',
    // после разговора открывается магазин шапок (ShopScene)
    shop: true,
    lines: [
      'О, гость! У меня лучший в округе CACTUS (кактус) — привезён прямиком из пустыни.',
      'А ещё торгую CORAL (коралл) с самого дна океана, если доберёшься дотуда.',
      'А ещё у меня есть шапки, оружие и зелья! Плати звёздами ★ — посмотри, что нравится.',
    ],
  },
  {
    id: 'teacher',
    sprite: 'npc_teacher',
    name: 'Учитель Лист',
    // answer — вопрос «на знание»: right/wrong — ответы жителя.
    talk: [
      { q: 'Which one is big: a COW or a BEE?', options: ['cow', 'bee'], answer: 'cow', right: 'Yes! A COW is big.', wrong: 'No, a COW is big. A BEE is small.' },
      { q: 'Which one can fly: a BAT or a PIG?', options: ['bat', 'pig'], answer: 'bat', right: 'Yes! A BAT can fly.', wrong: 'A BAT can fly. A PIG can not.' },
      { q: 'Which one lives in the sea: a SHARK or a FOX?', options: ['shark', 'fox'], answer: 'shark', right: 'Yes! A SHARK lives in the sea.', wrong: 'A SHARK lives in the sea.' },
      { q: 'Which one is cold: ICE or the SUN?', options: ['ice', 'sun'], answer: 'ice', right: 'Brr! ICE is cold.', wrong: 'ICE is cold. The SUN is hot.' },
    ],
    lines: [
      'Здравствуй! Давай проверим твои знания английского.',
      'Помнишь, что такое SHARK? По-русски — акула, большая рыба с острыми зубами!',
      'А в пещере тебя ждёт CRYSTAL (кристалл) — очень красивый камень.',
      'Продолжай в том же духе, у тебя отлично получается!',
    ],
  },
  {
    id: 'melon',
    sprite: 'npc_melon',
    name: 'Огородник Дыня',
    // Диалог с выбором (TalkScene): q — вопрос, options — слова-картинки, reply — ответ ({a}, {word}).
    talk: [
      { q: 'Do you want an APPLE or a BANANA?', options: ['apple', 'banana'], reply: 'Here you are! {a} {word}!' },
      { q: 'Do you want a CARROT or a CAKE?', options: ['carrot', 'cake'], reply: 'Yummy! Here is {a} {word}!' },
      { q: 'Milk or an egg for breakfast?', options: ['milk', 'egg'], reply: 'Good choice: {word}!' },
    ],
    lines: [
      'Привет, сосед! Я весь из огорода. Моё туловище — MELON (дыня)!',
      'А голова у меня — TOMATO (помидор), совсем как ты!',
      'Руки — это CUCUMBER (огурец), целых два. Хрум-хрум!',
      'А ноги из CABBAGE (капуста) — мягкие, как листики.',
      'Ешь овощи — и будешь сильным, как я!',
    ],
  },
];

export const MEADOW_NPCS = [
  {
    id: 'bee',
    sprite: 'npc_bee',
    name: 'Пчёлка Жужа',
    lines: [
      'Жжж! Привет! Видишь этот BEE (пчела)? Это я!',
      'Я живу среди FLOWER (цветок) — здесь их сотни, выбирай любой.',
      'Возвращайся, когда соберёшь мёд из новых английских слов!',
    ],
  },
  {
    id: 'butterfly',
    sprite: 'npc_butterfly',
    name: 'Бабочка Искра',
    talk: [
      { q: 'What is your favourite colour: RED, BLUE or GREEN?', options: ['red', 'blue', 'green'], reply: 'Wow! I love {word} too!' },
      { q: 'Do you like a DOG or a CAT?', options: ['dog', 'cat'], reply: 'Me too! {a} {word} is my friend!' },
    ],
    lines: [
      'Привет! Я BUTTERFLY (бабочка) — а ты кто?',
      'Я летаю над этим GARDEN (сад) целый день и никогда не устаю.',
      'До встречи — лети, куда глаза глядят, как я!',
    ],
  },
  {
    id: 'rabbit',
    sprite: 'npc_rabbit',
    name: 'Кролик Клевер',
    lines: [
      'Здравствуй! Я RABBIT (кролик), а это моё любимое место.',
      'Мы называем его MEADOW (луг) — тут мягкая трава и много друзей.',
      'Заходи ещё поиграть на лугу!',
    ],
  },
];

export const ALL_NPCS = [...VILLAGE_NPCS, ...MEADOW_NPCS];

// Спасённые жители: после победы над Боссом биома первый монстр этого биома
// переезжает в деревню (MAPS.village.rescueTiles) и рассказывает о своих друзьях.
export function rescuedNpcs(defeatedBosses) {
  return Object.entries(BIOMES)
    .filter(([key]) => defeatedBosses.has(key))
    .map(([key, biome]) => {
      const [me, ...friends] = biome.words;
      const named = friends.slice(0, 3).map((f) => `${f.word.toUpperCase()} (${f.ru})`).join(', ');
      return {
        id: `rescued_${key}`,
        sprite: me.sprite,
        name: `${me.word.toUpperCase()} из биома «${biome.label}»`,
        lines: [
          `Привет! Я ${me.word.toUpperCase()} (${me.ru}). Ты победил Босса — теперь я живу в деревне!`,
          `Мои друзья остались дома: ${named}. Навещай их!`,
        ],
      };
    });
}
