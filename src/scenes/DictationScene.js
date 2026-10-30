import Phaser from 'phaser';
import { addStars, getRecord, submitRecord } from '../data/progress.js';
import { COLORS, fitSprite, outlinedTextStyle, textStyle } from '../ui/theme.js';
import { Button, drawPanel, drawSpeakerIcon } from '../ui/widgets.js';
import { speak } from '../ui/speech.js';
import { arenaPlayed } from '../ui/overlay.js';

const COLS = 7;
const ROWS = 5;
const CELL = 64;
const GRID = { x: 50, y: 160 };
const DIRS = {
  up: { dCol: 0, dRow: -1 },
  down: { dCol: 0, dRow: 1 },
  left: { dCol: -1, dRow: 0 },
  right: { dCol: 1, dRow: 0 },
};
const MEMORY_FROM = 5; // с этого уровня команды звучат все сразу и прячутся — идём по памяти
const ARROWS_UNTIL = 2; // до этого уровня на кнопках и в командах есть стрелки

// Графический диктант на английском (нейропсихология: пространство + слуховая
// память): Redbok идёт по клеткам под команды UP/DOWN/LEFT/RIGHT и находит клад.
// Уровень = число команд + 1; со 3-го без стрелок (только слово), с MEMORY_FROM —
// все команды звучат подряд и прячутся. Ошибка не наказывается — шаг просто не делается.
export class DictationScene extends Phaser.Scene {
  constructor() {
    super('Dictation');
  }

  init() {
    this.level = 1;
    this.locked = true;
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.add.rectangle(0, 0, w, h, COLORS.night, 0.85).setOrigin(0, 0).setInteractive();
    drawPanel(this.add.graphics(), 12, 10, w - 24, 52, { radius: 16 });
    this.add.text(32, 36, 'Карта сокровищ', textStyle(26, COLORS.berryShade)).setOrigin(0, 0.5);
    this.levelText = this.add.text(w / 2 + 40, 36, '', textStyle(20)).setOrigin(0.5);
    new Button(this, { x: w - 92, y: 36, width: 140, height: 40, label: 'Закрыть', fontSize: 18, variant: 'bad', onClick: () => this.close() });

    drawPanel(this.add.graphics(), GRID.x - 10, GRID.y - 10, COLS * CELL + 20, ROWS * CELL + 20, { fill: 0xf3e2b8, radius: 14 });
    const g = this.add.graphics();
    g.lineStyle(2, COLORS.creamShade, 1);
    for (let c = 0; c <= COLS; c++) g.lineBetween(GRID.x + c * CELL, GRID.y, GRID.x + c * CELL, GRID.y + ROWS * CELL);
    for (let r = 0; r <= ROWS; r++) g.lineBetween(GRID.x, GRID.y + r * CELL, GRID.x + COLS * CELL, GRID.y + r * CELL);

    this.trail = this.add.graphics();
    this.cross = this.add.graphics();
    this.player = fitSprite(this.add.image(0, 0, 'redbok_00'), CELL - 6).setDepth(3);

    this.chips = this.add.container(0, 0);
    this.message = this.add.text(GRID.x + (COLS * CELL) / 2, GRID.y + ROWS * CELL + 40, '', outlinedTextStyle(22)).setOrigin(0.5);

    const cx = 760;
    const cy = 330;
    this.dirButtons = {
      up: this.createDirButton('up', cx, cy - 90),
      left: this.createDirButton('left', cx - 100, cy),
      right: this.createDirButton('right', cx + 100, cy),
      down: this.createDirButton('down', cx, cy + 90),
    };
    new Button(this, {
      x: cx,
      y: cy,
      width: 64,
      height: 64,
      variant: 'info',
      icon: (gr, x, y, color) => drawSpeakerIcon(gr, x, y, color),
      onClick: () => this.repeat(),
    });

    this.newRound();
  }

  createDirButton(dir, x, y) {
    const btn = new Button(this, {
      x,
      y,
      width: 140,
      height: 64,
      label: dir.toUpperCase(),
      fontSize: 24,
      variant: 'primary',
      onClick: () => this.press(dir),
    });
    btn.dir = dir;
    return btn;
  }

  setArrows(show) {
    Object.values(this.dirButtons).forEach((btn) => {
      btn.iconDrawer = show ? (g, cx, cy, color) => drawArrow(g, cx - 50, cy, color, btn.dir, 9) : null;
      btn.label.setX(show ? 10 : 0);
      btn.redraw();
    });
  }

  cellCenter({ col, row }) {
    return { x: GRID.x + col * CELL + CELL / 2, y: GRID.y + row * CELL + CELL / 2 };
  }

  // Случайный путь из n шагов внутри поля, без шага «назад» и без повторных клеток.
  makePath(n) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const start = { col: Phaser.Math.Between(0, COLS - 1), row: Phaser.Math.Between(0, ROWS - 1) };
      const seen = new Set([`${start.col},${start.row}`]);
      const cmds = [];
      let cur = start;
      for (let i = 0; i < n; i++) {
        const options = Object.keys(DIRS).filter((d) => {
          const next = { col: cur.col + DIRS[d].dCol, row: cur.row + DIRS[d].dRow };
          return next.col >= 0 && next.col < COLS && next.row >= 0 && next.row < ROWS && !seen.has(`${next.col},${next.row}`);
        });
        if (options.length === 0) break;
        const d = Phaser.Utils.Array.GetRandom(options);
        cur = { col: cur.col + DIRS[d].dCol, row: cur.row + DIRS[d].dRow };
        seen.add(`${cur.col},${cur.row}`);
        cmds.push(d);
      }
      if (cmds.length === n) return { start, end: cur, cmds };
    }
    return null;
  }

  newRound() {
    const n = this.level + 1;
    const { start, end, cmds } = this.makePath(n);
    this.cmds = cmds;
    this.step = 0;
    this.mistakes = 0;
    this.pos = { ...start };
    this.memory = this.level >= MEMORY_FROM;
    this.arrows = this.level <= ARROWS_UNTIL;
    this.setArrows(this.arrows);
    this.levelText.setText(`Уровень ${this.level}   Рекорд ${getRecord('dictation')}`);

    const p = this.cellCenter(start);
    this.player.setPosition(p.x, p.y);
    this.trail.clear();
    this.drawCross(end);
    this.buildChips();

    if (this.memory) {
      this.message.setText('Слушай и запоминай!');
      this.locked = true;
      cmds.forEach((d, i) => {
        this.time.delayedCall(600 + i * 1100, () => {
          this.highlightChip(i);
          speak(d);
        });
      });
      this.time.delayedCall(600 + cmds.length * 1100 + 300, () => {
        this.chipItems.forEach((chip) => chip.hide());
        this.highlightChip(-1);
        this.message.setText('А теперь веди Redbok\'а по памяти!');
        this.locked = false;
      });
    } else {
      this.message.setText('Слушай команду и нажимай!');
      this.locked = false;
      this.time.delayedCall(400, () => this.repeat());
    }
  }

  drawCross(cell) {
    const { x, y } = this.cellCenter(cell);
    const s = 16;
    this.cross.clear().setPosition(0, 0);
    this.cross.lineStyle(12, COLORS.ink, 1).lineBetween(x - s, y - s, x + s, y + s).lineBetween(x - s, y + s, x + s, y - s);
    this.cross.lineStyle(7, COLORS.berry, 1).lineBetween(x - s, y - s, x + s, y + s).lineBetween(x - s, y + s, x + s, y - s);
  }

  buildChips() {
    this.chips.removeAll(true);
    const chipW = 104;
    const gap = 8;
    const total = this.cmds.length * chipW + (this.cmds.length - 1) * gap;
    const scale = Math.min(1, 900 / total);
    const x0 = this.scale.width / 2 - (total * scale) / 2;
    this.chipItems = this.cmds.map((d, i) => {
      const x = x0 + (i * (chipW + gap) + chipW / 2) * scale;
      const y = 108;
      const g = this.add.graphics();
      const label = this.add.text(x + (this.arrows ? 12 : 0) * scale, y, d.toUpperCase(), textStyle(20 * scale)).setOrigin(0.5);
      const arrow = this.add.graphics();
      if (this.arrows) drawArrow(arrow, x - 34 * scale, y, COLORS.ink, d, 7 * scale);
      const draw = (fill) => {
        g.clear();
        drawPanel(g, x - (chipW / 2) * scale, y - 22, chipW * scale, 44, { fill, radius: 12 });
      };
      draw(COLORS.cream);
      this.chips.add([g, label, arrow]);
      return {
        draw,
        hide: () => {
          label.setText('?');
          label.setX(x);
          arrow.clear();
        },
        show: () => {
          label.setText(d.toUpperCase());
        },
      };
    });
  }

  highlightChip(index) {
    this.chipItems.forEach((chip, i) => chip.draw(i < this.step ? COLORS.leaf : i === index ? COLORS.sun : COLORS.cream));
  }

  repeat() {
    if (this.step >= this.cmds.length) return;
    if (this.memory) {
      this.message.setText('Команды спрятаны — вспоминай!');
      return;
    }
    this.highlightChip(this.step);
    speak(this.cmds[this.step]);
  }

  press(dir) {
    if (this.locked) return;
    speak(dir);
    const expected = this.cmds[this.step];
    if (dir !== expected) {
      this.mistakes += 1;
      this.cameras.main.shake(120, 0.006);
      this.tweens.add({ targets: this.player, angle: 12, duration: 70, yoyo: true, repeat: 2 });
      if (this.memory && this.mistakes >= 3) {
        this.chipItems.forEach((chip) => chip.show());
        this.highlightChip(this.step);
        this.message.setText('Подсмотри команды и попробуй ещё!');
      } else {
        this.message.setText('Не туда! Попробуй ещё.');
      }
      return;
    }
    const from = this.cellCenter(this.pos);
    this.pos = { col: this.pos.col + DIRS[dir].dCol, row: this.pos.row + DIRS[dir].dRow };
    const to = this.cellCenter(this.pos);
    this.trail.lineStyle(6, COLORS.sunShade, 0.8).lineBetween(from.x, from.y, to.x, to.y);
    if (DIRS[dir].dCol !== 0) this.player.setFlipX(DIRS[dir].dCol > 0);
    this.tweens.add({ targets: this.player, x: to.x, y: to.y, duration: 180 });
    if (this.memory) this.chipItems[this.step].show();
    this.step += 1;
    this.highlightChip(this.step);

    if (this.step >= this.cmds.length) this.win();
    else if (!this.memory) this.time.delayedCall(450, () => this.repeat());
  }

  win() {
    this.locked = true;
    const stars = this.memory ? 2 : 1;
    addStars(stars);
    const record = submitRecord('dictation', this.level);
    arenaPlayed();
    this.message.setText(`Клад найден! +${stars} ★${record ? '  Новый рекорд!' : ''}`);
    this.cross.clear();
    const { x, y } = this.cellCenter(this.pos);
    const star = this.add.text(x, y - 10, '★', outlinedTextStyle(54, COLORS.sun)).setOrigin(0.5).setDepth(5);
    this.tweens.add({ targets: star, y: y - 60, alpha: 0, scale: 1.6, duration: 900, onComplete: () => star.destroy() });
    // Уровень растёт, только если без ошибок или почти (≤1) — иначе ещё раунд того же уровня.
    if (this.mistakes <= 1) this.level += 1;
    this.time.delayedCall(1500, () => this.newRound());
  }

  close() {
    this.scene.stop();
    this.scene.resume('World');
  }
}

// Стрелка-треугольник с хвостиком, графикой (без эмодзи/символов шрифта).
export function drawArrow(g, cx, cy, color, dir, s = 8) {
  const angle = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[dir];
  const rot = (x, y) => ({ x: cx + x * Math.cos(angle) - y * Math.sin(angle), y: cy + x * Math.sin(angle) + y * Math.cos(angle) });
  const a = rot(s * 1.4, 0);
  const b = rot(0, -s * 1.2);
  const c = rot(0, s * 1.2);
  g.fillStyle(color, 1).fillTriangle(a.x, a.y, b.x, b.y, c.x, c.y);
  const t1 = rot(-s * 1.3, -s * 0.45);
  const t2 = rot(0.1, -s * 0.45);
  const t3 = rot(0.1, s * 0.45);
  const t4 = rot(-s * 1.3, s * 0.45);
  g.fillTriangle(t1.x, t1.y, t2.x, t2.y, t3.x, t3.y).fillTriangle(t1.x, t1.y, t3.x, t3.y, t4.x, t4.y);
}
