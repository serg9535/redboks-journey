import Phaser from 'phaser';
import { ALL_ENTRIES } from '../data/vocab.js';
import { addStars, getLearnedSprites, getRecord, submitRecord } from '../data/progress.js';
import { COLORS, fitSprite, outlinedTextStyle, textStyle } from '../ui/theme.js';
import { Button, drawPanel } from '../ui/widgets.js';
import { speak } from '../ui/speech.js';
import { arenaPlayed } from '../ui/overlay.js';

const CARD = 140;
const GAP = 24;
const SHOW_MS = 900;
const SIX_FROM = 5; // с такой длины последовательности на столе 6 карточек вместо 4

// Сундук памяти (по мотивам Simon / кубиков Корси): монстры по очереди
// подпрыгивают и говорят своё слово — повтори порядок. Длина растёт на 1 после
// каждого успеха; ошибка завершает попытку (рекорд — progress.records.memory).
export class MemoryScene extends Phaser.Scene {
  constructor() {
    super('Memory');
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.add.rectangle(0, 0, w, h, COLORS.night, 0.85).setOrigin(0, 0).setInteractive();
    drawPanel(this.add.graphics(), 12, 10, w - 24, 52, { radius: 16 });
    this.add.text(32, 36, 'Сундук памяти', textStyle(26, COLORS.berryShade)).setOrigin(0, 0.5);
    this.scoreText = this.add.text(w / 2 + 40, 36, '', textStyle(20)).setOrigin(0.5);
    new Button(this, { x: w - 92, y: 36, width: 140, height: 40, label: 'Закрыть', fontSize: 18, variant: 'bad', onClick: () => this.close() });
    this.message = this.add.text(w / 2, h - 50, '', outlinedTextStyle(24)).setOrigin(0.5);
    this.againBtn = new Button(this, { x: w / 2, y: h - 50, width: 220, height: 54, label: 'Ещё раз', fontSize: 22, variant: 'good', onClick: () => this.start() }).setVisible(false);
    this.board = this.add.container(0, 0);
    this.start();
  }

  start() {
    this.againBtn.setVisible(false);
    this.seq = [];
    this.layout(4);
    this.nextRound();
  }

  // Карточки — выученные монстры (если их мало — любые), все с разными словами.
  layout(count) {
    this.board.removeAll(true);
    const learned = getLearnedSprites();
    let pool = ALL_ENTRIES.filter((e) => learned.has(e.sprite));
    if (pool.length < count) pool = ALL_ENTRIES;
    const entries = [];
    for (const e of Phaser.Utils.Array.Shuffle([...pool])) {
      if (!entries.some((x) => x.word === e.word)) entries.push(e);
      if (entries.length === count) break;
    }
    const cols = count === 4 ? 2 : 3;
    const rows = Math.ceil(count / cols);
    const x0 = this.scale.width / 2 - ((cols - 1) * (CARD + GAP)) / 2;
    const y0 = 340 - ((rows - 1) * (CARD + GAP)) / 2;
    this.cards = entries.map((entry, i) => {
      const x = x0 + (i % cols) * (CARD + GAP);
      const y = y0 + Math.floor(i / cols) * (CARD + GAP);
      const g = this.add.graphics();
      const img = fitSprite(this.add.image(x, y, entry.sprite), CARD - 30);
      const zone = this.add.zone(x, y, CARD, CARD).setInteractive({ useHandCursor: true });
      const card = { entry, img, baseScale: img.scale };
      card.draw = (fill) => {
        g.clear();
        drawPanel(g, x - CARD / 2, y - CARD / 2, CARD, CARD, { fill, radius: 18 });
      };
      card.draw(COLORS.creamShade);
      zone.on('pointerdown', () => this.tap(i));
      this.board.add([g, img, zone]);
      return card;
    });
  }

  light(i, fill = COLORS.sun) {
    const card = this.cards[i];
    card.draw(fill);
    speak(card.entry.word);
    this.tweens.add({ targets: card.img, scale: card.baseScale * 1.15, y: card.img.y - 10, duration: 180, yoyo: true });
    this.time.delayedCall(SHOW_MS - 200, () => card.draw(COLORS.creamShade));
  }

  nextRound() {
    // При переходе к 6 карточкам последовательность начинается заново на новом столе той же длины.
    if (this.seq.length + 1 === SIX_FROM && this.cards.length === 4) {
      const len = this.seq.length;
      this.layout(6);
      this.seq = Array.from({ length: len }, () => Phaser.Math.Between(0, 5));
    }
    this.seq.push(Phaser.Math.Between(0, this.cards.length - 1));
    this.input_ = 0;
    this.locked = true;
    this.scoreText.setText(`Длина ${this.seq.length}   Рекорд ${getRecord('memory')}`);
    this.message.setText('Смотри и слушай!');
    this.seq.forEach((cardIndex, k) => this.time.delayedCall(700 + k * SHOW_MS, () => this.light(cardIndex)));
    this.time.delayedCall(700 + this.seq.length * SHOW_MS, () => {
      this.locked = false;
      this.message.setText('Теперь ты! Нажимай по порядку');
    });
  }

  tap(i) {
    if (this.locked) return;
    if (i !== this.seq[this.input_]) return this.fail(i);
    this.light(i, COLORS.leaf);
    this.input_ += 1;
    if (this.input_ >= this.seq.length) {
      this.locked = true;
      this.message.setText('Верно!');
      this.time.delayedCall(1100, () => this.nextRound());
    }
  }

  fail(i) {
    this.locked = true;
    const score = this.seq.length - 1;
    this.cards[i].draw(COLORS.berry);
    const right = this.seq[this.input_];
    this.cards[right].draw(COLORS.leaf);
    speak(this.cards[right].entry.word);
    this.cameras.main.shake(150, 0.006);
    const stars = Math.max(0, score - 1);
    if (stars) addStars(stars);
    const record = submitRecord('memory', score);
    arenaPlayed();
    this.time.delayedCall(900, () => {
      this.message.setText('');
      this.scoreText.setText(`Запомнил ${score}${record ? ' — новый рекорд!' : ''}   +${stars} ★`);
      this.againBtn.setVisible(true);
    });
  }

  close() {
    this.scene.stop();
    this.scene.resume('World');
  }
}
