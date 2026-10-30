import { bumpDaily } from '../data/progress.js';
import { COLORS, outlinedTextStyle, textStyle } from './theme.js';
import { Button, drawPanel } from './widgets.js';

// Каркас оверлея поверх WorldScene (мини-игры Арены): затемнение, шапка с
// заголовком, строка счёта по центру, кнопка «Закрыть». Возвращает { w, h, score, message }.
export function buildOverlay(scene, title) {
  const w = scene.scale.width;
  const h = scene.scale.height;
  scene.add.rectangle(0, 0, w, h, COLORS.night, 0.88).setOrigin(0, 0).setInteractive();
  drawPanel(scene.add.graphics(), 12, 10, w - 24, 52, { radius: 16 });
  scene.add.text(32, 36, title, textStyle(26, COLORS.berryShade)).setOrigin(0, 0.5);
  const score = scene.add.text(w / 2 + 60, 36, '', textStyle(20)).setOrigin(0.5);
  new Button(scene, { x: w - 92, y: 36, width: 140, height: 40, label: 'Закрыть', fontSize: 18, variant: 'bad', onClick: () => closeOverlay(scene) });
  const message = scene.add.text(w / 2, h - 34, '', outlinedTextStyle(22)).setOrigin(0.5).setDepth(10);
  return { w, h, score, message };
}

export function closeOverlay(scene) {
  scene.closed = true;
  scene.scene.stop();
  scene.scene.resume('World');
}

// Конец попытки в мини-игре: считается для задания дня.
export const arenaPlayed = () => bumpDaily('arena');

// Кнопка «Ещё раз» внизу по центру (скрыта, пока попытка идёт).
export function againButton(scene, onClick) {
  return new Button(scene, { x: scene.scale.width / 2, y: scene.scale.height - 34, width: 220, height: 54, label: 'Ещё раз', fontSize: 22, variant: 'good', onClick }).setVisible(false).setDepth(11);
}
