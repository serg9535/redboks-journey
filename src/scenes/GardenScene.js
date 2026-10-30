import Phaser from 'phaser';
import { CROPS, RIPE_STAGE, cropSprite, getCrop } from '../data/garden.js';
import { addStars, getPlot, markHarvested, setPlot } from '../data/progress.js';
import { COLORS, fitSprite, outlinedTextStyle, textStyle } from '../ui/theme.js';
import { Button, drawPanel, drawSpeakerIcon } from '../ui/widgets.js';
import { speak } from '../ui/speech.js';

const CARD = 160;
const STARS_RIGHT = 2;
const STARS_WRONG = 1;

// Грядка огорода (оверлей поверх WorldScene, см. data/garden.js). Три состояния:
// пусто — выбрать семечко (картинка + слово + озвучка); растёт — полить; созрело —
// «Что выросло?»: выбрать слово из трёх. Ошибка не мешает собрать урожай, звёзд меньше.
// Мир сам перерисует грядку на resume.
export class GardenScene extends Phaser.Scene {
  constructor() {
    super('Garden');
  }

  init(data) {
    this.plotIndex = data.index;
    this.answered = false;
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.add.rectangle(0, 0, w, h, COLORS.night, 0.8).setOrigin(0, 0).setInteractive();
    drawPanel(this.add.graphics(), w / 2 - 330, 60, 660, 520, { radius: 24 });
    this.title = this.add.text(w / 2, 100, 'Грядка', textStyle(30, COLORS.leafShade)).setOrigin(0.5);
    this.prompt = this.add.text(w / 2, 145, '', textStyle(20)).setOrigin(0.5);
    this.result = this.add.text(w / 2, 470, '', outlinedTextStyle(28, COLORS.sun)).setOrigin(0.5);
    this.doneBtn = new Button(this, { x: w / 2, y: 530, width: 200, height: 54, label: 'Готово ▶', fontSize: 24, variant: 'good', onClick: () => this.close() }).setVisible(false);
    this.content = [];

    const plot = getPlot(this.plotIndex);
    if (!plot) this.showPlanting();
    else if (plot.stage < RIPE_STAGE) this.showWatering(plot);
    else this.showHarvest(plot);
  }

  clearContent() {
    this.content.forEach((o) => o.destroy());
    this.content = [];
  }

  // --- пусто: выбрать, что посадить ---
  showPlanting() {
    const w = this.scale.width;
    this.title.setText('Что посадим?');
    this.prompt.setText('Нажми на овощ — посадим его семечко');
    const options = Phaser.Utils.Array.Shuffle([...CROPS]).slice(0, 3);
    options.forEach((crop, i) => {
      const x = w / 2 + (i - 1) * (CARD + 30);
      const y = 300;
      const g = drawPanel(this.add.graphics(), x - CARD / 2, y - CARD / 2, CARD, CARD + 40, { fill: COLORS.creamShade, radius: 20 });
      const img = fitSprite(this.add.image(x, y - 6, cropSprite(crop.id, RIPE_STAGE)), CARD - 40);
      const label = this.add.text(x, y + CARD / 2 - 2, crop.word.toUpperCase(), textStyle(22, COLORS.berryShade)).setOrigin(0.5);
      const zone = this.add.zone(x, y + 20, CARD, CARD + 40).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.plant(crop));
      this.content.push(g, img, label, zone);
    });
  }

  plant(crop) {
    speak(crop.word);
    setPlot(this.plotIndex, { crop: crop.id, stage: 0 });
    this.clearContent();
    this.showWatering({ crop: crop.id, stage: 0 }, `Посадили ${crop.word.toUpperCase()} (${crop.ru})! Теперь полей.`);
  }

  // --- растёт: полить ---
  showWatering(plot, message) {
    const w = this.scale.width;
    const crop = getCrop(plot.crop);
    this.title.setText(`Растёт ${crop.word.toUpperCase()}`);
    this.prompt.setText(message ?? 'Растению нужна вода — полей его!');
    this.plantImg = fitSprite(this.add.image(w / 2, 300, cropSprite(crop.id, plot.stage)), plot.stage === 0 ? 110 : 190);
    const waterBtn = new Button(this, {
      x: w / 2,
      y: 440,
      width: 220,
      height: 58,
      label: 'Полить',
      fontSize: 26,
      variant: 'info',
      onClick: () => {
        waterBtn.setVisible(false);
        this.water(plot);
      },
    });
    this.content.push(this.plantImg, waterBtn);
  }

  water(plot) {
    const w = this.scale.width;
    // капли воды падают на растение
    for (let i = 0; i < 9; i++) {
      const drop = this.add.ellipse(w / 2 - 60 + Math.random() * 120, 170, 10, 16, COLORS.sky).setStrokeStyle(2, COLORS.ink);
      this.tweens.add({ targets: drop, y: 300 + Math.random() * 40, alpha: 0, delay: i * 70, duration: 520, onComplete: () => drop.destroy() });
    }
    const next = { crop: plot.crop, stage: plot.stage + 1 };
    setPlot(this.plotIndex, next);
    this.time.delayedCall(800, () => {
      this.clearContent();
      if (next.stage < RIPE_STAGE) this.showWatering(next, 'Растёт! Полей ещё разок.');
      else {
        const img = fitSprite(this.add.image(w / 2, 300, cropSprite(next.crop, next.stage)), 200);
        this.content.push(img);
        this.tweens.add({ targets: img, scale: img.scale * 1.15, duration: 220, yoyo: true });
        this.time.delayedCall(700, () => {
          this.clearContent();
          this.showHarvest(next);
        });
      }
    });
  }

  // --- созрело: что выросло? ---
  showHarvest(plot) {
    const w = this.scale.width;
    this.target = getCrop(plot.crop);
    this.title.setText('Урожай созрел!');
    this.prompt.setText('Что выросло? Выбери слово');
    const img = fitSprite(this.add.image(w / 2, 250, cropSprite(plot.crop, RIPE_STAGE)), 170);
    this.content.push(img);
    const others = Phaser.Utils.Array.Shuffle(CROPS.filter((c) => c !== this.target)).slice(0, 2);
    const options = Phaser.Utils.Array.Shuffle([this.target, ...others]);
    this.wordBtns = options.map((crop, i) => {
      const x = w / 2 + (i - 1) * 205;
      const btn = new Button(this, { x, y: 400, width: 160, height: 56, label: crop.word.toUpperCase(), fontSize: 22, variant: 'secondary', onClick: () => this.harvest(crop) });
      // для не читающих детей: послушать вариант
      const say = new Button(this, { x, y: 448, width: 56, height: 34, variant: 'info', icon: (g, cx, cy, color) => drawSpeakerIcon(g, cx, cy, color, 18), onClick: () => speak(crop.word) });
      this.content.push(btn, say);
      return { crop, btn };
    });
  }

  harvest(crop) {
    if (this.answered) return;
    this.answered = true;
    const correct = crop === this.target;
    const stars = correct ? STARS_RIGHT : STARS_WRONG;
    this.wordBtns.forEach(({ crop: c, btn }) => {
      if (c === this.target) btn.setVariant('good');
      else if (c === crop) btn.setVariant('bad');
    });
    speak(this.target.word);
    setPlot(this.plotIndex, null);
    markHarvested(this.target.id);
    addStars(stars);
    this.prompt.setText(`${this.target.word.toUpperCase()} — ${this.target.ru}`);
    this.result.setText(correct ? `Верно! +${stars} ★` : `Это ${this.target.word.toUpperCase()}! +${stars} ★`).setY(495);
    this.doneBtn.setY(545).setVisible(true);
  }

  close() {
    this.scene.stop();
    this.scene.resume('World');
  }
}
