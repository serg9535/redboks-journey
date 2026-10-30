import Phaser from 'phaser';
import { ALL_ENTRIES } from '../data/vocab.js';
import { addStars, getRecord, submitRecord } from '../data/progress.js';
import { COLORS, fitSprite, outlinedTextStyle } from '../ui/theme.js';
import { Button, drawPips } from '../ui/widgets.js';
import { speak } from '../ui/speech.js';
import { againButton, arenaPlayed, buildOverlay } from '../ui/overlay.js';

const CATEGORIES = [
  { id: 'animals', ru: 'ЖИВОТНОЕ', en: 'animals', words: ['cat', 'dog', 'cow', 'pig', 'duck', 'horse', 'bee', 'bat', 'spider', 'fox', 'bear', 'penguin', 'crab', 'shark', 'fish', 'octopus', 'scorpion', 'mole', 'worm'] },
  { id: 'food', ru: 'ЕДА', en: 'food', words: ['apple', 'banana', 'egg', 'milk', 'cake', 'carrot', 'berry'] },
  { id: 'home', ru: 'ВЕЩЬ ИЗ ДОМА', en: 'things at home', words: ['ball', 'cup', 'bed', 'lamp', 'book', 'chair'] },
];
const BEATS = 24;
const SWITCH_EVERY = 8;
const HEARTS = 3;
const HIT_CHANCE = 0.45;

// «Хлопай в ритм»: под метроном появляется картинка и звучит слово — хлопни
// (большая кнопка), только если это слово из нужной категории (животные / еда /
// вещи из дома). Категория меняется каждые 8 ударов, темп растёт.
// Классификация + торможение + ритм. Рекорд — progress.records.rhythm.
export class RhythmScene extends Phaser.Scene {
  constructor() {
    super('Rhythm');
  }

  create() {
    Object.assign(this, buildOverlay(this, 'Хлопай в ритм'));
    this.rule = this.add.text(this.w / 2, 100, '', outlinedTextStyle(26, COLORS.sun)).setOrigin(0.5);
    this.pulse = this.add.graphics();
    this.picture = this.add.image(this.w / 2, 260, 'redbok_00').setVisible(false);
    this.hearts = this.add.graphics();
    this.clapBtn = new Button(this, { x: this.w / 2, y: 470, width: 300, height: 90, label: 'ХЛОП!', fontSize: 36, variant: 'primary', onClick: () => this.clap() });
    this.input.keyboard.on('keydown-SPACE', () => this.clap());
    this.again = againButton(this, () => this.start());
    this.start();
  }

  start() {
    this.again.setVisible(false);
    this.clapBtn.setVisible(true);
    this.beat = 0;
    this.points = 0;
    this.lives = HEARTS;
    this.over = false;
    this.category = null;
    this.drawHearts();
    this.gen = (this.gen ?? 0) + 1;
    const gen = this.gen;
    this.time.delayedCall(800, () => this.tick(gen));
  }

  drawHearts() {
    this.hearts.clear();
    drawPips(this.hearts, this.w / 2, 140, this.lives, HEARTS, COLORS.berry);
  }

  pickCategory() {
    this.category = Phaser.Utils.Array.GetRandom(CATEGORIES.filter((c) => c !== this.category));
    this.pool = ALL_ENTRIES.filter((e) => this.category.words.includes(e.word));
    this.rule.setText(`Хлопай, если это ${this.category.ru}!`);
    speak(`Clap for ${this.category.en}!`);
  }

  // Один удар метронома: новая картинка; прошлую, если её надо было «хлопнуть», засчитываем как пропуск.
  tick(gen) {
    if (this.over || this.closed || gen !== this.gen) return;
    if (this.beat >= BEATS) return this.finish();
    if (this.beat % SWITCH_EVERY === 0) {
      this.pickCategory();
      this.beat += 1;
      this.time.delayedCall(2000, () => this.tick(gen));
      return;
    }
    this.beat += 1;
    const inCategory = Math.random() < HIT_CHANCE;
    const others = ALL_ENTRIES.filter((e) => !this.category.words.includes(e.word));
    this.entry = Phaser.Utils.Array.GetRandom(inCategory ? this.pool : others);
    this.clapped = false;
    this.picture.setTexture(this.entry.sprite).setVisible(true);
    fitSprite(this.picture, 200);
    const s = this.picture.scale;
    this.picture.setScale(s * 0.6);
    this.tweens.add({ targets: this.picture, scale: s, duration: 160, ease: 'Back.easeOut' });
    this.pulse.clear().fillStyle(COLORS.sun, 0.35).fillCircle(this.w / 2, 260, 140);
    this.tweens.add({ targets: this.pulse, alpha: { from: 1, to: 0 }, duration: 400 });
    speak(this.entry.word);
    this.score.setText(`Удар ${this.beat}/${BEATS}   Очки ${this.points}   Рекорд ${getRecord('rhythm')}`);
    const interval = Phaser.Math.Linear(2200, 1300, this.beat / BEATS);
    this.time.delayedCall(interval, () => this.tick(gen));
  }

  clap() {
    if (this.over || !this.entry || this.clapped) return;
    this.clapped = true;
    this.tweens.add({ targets: this.clapBtn, scale: 1.1, duration: 80, yoyo: true });
    if (this.category.words.includes(this.entry.word)) {
      this.points += 1;
      this.message.setText(`Да! ${this.entry.word.toUpperCase()}`);
    } else {
      this.lives -= 1;
      this.drawHearts();
      this.cameras.main.shake(120, 0.006);
      this.message.setText(`${this.entry.word.toUpperCase()} — не ${this.category.ru.toLowerCase()}!`);
      if (this.lives <= 0) this.finish();
    }
  }

  finish() {
    this.over = true;
    this.picture.setVisible(false);
    this.clapBtn.setVisible(false);
    this.rule.setText('');
    const stars = Math.floor(this.points / 3);
    if (stars) addStars(stars);
    const record = submitRecord('rhythm', this.points);
    arenaPlayed();
    this.score.setText(`Очки ${this.points}${record ? ' — новый рекорд!' : ''}   +${stars} ★`);
    this.message.setText('');
    this.again.setVisible(true);
  }
}
