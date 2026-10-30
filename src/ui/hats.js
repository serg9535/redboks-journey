import { COLORS } from './theme.js';

// Шапки для Redbok'а (магазин у Торговца Пузыря). Каждая шапка — ещё одно
// английское слово. Рисуются графикой «кубиками» с тёмной обводкой, как
// пиксель-арт спрайтов, — отдельные картинки под них не нужны.
export const HATS = [
  { id: 'cap', word: 'cap', ru: 'кепка', price: 5 },
  { id: 'flower', word: 'flower', ru: 'цветок', price: 5 },
  { id: 'bow', word: 'bow', ru: 'бантик', price: 8 },
  { id: 'hat', word: 'hat', ru: 'шляпа', price: 10 },
  { id: 'crown', word: 'crown', ru: 'корона', price: 15 },
];

// (0,0) — середина нижнего края шапки; w — ширина. Рисует в g «поверх» уже нарисованного.
export function drawHat(g, id, w) {
  const u = w / 12; // «пиксель» шапки
  const ink = COLORS.ink;
  const box = (x, y, bw, bh, color) => {
    g.fillStyle(ink, 1).fillRect((x - 0.5) * u, (y - 0.5) * u, (bw + 1) * u, (bh + 1) * u);
    g.fillStyle(color, 1).fillRect(x * u, y * u, bw * u, bh * u);
  };

  if (id === 'cap') {
    box(-5, -5, 10, 5, COLORS.berry);
    box(3, -1.5, 6, 1.5, COLORS.berryShade);
    g.fillStyle(0xffffff, 0.4).fillRect(-4 * u, -4.5 * u, 3 * u, 1 * u);
    box(-0.75, -6, 1.5, 1, COLORS.cream);
  } else if (id === 'flower') {
    const petal = (dx, dy) => box(dx - 1.5, dy - 1.5, 3, 3, 0xff8fc8);
    petal(0, -8);
    petal(-3, -5);
    petal(3, -5);
    petal(-2, -2);
    petal(2, -2);
    box(-1.5, -6.5, 3, 3, COLORS.sun);
  } else if (id === 'bow') {
    box(-6, -5, 5, 5, 0xff5fa2);
    box(1, -5, 5, 5, 0xff5fa2);
    box(-1.5, -4, 3, 3, 0xd23a7f);
  } else if (id === 'hat') {
    box(-7, -1.5, 14, 1.5, 0x7a4fc0);
    box(-4, -9, 8, 7.5, 0x7a4fc0);
    box(-4, -3.5, 8, 1.5, COLORS.sun);
  } else if (id === 'crown') {
    box(-5, -4, 10, 4, COLORS.sun);
    box(-5, -7, 2, 3, COLORS.sun);
    box(-1, -8, 2, 4, COLORS.sun);
    box(3, -7, 2, 3, COLORS.sun);
    g.fillStyle(COLORS.berry, 1).fillRect(-0.75 * u, -2.75 * u, 1.5 * u, 1.5 * u);
    g.fillStyle(COLORS.sky, 1).fillRect(-3.5 * u, -2.75 * u, 1.5 * u, 1.5 * u).fillRect(2 * u, -2.75 * u, 1.5 * u, 1.5 * u);
  }
  return g;
}

// Шапка на спрайте Redbok'а: верх «помидора» примерно на 20% высоты кадра.
export function placeHat(hat, sprite) {
  if (!hat) return;
  hat.setPosition(sprite.x, sprite.y - sprite.displayHeight * 0.3).setScale(sprite.flipX ? -1 : 1, 1);
}
