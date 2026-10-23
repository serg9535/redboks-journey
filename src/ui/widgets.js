import Phaser from 'phaser';
import { COLORS, textStyle } from './theme.js';

const VARIANTS = {
  primary: { face: COLORS.sun, shade: COLORS.sunShade, text: COLORS.ink },
  secondary: { face: COLORS.cream, shade: COLORS.creamShade, text: COLORS.ink },
  good: { face: COLORS.leaf, shade: COLORS.leafShade, text: COLORS.ink },
  bad: { face: COLORS.berry, shade: COLORS.berryShade, text: COLORS.cream },
  info: { face: COLORS.sky, shade: COLORS.skyShade, text: COLORS.ink },
  muted: { face: COLORS.grey, shade: COLORS.greyShade, text: COLORS.ink },
};

const DEPTH = 4;

// «Конфетная» кнопка: скруглённая плашка с тёмной обводкой и «толщиной» снизу,
// при нажатии проседает. Сама по себе Container, кладётся в любой слой.
export class Button extends Phaser.GameObjects.Container {
  constructor(scene, { x, y, width, height, label = '', variant = 'secondary', fontSize = 20, onClick, icon }) {
    super(scene, x, y);
    this.w = width;
    this.h = height;
    this.variant = variant;
    this.enabled = true;
    this.pressed = false;
    this.onClick = onClick;
    this.iconDrawer = icon;

    this.gfx = scene.add.graphics();
    this.label = scene.add.text(0, 0, label, textStyle(fontSize)).setOrigin(0.5);
    this.add([this.gfx, this.label]);
    this.redraw();

    this.setSize(width, height + DEPTH);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => {
      if (!this.enabled) return;
      this.setPressed(true);
      this.onClick?.();
    });
    this.on('pointerup', () => this.setPressed(false));
    this.on('pointerout', () => this.setPressed(false));
    scene.add.existing(this);
  }

  setPressed(pressed) {
    if (this.pressed === pressed) return;
    this.pressed = pressed;
    this.redraw();
  }

  setLabel(text) {
    this.label.setText(text);
    return this;
  }

  setVariant(variant) {
    this.variant = variant;
    this.redraw();
    return this;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.setAlpha(enabled ? 1 : 0.6);
    return this;
  }

  redraw() {
    const { face, shade, text } = VARIANTS[this.variant];
    const r = Math.min(16, this.h / 2);
    const w = this.w;
    const h = this.h;
    const lift = this.pressed ? 0 : DEPTH;
    const top = -h / 2 - DEPTH / 2 + (DEPTH - lift);
    const g = this.gfx.clear();

    g.fillStyle(COLORS.ink, 1).fillRoundedRect(-w / 2 - 3, -h / 2 - DEPTH / 2 - 3 + (DEPTH - lift), w + 6, h + lift + 6, r + 3);
    g.fillStyle(shade, 1).fillRoundedRect(-w / 2, top, w, h + lift, r);
    g.fillStyle(face, 1).fillRoundedRect(-w / 2, top, w, h, r);
    g.fillStyle(0xffffff, 0.35).fillRoundedRect(-w / 2 + 8, top + 5, w - 16, Math.max(4, h * 0.18), { tl: 6, tr: 6, bl: 3, br: 3 });

    const cy = top + h / 2;
    this.label.setY(cy).setColor(`#${text.toString(16).padStart(6, '0')}`);
    if (this.iconDrawer) this.iconDrawer(g, 0, cy, text);
  }
}

// Кремовая панель с обводкой — общая подложка для HUD, диалогов, оверлеев.
export function drawPanel(graphics, x, y, width, height, { fill = COLORS.cream, alpha = 0.96, radius = 18 } = {}) {
  graphics.fillStyle(COLORS.ink, 0.35).fillRoundedRect(x + 2, y + 5, width, height, radius);
  graphics.fillStyle(COLORS.ink, 1).fillRoundedRect(x - 3, y - 3, width + 6, height + 6, radius + 3);
  graphics.fillStyle(fill, alpha).fillRoundedRect(x, y, width, height, radius);
  return graphics;
}

// Иконка динамика рисуется графикой, а не эмодзи: эмодзи на разных
// устройствах выглядят по-разному и выбиваются из пиксель-арта.
export function drawSpeakerIcon(g, cx, cy, color, size = 22) {
  const s = size / 22;
  g.fillStyle(color, 1);
  g.fillRect(cx - 10 * s, cy - 4 * s, 6 * s, 8 * s);
  g.fillTriangle(cx - 5 * s, cy - 4 * s, cx + 2 * s, cy - 10 * s, cx + 2 * s, cy + 10 * s);
  g.fillTriangle(cx - 5 * s, cy - 4 * s, cx - 5 * s, cy + 4 * s, cx + 2 * s, cy + 10 * s);
  g.lineStyle(2.5 * s, color, 1);
  g.beginPath();
  g.arc(cx + 3 * s, cy, 6 * s, -0.9, 0.9);
  g.strokePath();
  g.beginPath();
  g.arc(cx + 3 * s, cy, 11 * s, -0.9, 0.9);
  g.strokePath();
}

// Ряд «сердечек»-кружков вместо эмодзи ❤/💥.
export function drawPips(graphics, cx, y, current, max, color, { size = 22, gap = 8 } = {}) {
  const total = max * size + (max - 1) * gap;
  let x = cx - total / 2;
  for (let i = 0; i < max; i++) {
    const full = i < current;
    graphics.fillStyle(COLORS.ink, 1).fillCircle(x + size / 2, y, size / 2 + 3);
    graphics.fillStyle(full ? color : COLORS.grey, 1).fillCircle(x + size / 2, y, size / 2);
    if (full) graphics.fillStyle(0xffffff, 0.45).fillCircle(x + size / 2 - size * 0.18, y - size * 0.18, size * 0.17);
    x += size + gap;
  }
  return graphics;
}
