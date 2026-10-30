import Phaser from 'phaser';
import { BIOMES } from '../data/vocab.js';
import { getLearnedSprites, getMastery } from '../data/progress.js';
import { COLORS, fitSprite, outlinedTextStyle, textStyle } from '../ui/theme.js';
import { Button, drawPanel } from '../ui/widgets.js';
import { speak } from '../ui/speech.js';

const TOP = 80;
const LABEL_W = 160;
const CARD = 96;
const GAP = 8;
const PER_PAGE = 5; // биомов на страницу — дальше листаем ◀ ▶, а не сжимаем карточки

// Словарик-коллекция (по мотивам покедекса): по ряду на биом, карточка на
// каждого монстра. Побеждённый хотя бы раз (progress.js → learned) — цветной,
// со словом, тап озвучивает; ещё не пойманный — тёмный силуэт с «?».
// Открывается поверх поставленной на паузу WorldScene.
export class CollectionScene extends Phaser.Scene {
  constructor() {
    super('Collection');
  }

  init(data) {
    this.page = data.page ?? 0;
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    const learned = getLearnedSprites();
    const allBiomes = Object.values(BIOMES);
    const allEntries = allBiomes.flatMap((b) => b.words);
    const pages = Math.ceil(allBiomes.length / PER_PAGE);
    const biomes = allBiomes.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE);

    this.add.rectangle(0, 0, w, h, COLORS.night, 0.92).setOrigin(0, 0).setInteractive();
    drawPanel(this.add.graphics(), 12, 10, w - 24, 52, { radius: 16 });
    this.add.text(32, 36, 'Словарик', textStyle(26, COLORS.berryShade)).setOrigin(0, 0.5);
    const got = allEntries.filter((e) => learned.has(e.sprite)).length;
    this.add.text(w / 2, 36, `Собрано ★ ${got} из ${allEntries.length}`, textStyle(22)).setOrigin(0.5);
    new Button(this, { x: w - 92, y: 36, width: 140, height: 40, label: 'Закрыть', fontSize: 18, variant: 'bad', onClick: () => this.close() });

    this.ruText = this.add.text(w / 2, h - 18, 'Коснись монстра, чтобы услышать слово. ★ — мастерство', outlinedTextStyle(18)).setOrigin(0.5, 1);

    if (pages > 1) {
      const turn = (page) => this.scene.restart({ page: (page + pages) % pages });
      new Button(this, { x: 60, y: h - 26, width: 90, height: 36, label: '◀', fontSize: 20, variant: 'info', onClick: () => turn(this.page - 1) });
      new Button(this, { x: w - 60, y: h - 26, width: 90, height: 36, label: '▶', fontSize: 20, variant: 'info', onClick: () => turn(this.page + 1) });
      this.add.text(w - 120, h - 26, `${this.page + 1}/${pages}`, outlinedTextStyle(18)).setOrigin(1, 0.5);
    }

    const rowH = Math.min(CARD + GAP + 10, (h - TOP - 40) / PER_PAGE);
    const card = Math.min(CARD, rowH - GAP - 6);
    biomes.forEach((biome, row) => {
      const y = TOP + row * rowH + rowH / 2;
      this.add.text(24, y, biome.label, outlinedTextStyle(18, COLORS.cream, { wordWrap: { width: LABEL_W - 16 } })).setOrigin(0, 0.5);
      biome.words.forEach((entry, i) => this.createCard(entry, LABEL_W + 20 + i * (card + GAP) + card / 2, y, card, learned.has(entry.sprite)));
    });
  }

  createCard(entry, x, y, size, owned) {
    const g = this.add.graphics();
    drawPanel(g, x - size / 2, y - size / 2, size, size, { fill: owned ? COLORS.cream : COLORS.greyShade, radius: 14 });
    const image = fitSprite(this.add.image(x, y - (owned ? 9 : 0), entry.sprite), size - (owned ? 30 : 18));
    if (!owned) {
      image.setTintFill(COLORS.ink).setAlpha(0.75);
      this.add.text(x, y, '?', outlinedTextStyle(30, COLORS.cream)).setOrigin(0.5);
      return;
    }
    this.add.text(x, y + size / 2 - 12, entry.word, textStyle(Math.min(14, (size * 1.6) / entry.word.length), COLORS.ink)).setOrigin(0.5);
    // Звёзды мастерства: 3 / 6 / 10 верных ответов про это слово (progress.mastery).
    const m = getMastery(entry.sprite);
    const level = m >= 10 ? 3 : m >= 6 ? 2 : m >= 3 ? 1 : 0;
    if (level) this.add.text(x + size / 2 - 4, y - size / 2 + 2, '★'.repeat(level), outlinedTextStyle(13, COLORS.sun)).setOrigin(1, 0);
    if (level === 3) g.lineStyle(3, COLORS.sun, 1).strokeRoundedRect(x - size / 2 - 1, y - size / 2 - 1, size + 2, size + 2, 14);
    const baseY = image.y;
    let bounce;
    const zone = this.add.zone(x, y, size, size).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      speak(entry.word);
      this.ruText.setText(`${entry.word.toUpperCase()} — ${entry.ru}`);
      bounce?.stop();
      image.setY(baseY);
      bounce = this.tweens.add({ targets: image, y: baseY - 8, duration: 120, yoyo: true });
    });
  }

  close() {
    this.scene.stop();
    this.scene.resume('World');
  }
}
