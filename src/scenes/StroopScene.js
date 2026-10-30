import Phaser from 'phaser';
import { BIOMES } from '../data/vocab.js';
import { addStars, getRecord, submitRecord } from '../data/progress.js';
import { COLORS, outlinedTextStyle } from '../ui/theme.js';
import { Button } from '../ui/widgets.js';
import { speak } from '../ui/speech.js';
import { againButton, arenaPlayed, buildOverlay } from '../ui/overlay.js';

const PAINTS = { red: 0xe8553e, blue: 0x3b7ddd, green: 0x5cbf3a, yellow: 0xffd23c, purple: 0x8a4fd0, orange: 0xff8a2a };
const COLOR_WORDS = BIOMES.colors.words.map((e) => e.word).filter((w) => w in PAINTS);
const ROUNDS = 15;
const TRICK_CHANCE = 0.55; // как часто голос называет НЕ тот цвет

// «Хитрый голос» — слуховой Струп (тормозной контроль) для тех, кто ещё не читает:
// на экране клякса одного цвета, голос называет цвет — иногда неправильный.
// Нажать нужно настоящий цвет кляксы. Время на ответ сокращается с каждым раундом.
export class StroopScene extends Phaser.Scene {
  constructor() {
    super('Stroop');
  }

  create() {
    const ui = buildOverlay(this, 'Хитрый голос');
    Object.assign(this, ui);
    this.add.text(this.w / 2, 100, 'Нажми цвет кляксы — не слушай голос!', outlinedTextStyle(22)).setOrigin(0.5);
    this.blob = this.add.graphics();
    this.bar = this.add.graphics();
    const colors = COLOR_WORDS.slice(0, 6);
    this.buttons = colors.map((word, i) => {
      const x = this.w / 2 + ((i % 3) - 1) * 220;
      const y = 440 + Math.floor(i / 3) * 76;
      const btn = new Button(this, {
        x,
        y,
        width: 200,
        height: 62,
        label: word.toUpperCase(),
        fontSize: 22,
        variant: 'secondary',
        icon: (g, cx, cy) => {
          g.fillStyle(COLORS.ink, 1).fillCircle(cx - 70, cy, 17);
          g.fillStyle(PAINTS[word], 1).fillCircle(cx - 70, cy, 14);
        },
        onClick: () => this.answer(word, btn),
      });
      btn.label.setX(14);
      return btn;
    });
    this.again = againButton(this, () => this.start());
    this.start();
  }

  start() {
    this.again.setVisible(false);
    this.round = 0;
    this.points = 0;
    this.next();
  }

  next() {
    if (this.closed) return;
    if (this.round >= ROUNDS) return this.finish();
    this.round += 1;
    this.buttons.forEach((b) => b.setVariant('secondary').setEnabled(true));
    this.color = Phaser.Utils.Array.GetRandom(COLOR_WORDS);
    const said = Math.random() < TRICK_CHANCE ? Phaser.Utils.Array.GetRandom(COLOR_WORDS.filter((c) => c !== this.color)) : this.color;
    this.drawBlob(PAINTS[this.color]);
    speak(said);
    this.limit = Phaser.Math.Linear(5000, 2500, this.round / ROUNDS);
    this.left = this.limit;
    this.waiting = true;
    this.score.setText(`Раунд ${this.round}/${ROUNDS}   Очки ${this.points}   Рекорд ${getRecord('stroop')}`);
    this.message.setText('');
  }

  drawBlob(color) {
    const g = this.blob.clear();
    const cx = this.w / 2;
    const cy = 250;
    const parts = [
      [0, 0, 82],
      [-70, -40, 32],
      [74, 34, 36],
      [52, -66, 22],
      [-60, 64, 24],
    ];
    parts.forEach(([dx, dy, r]) => g.fillStyle(COLORS.ink, 1).fillCircle(cx + dx, cy + dy, r + 5));
    parts.forEach(([dx, dy, r]) => g.fillStyle(color, 1).fillCircle(cx + dx, cy + dy, r));
    g.fillStyle(0xffffff, 0.4).fillCircle(cx - 26, cy - 26, 18);
  }

  update(_t, delta) {
    if (!this.waiting) return;
    this.left -= delta;
    const k = Math.max(0, this.left / this.limit);
    this.bar.clear().fillStyle(COLORS.ink, 1).fillRoundedRect(this.w / 2 - 163, 373, 326, 18, 9);
    this.bar.fillStyle(k > 0.35 ? COLORS.sun : COLORS.berry, 1).fillRoundedRect(this.w / 2 - 160, 376, Math.max(12, 320 * k), 12, 6);
    if (this.left <= 0) this.answer(null, null);
  }

  answer(word, btn) {
    if (!this.waiting) return;
    this.waiting = false;
    this.buttons.forEach((b) => b.setEnabled(false));
    const right = this.buttons[COLOR_WORDS.indexOf(this.color)];
    if (word === this.color) {
      this.points += 1;
      btn.setVariant('good');
      this.message.setText('Верно!');
    } else {
      btn?.setVariant('bad');
      right?.setVariant('good');
      this.message.setText(word ? `Это ${this.color.toUpperCase()}!` : 'Не успел!');
      this.cameras.main.shake(120, 0.006);
    }
    speak(this.color);
    this.time.delayedCall(1100, () => this.next());
  }

  finish() {
    const stars = Math.floor(this.points / 3);
    if (stars) addStars(stars);
    const record = submitRecord('stroop', this.points);
    arenaPlayed();
    this.score.setText(`Очки ${this.points}/${ROUNDS}${record ? ' — новый рекорд!' : ''}   +${stars} ★`);
    this.message.setText('');
    this.again.setVisible(true);
  }
}
