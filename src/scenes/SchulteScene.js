import Phaser from 'phaser';
import { addStars, getRecord, submitRecord } from '../data/progress.js';
import { COLORS, textStyle } from '../ui/theme.js';
import { drawPanel } from '../ui/widgets.js';
import { speak } from '../ui/speech.js';
import { againButton, arenaPlayed, buildOverlay } from '../ui/overlay.js';

const NUMBERS = [
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
  'twenty-one', 'twenty-two', 'twenty-three', 'twenty-four', 'twenty-five',
];
const AREA = 440;

// Таблицы Шульте (внимание и зрительный поиск) с английскими числами: найди
// по порядку ONE, TWO, THREE… — каждое касание произносит число. Сетка растёт:
// 3×3 → 4×4 → 5×5. Рекорд — самая большая пройденная сетка (progress.records.schulte).
export class SchulteScene extends Phaser.Scene {
  constructor() {
    super('Schulte');
  }

  create() {
    Object.assign(this, buildOverlay(this, 'Найди по порядку'));
    this.board = this.add.container(0, 0);
    this.again = againButton(this, () => this.start(3));
    this.start(3);
  }

  start(size) {
    this.again.setVisible(false);
    this.size = size;
    this.next = 1;
    this.startTime = Date.now();
    this.board.removeAll(true);
    const n = size * size;
    const order = Phaser.Utils.Array.Shuffle(Array.from({ length: n }, (_, i) => i + 1));
    const cell = AREA / size;
    const x0 = this.w / 2 - AREA / 2;
    const y0 = 90;
    this.cells = order.map((num, i) => {
      const x = x0 + (i % size) * cell;
      const y = y0 + Math.floor(i / size) * cell;
      const g = this.add.graphics();
      const draw = (fill) => {
        g.clear();
        drawPanel(g, x + 4, y + 4, cell - 8, cell - 8, { fill, radius: 12 });
      };
      draw(COLORS.cream);
      const label = this.add.text(x + cell / 2, y + cell / 2, String(num), textStyle(size === 5 ? 30 : 40)).setOrigin(0.5);
      const zone = this.add.zone(x + cell / 2, y + cell / 2, cell - 8, cell - 8).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.tap(num, draw));
      this.board.add([g, label, zone]);
      return { num, draw };
    });
    this.refresh();
    this.message.setText(`Найди ${NUMBERS[0].toUpperCase()} — 1`);
  }

  refresh() {
    const sec = Math.floor((Date.now() - this.startTime) / 1000);
    this.score.setText(`Сетка ${this.size}×${this.size}   ${sec} с   Рекорд ${getRecord('schulte') ? `${getRecord('schulte')}×${getRecord('schulte')}` : '—'}`);
  }

  update() {
    if (this.next <= this.size * this.size) this.refresh();
  }

  tap(num, draw) {
    if (this.next > this.size * this.size) return;
    if (num !== this.next) {
      this.cameras.main.shake(100, 0.005);
      return;
    }
    speak(NUMBERS[num - 1]);
    draw(COLORS.leaf);
    this.next += 1;
    const total = this.size * this.size;
    if (this.next <= total) {
      this.message.setText(`Найди ${NUMBERS[this.next - 1].toUpperCase()} — ${this.next}`);
      return;
    }
    const stars = this.size - 2;
    addStars(stars);
    const record = submitRecord('schulte', this.size);
    arenaPlayed();
    if (this.size < 5) {
      this.message.setText(`Готово! +${stars} ★${record ? ' Новый рекорд!' : ''} Дальше — больше!`);
      this.time.delayedCall(1600, () => !this.closed && this.start(this.size + 1));
    } else {
      this.message.setText(`Ты прошёл 5×5! +${stars} ★`);
      this.time.delayedCall(1200, () => {
        this.message.setText('');
        this.again.setVisible(true);
      });
    }
  }
}
