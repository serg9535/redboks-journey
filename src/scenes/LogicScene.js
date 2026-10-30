import Phaser from 'phaser';
import { ALL_ENTRIES, BIOMES } from '../data/vocab.js';
import { addStars, getRecord, submitRecord } from '../data/progress.js';
import { COLORS, fitSprite, outlinedTextStyle } from '../ui/theme.js';
import { drawPanel } from '../ui/widgets.js';
import { speak } from '../ui/speech.js';
import { againButton, arenaPlayed, buildOverlay } from '../ui/overlay.js';

const CARD = 140;
const ROUNDS = 10;
const LOOK_MS = 3500;

// Логика и зрительная память, раунды чередуются:
// - odd — «Что лишнее?»: три картинки одного биома (категории) и одна чужая;
// - missing — «Что пропало?»: запомни 4 картинки, одна исчезает — выбери её из трёх.
// Касание картинки произносит слово. Рекорд — верных из ROUNDS (progress.records.logic).
export class LogicScene extends Phaser.Scene {
  constructor() {
    super('Logic');
  }

  create() {
    Object.assign(this, buildOverlay(this, 'Что лишнее? Что пропало?'));
    this.title = this.add.text(this.w / 2, 100, '', outlinedTextStyle(28, COLORS.sun)).setOrigin(0.5);
    this.board = this.add.container(0, 0);
    this.again = againButton(this, () => this.start());
    this.start();
  }

  start() {
    this.again.setVisible(false);
    this.round = 0;
    this.points = 0;
    this.next();
  }

  uniqueWords(list) {
    return list.filter((e, i, arr) => arr.findIndex((x) => x.word === e.word) === i);
  }

  next() {
    if (this.closed) return;
    if (this.round >= ROUNDS) return this.finish();
    this.round += 1;
    this.score.setText(`Раунд ${this.round}/${ROUNDS}   Верно ${this.points}   Рекорд ${getRecord('logic')}`);
    this.message.setText('');
    if (this.round % 2 === 1) this.oddRound();
    else this.missingRound();
  }

  layout(entries, y, onTap, clear = true) {
    if (clear) this.board.removeAll(true);
    const step = CARD + 26;
    return entries.map((entry, i) => {
      const x = this.w / 2 + (i - (entries.length - 1) / 2) * step;
      const g = this.add.graphics();
      const draw = (fill) => {
        g.clear();
        drawPanel(g, x - CARD / 2, y - CARD / 2, CARD, CARD, { fill, radius: 18 });
      };
      draw(COLORS.creamShade);
      const img = fitSprite(this.add.image(x, y, entry.sprite), CARD - 30);
      const zone = this.add.zone(x, y, CARD, CARD).setInteractive({ useHandCursor: true });
      const card = { entry, draw, img };
      zone.on('pointerdown', () => onTap(card));
      this.board.add([g, img, zone]);
      return card;
    });
  }

  oddRound() {
    this.title.setText('Что здесь лишнее?');
    speak('Which one is different?');
    const biome = Phaser.Utils.Array.GetRandom(Object.keys(BIOMES));
    const own = Phaser.Utils.Array.Shuffle(this.uniqueWords(BIOMES[biome].words)).slice(0, 3);
    const homeWords = new Set(BIOMES[biome].words.map((e) => e.word));
    const odd = Phaser.Utils.Array.GetRandom(ALL_ENTRIES.filter((e) => !homeWords.has(e.word)));
    this.answerWord = odd.word;
    this.locked = false;
    this.cards = this.layout(Phaser.Utils.Array.Shuffle([...own, odd]), 300, (card) => this.choose(card));
  }

  missingRound() {
    this.title.setText('Запомни картинки!');
    const shown = Phaser.Utils.Array.Shuffle(this.uniqueWords(ALL_ENTRIES)).slice(0, 4);
    const gone = Phaser.Utils.Array.GetRandom(shown);
    this.answerWord = gone.word;
    this.locked = true;
    this.cards = this.layout(shown, 300, (card) => speak(card.entry.word));
    this.time.delayedCall(LOOK_MS, () => {
      if (this.closed) return;
      // Пропавшая картинка — пустая карточка на её месте; варианты — снизу.
      const slot = this.cards.find((c) => c.entry === gone);
      slot.img.setVisible(false);
      slot.draw(COLORS.grey);
      this.title.setText('Что пропало?');
      speak('What is missing?');
      const decoys = Phaser.Utils.Array.Shuffle(this.uniqueWords(ALL_ENTRIES).filter((e) => !shown.some((s) => s.word === e.word))).slice(0, 2);
      this.cards = this.layout(Phaser.Utils.Array.Shuffle([gone, ...decoys]), 470, (card) => this.choose(card), false);
      this.locked = false;
    });
  }

  choose(card) {
    speak(card.entry.word);
    if (this.locked) return;
    this.locked = true;
    const right = card.entry.word === this.answerWord;
    card.draw(right ? COLORS.leaf : COLORS.berry);
    if (!right) this.cards.find((c) => c.entry.word === this.answerWord)?.draw(COLORS.leaf);
    if (right) this.points += 1;
    this.message.setText(right ? 'Верно!' : `Это ${this.answerWord.toUpperCase()}!`);
    this.time.delayedCall(1500, () => this.next());
  }

  finish() {
    this.board.removeAll(true);
    this.title.setText('');
    const stars = Math.floor(this.points / 2);
    if (stars) addStars(stars);
    const record = submitRecord('logic', this.points);
    arenaPlayed();
    this.score.setText(`Верно ${this.points}/${ROUNDS}${record ? ' — новый рекорд!' : ''}   +${stars} ★`);
    this.message.setText('');
    this.again.setVisible(true);
  }
}
