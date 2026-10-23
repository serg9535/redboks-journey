import { COLORS } from '../ui/theme.js';

const DIRS = [
  { dx: 0, dy: -1, dCol: 0, dRow: -1, angle: -Math.PI / 2 },
  { dx: 0, dy: 1, dCol: 0, dRow: 1, angle: Math.PI / 2 },
  { dx: -1, dy: 0, dCol: -1, dRow: 0, angle: Math.PI },
  { dx: 1, dy: 0, dCol: 1, dRow: 0, angle: 0 },
];

// Экранный D-pad. Включён всегда (а не по детекту тача): device.input.touch
// ненадёжен в мобильных вебвью, а с мышью кнопки тоже работают.
// direction — текущее зажатое направление (update() сцены шагает, пока держат).
export class TouchControls {
  constructor(scene, layer, { x, y, onPress }) {
    this.direction = null;
    const gap = 60;
    const size = 54;

    DIRS.forEach(({ dx, dy, dCol, dRow, angle }) => {
      const bx = x + dx * gap;
      const by = y + dy * gap;
      const g = scene.add.graphics().setDepth(25);
      const draw = (pressed) => {
        g.clear();
        g.fillStyle(COLORS.ink, 0.55).fillRoundedRect(bx - size / 2 - 3, by - size / 2 - 3, size + 6, size + 6, 16);
        g.fillStyle(pressed ? COLORS.sun : COLORS.cream, pressed ? 0.95 : 0.7).fillRoundedRect(bx - size / 2, by - size / 2, size, size, 14);
        const r = 13;
        const pt = (a, d) => [bx + Math.cos(angle + a) * d, by + Math.sin(angle + a) * d];
        const [ax, ay] = pt(0, r);
        const [bx2, by2] = pt(2.3, r);
        const [cx, cy] = pt(-2.3, r);
        g.fillStyle(COLORS.ink, 0.9).fillTriangle(ax, ay, bx2, by2, cx, cy);
      };
      draw(false);

      const zone = scene.add.zone(bx, by, size, size).setInteractive({ useHandCursor: true });
      layer.add([g, zone]);

      zone.on('pointerdown', () => {
        this.direction = { dCol, dRow };
        draw(true);
        onPress(dCol, dRow);
      });
      const release = () => {
        if (this.direction?.dCol === dCol && this.direction?.dRow === dRow) this.direction = null;
        draw(false);
      };
      zone.on('pointerup', release);
      zone.on('pointerout', release);
    });
  }

  reset() {
    this.direction = null;
  }
}
