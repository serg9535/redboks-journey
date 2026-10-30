// Особые Боссы биомов (по заказу сына — первый, Лесной Король): свой спрайт вместо
// «монстра в короне» и арсенал. Каждый раунд Босс достаёт следующее оружие из
// weapons и стреляет: снаряд (fx) летит к Redbok'у, пока идёт таймер, — успел
// ответить, снаряд разбивается. Победа отдаёт одно оружие арсенала (trophy в items.js).
export const BOSSES = {
  forest: {
    sprite: 'boss_forest',
    name: 'Лесной Король',
    weapons: [
      { id: 'crystal_gun', word: 'crystal gun', fx: 'fx_crystal', spin: true },
      { id: 'tornado_gun', word: 'hurricane', fx: 'fx_tornado', wobble: true },
      { id: 'blower', word: 'wind blower', fx: 'fx_wind', wobble: true, big: true },
      { id: 'berry_gun', word: 'berry gun', fx: 'fx_berry', spin: true },
      { id: 'sword', word: 'sword', fx: 'item_sword', spin: true },
    ],
  },
};

// Фазы любого Босса: раунды по очереди, каждый верный ответ — минус сердечко Босса.
// word — кого он позвал; color — какого цвета клякса; odd — что лишнее (картинки).
export const BOSS_PHASES = ['word', 'color', 'word', 'odd', 'word'];
