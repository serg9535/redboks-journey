// Снаряжение Redbok'а (рюкзак и магазин Пузыря). Каждый предмет — английское слово
// со спрайтом item_<id> (Gemini web, запасной вариант — scripts/draw_items.py).
//
// Оружие надевается одно (progress.weapon) и меняет бой (BattleScene) по effect:
// - super  — суперудар уже со 2-го верного ответа подряд (без оружия — с 3-го);
// - time   — +4 с на таймер «монстр готовит атаку»;
// - remove — раз за бой убирает один неверный вариант (кнопка с оружием);
// - shield — первая ошибка в бою не отнимает сердечко;
// - heart  — +1 сердечко в начале боя.
// trophy — не продаётся, выпадает из Босса биома (см. BOSSES в data/bosses.js).
// Зелья — расходники, пьются в бою кнопками слева.
export const WEAPONS = [
  { id: 'sword', word: 'sword', ru: 'меч', price: 10, effect: 'super', info: 'Суперудар быстрее' },
  { id: 'bow', word: 'bow', ru: 'лук', price: 12, effect: 'time', info: 'Больше времени' },
  { id: 'wand', word: 'wand', ru: 'волшебная палочка', price: 15, effect: 'remove', info: 'Убирает лишнее слово' },
  { id: 'shield', word: 'shield', ru: 'щит', price: 12, effect: 'shield', info: 'Первая ошибка не страшна' },
  { id: 'crystal_gun', word: 'crystal gun', ru: 'кристальный пистолет', trophy: 'forest', effect: 'super', info: 'Кидает кристаллы: суперудар быстрее' },
  { id: 'tornado_gun', word: 'hurricane', ru: 'ураган', trophy: 'forest', effect: 'remove', info: 'Ураган сдувает лишнее слово' },
  { id: 'blower', word: 'wind blower', ru: 'ветродуй', trophy: 'forest', effect: 'time', info: 'Сдувает атаку: больше времени' },
  { id: 'berry_gun', word: 'berry gun', ru: 'ягодное ружьё', trophy: 'forest', effect: 'heart', info: 'Ягоды: +1 сердечко' },
];

export const POTIONS = [
  { id: 'red', sprite: 'item_potion_red', word: 'red potion', ru: 'красное зелье', price: 3, info: '+1 сердечко' },
  { id: 'blue', sprite: 'item_potion_blue', word: 'blue potion', ru: 'синее зелье', price: 3, info: 'Подсказка' },
  { id: 'green', sprite: 'item_potion_green', word: 'green potion', ru: 'зелёное зелье', price: 3, info: 'Время стоит' },
];

export const SHOP_WEAPONS = WEAPONS.filter((w) => !w.trophy);
export const weaponSprite = (id) => `item_${id}`;
export const weaponEffect = (id) => WEAPONS.find((w) => w.id === id)?.effect ?? null;

// Питомцы ходят за Redbok'ом по карте (progress.pet), покупаются у Пузыря.
export const PETS = [
  { id: 'puppy', sprite: 'pet_puppy', word: 'puppy', ru: 'щенок', price: 20 },
  { id: 'kitten', sprite: 'pet_kitten', word: 'kitten', ru: 'котёнок', price: 20 },
  { id: 'chick', sprite: 'pet_chick', word: 'chick', ru: 'цыплёнок', price: 15 },
];

export const ITEM_SPRITES = [
  ...WEAPONS.map((w) => weaponSprite(w.id)),
  ...POTIONS.map((p) => p.sprite),
  ...PETS.map((p) => p.sprite),
  'item_backpack',
  'item_map',
  'item_hammer',
  'item_key',
  'item_torch',
  'item_basket',
  'item_box',
  'fx_crystal',
  'fx_tornado',
  'fx_wind',
  'fx_berry',
  'boss_forest',
];
