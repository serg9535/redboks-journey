import Phaser from 'phaser';
import { getLocation } from '../data/locations.js';
import { addStars } from '../data/progress.js';
import { COLORS, fitSprite, outlinedTextStyle, textStyle } from '../ui/theme.js';
import { Button, drawPanel } from '../ui/widgets.js';
import { speak } from '../ui/speech.js';

const PAIRS_PER_ROUND = 3;
const ROW_Y = [200, 340, 480];
const PIC_X = 300;
const WORD_X = 660;
const CARD_W = 150;
const CARD_H = 124;

// Этап Practice из брифа: мини-игра «соедини картинку со словом». Слева
// монстры, справа слова (тап по слову его озвучивает — можно играть, не умея
// читать). Пара собирается в любом порядке: картинка→слово или слово→картинка.
// Ошибка не штрафует — только мягко «встряхивает» карточки.
export class MatchingScene extends Phaser.Scene {
  constructor() {
    super('Matching');
  }

  init(data) {
    this.locationKey = data.biomeKey;
    this.roundIndex = 0;
    this.selected = null;
    this.items = [];
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    const location = getLocation(this.locationKey);
    this.rounds = buildRounds(location.words);

    const bg = this.add.image(w / 2, h / 2, location.background);
    bg.setScale(Math.max(w / bg.width, h / bg.height));
    this.add.rectangle(0, 0, w, h, COLORS.night, 0.45).setOrigin(0, 0).setInteractive();

    drawPanel(this.add.graphics(), w / 2 - 300, 14, 600, 50, { radius: 16 });
    this.title = this.add.text(w / 2, 39, '', textStyle(24)).setOrigin(0.5);
    this.add.text(w / 2, 92, 'Соедини картинку со словом', outlinedTextStyle(20)).setOrigin(0.5);

    this.lines = this.add.graphics().setDepth(1);
    this.banner = this.add.text(w / 2, h / 2 - 20, '', outlinedTextStyle(56, COLORS.sun)).setOrigin(0.5).setDepth(20).setAlpha(0);
    this.doneBtn = new Button(this, { x: w / 2, y: h / 2 + 70, width: 220, height: 60, label: 'В путь! ▶', fontSize: 26, variant: 'good', onClick: () => this.finish() })
      .setDepth(21)
      .setVisible(false);

    this.startRound();
  }

  startRound() {
    this.items.forEach((item) => item.obj.destroy());
    this.lines.clear();
    this.selected = null;
    this.title.setText(`Тренировка ${this.roundIndex + 1}/${this.rounds.length}`);

    const entries = this.rounds[this.roundIndex];
    const picOrder = Phaser.Utils.Array.Shuffle([...entries]);
    const wordOrder = Phaser.Utils.Array.Shuffle([...entries]);
    this.items = [
      ...picOrder.map((entry, i) => this.createPicture(entry, ROW_Y[i])),
      ...wordOrder.map((entry, i) => this.createWord(entry, ROW_Y[i])),
    ];
    this.remaining = entries.length;
  }

  createPicture(entry, y) {
    const item = { kind: 'pic', entry, matched: false, x: PIC_X + CARD_W / 2, y };
    const container = this.add.container(PIC_X, y).setDepth(2);
    const g = this.add.graphics();
    const image = fitSprite(this.add.image(0, 0, entry.sprite), CARD_H - 24);
    container.add([g, image]);
    container.setSize(CARD_W, CARD_H).setInteractive({ useHandCursor: true });
    container.on('pointerdown', () => this.select(item));
    item.obj = container;
    item.setState = (state) => {
      const fill = { idle: COLORS.cream, selected: COLORS.sun, good: COLORS.leaf, bad: COLORS.berry }[state];
      g.clear();
      drawPanel(g, -CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, { fill, radius: 18 });
    };
    item.setState('idle');
    return item;
  }

  createWord(entry, y) {
    const item = { kind: 'word', entry, matched: false, x: WORD_X - 130, y };
    const button = new Button(this, { x: WORD_X, y, width: 260, height: 70, label: entry.word, fontSize: 30, variant: 'secondary', onClick: () => this.select(item) }).setDepth(2);
    item.obj = button;
    item.setState = (state) => button.setVariant({ idle: 'secondary', selected: 'primary', good: 'good', bad: 'bad' }[state]);
    return item;
  }

  select(item) {
    if (item.matched || this.busy) return;
    if (item.kind === 'word') speak(item.entry.word);

    const prev = this.selected;
    if (!prev || prev.kind === item.kind) {
      prev?.setState('idle');
      this.selected = item;
      item.setState('selected');
      return;
    }

    this.selected = null;
    if (prev.entry.word === item.entry.word) this.onMatch(prev, item);
    else this.onMiss(prev, item);
  }

  onMatch(a, b) {
    [a, b].forEach((it) => {
      it.matched = true;
      it.setState('good');
      this.tweens.add({ targets: it.obj, scale: 1.08, duration: 120, yoyo: true });
    });
    speak(a.entry.word);
    const [pic, word] = a.kind === 'pic' ? [a, b] : [b, a];
    this.lines.lineStyle(8, COLORS.ink, 1).lineBetween(pic.x, pic.y, word.x, word.y);
    this.lines.lineStyle(4, COLORS.leaf, 1).lineBetween(pic.x, pic.y, word.x, word.y);

    this.remaining -= 1;
    if (this.remaining > 0) return;
    this.busy = true;
    this.time.delayedCall(900, () => {
      this.busy = false;
      this.roundIndex += 1;
      if (this.roundIndex < this.rounds.length) this.startRound();
      else this.showDone();
    });
  }

  onMiss(a, b) {
    this.busy = true;
    [a, b].forEach((it) => {
      it.setState('bad');
      this.tweens.add({ targets: it.obj, x: it.obj.x + 8, duration: 60, yoyo: true, repeat: 2 });
    });
    this.time.delayedCall(600, () => {
      [a, b].forEach((it) => it.setState('idle'));
      this.busy = false;
    });
  }

  showDone() {
    this.items.forEach((item) => item.obj.setVisible(false));
    this.lines.clear();
    addStars(3);
    this.banner.setText('Молодец! +3 ★').setScale(0.6);
    this.tweens.add({ targets: this.banner, alpha: 1, scale: 1, duration: 300, ease: 'Back.easeOut' });
    this.doneBtn.setVisible(true);
  }

  finish() {
    this.scene.stop();
    this.scene.resume('World');
  }
}

// Слова биома — случайными тройками; неполную последнюю тройку добиваем
// уже встречавшимися словами, чтобы в каждом раунде был выбор из 3.
function buildRounds(words) {
  const shuffled = Phaser.Utils.Array.Shuffle([...words]);
  const rounds = [];
  for (let i = 0; i < shuffled.length; i += PAIRS_PER_ROUND) rounds.push(shuffled.slice(i, i + PAIRS_PER_ROUND));
  const last = rounds[rounds.length - 1];
  const filler = shuffled.filter((w) => !last.includes(w));
  while (last.length < Math.min(PAIRS_PER_ROUND, words.length)) last.push(filler.shift());
  return rounds;
}
