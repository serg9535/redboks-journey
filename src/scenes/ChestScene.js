import Phaser from 'phaser';
import { getLocation } from '../data/locations.js';
import { addStars, markChestOpened } from '../data/progress.js';
import { COLORS, fitSprite, outlinedTextStyle, textStyle } from '../ui/theme.js';
import { Button, drawPanel, drawSpeakerIcon } from '../ui/widgets.js';
import { speak } from '../ui/speech.js';

const CARD = 170;

// Сундук на карте — упражнение «сначала слушаем» (как в Lingokids): сундук
// произносит слово, нужно коснуться нужной картинки. Ошибка не мешает открыть
// сундук — правильная картинка подсвечивается, звёзд просто меньше.
// Оверлей поверх WorldScene; мир сам уберёт открытый сундук на resume.
export class ChestScene extends Phaser.Scene {
  constructor() {
    super('Chest');
  }

  init(data) {
    this.locationKey = data.biomeKey;
    this.chestIndex = data.index;
    this.answered = false;
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    const words = getLocation(this.locationKey).words;
    const options = Phaser.Utils.Array.Shuffle([...words]).slice(0, 3);
    this.target = Phaser.Utils.Array.GetRandom(options);

    this.add.rectangle(0, 0, w, h, COLORS.night, 0.8).setOrigin(0, 0).setInteractive();
    drawPanel(this.add.graphics(), w / 2 - 330, 60, 660, 500, { radius: 24 });
    this.add.text(w / 2, 100, 'Волшебный сундук!', textStyle(30, COLORS.berryShade)).setOrigin(0.5);
    this.prompt = this.add.text(w / 2, 145, 'Послушай слово и найди картинку', textStyle(20)).setOrigin(0.5);

    new Button(this, {
      x: w / 2,
      y: 205,
      width: 120,
      height: 64,
      variant: 'info',
      icon: (g, cx, cy, color) => drawSpeakerIcon(g, cx, cy, color, 30),
      onClick: () => speak(this.target.word),
    });

    this.cards = options.map((entry, i) => this.createCard(entry, w / 2 + (i - 1) * (CARD + 30), 360));
    this.result = this.add.text(w / 2, 480, '', outlinedTextStyle(30, COLORS.sun)).setOrigin(0.5);
    this.doneBtn = new Button(this, { x: w / 2, y: 520, width: 200, height: 54, label: 'Ура! ▶', fontSize: 24, variant: 'good', onClick: () => this.close() }).setVisible(false);

    this.time.delayedCall(300, () => speak(this.target.word));
  }

  createCard(entry, x, y) {
    const g = this.add.graphics();
    const draw = (fill) => {
      g.clear();
      drawPanel(g, x - CARD / 2, y - CARD / 2, CARD, CARD, { fill, radius: 20 });
    };
    draw(COLORS.creamShade);
    fitSprite(this.add.image(x, y, entry.sprite), CARD - 36);
    const zone = this.add.zone(x, y, CARD, CARD).setInteractive({ useHandCursor: true });
    const card = { entry, draw };
    zone.on('pointerdown', () => this.choose(card));
    return card;
  }

  choose(card) {
    if (this.answered) return;
    this.answered = true;
    const correct = card.entry === this.target;
    const stars = correct ? 2 : 1;
    card.draw(correct ? COLORS.leaf : COLORS.berry);
    if (!correct) this.cards.find((c) => c.entry === this.target).draw(COLORS.leaf);
    speak(this.target.word);
    markChestOpened(this.locationKey, this.chestIndex);
    addStars(stars);
    this.prompt.setText(`${this.target.word.toUpperCase()} — ${this.target.ru}`);
    this.result.setText(correct ? `Верно! +${stars} ★` : `Это ${this.target.word.toUpperCase()}! +${stars} ★`).setY(450);
    this.doneBtn.setVisible(true);
  }

  close() {
    this.scene.stop();
    this.scene.resume('World');
  }
}
