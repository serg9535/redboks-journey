import Phaser from 'phaser';
import { ALL_ENTRIES } from '../data/vocab.js';
import { addStars, getRecord, submitRecord } from '../data/progress.js';
import { COLORS, fitSprite, outlinedTextStyle, textStyle } from '../ui/theme.js';
import { drawPanel, drawPips } from '../ui/widgets.js';
import { speak } from '../ui/speech.js';
import { againButton, arenaPlayed, buildOverlay } from '../ui/overlay.js';

const DURATION = 60000;
const SWITCH_MS = 20000; // цель меняется каждые 20 с
const HEARTS = 3;
const BASKET_Y = 560;
const FLOOR_Y = 630;

// «Лови корзиной»: сверху падают картинки, корзину водят пальцем (или стрелками).
// Ловить только названное («Catch the APPLE!»), чужое — минус сердечко.
// Скорость растёт, цель меняется. Рекорд — progress.records.fruits.
export class FruitsScene extends Phaser.Scene {
  constructor() {
    super('Fruits');
  }

  create() {
    Object.assign(this, buildOverlay(this, 'Лови корзиной'));
    drawPanel(this.add.graphics(), 24, 76, 190, 210, { radius: 16 });
    this.add.text(119, 98, 'Лови только', textStyle(18)).setOrigin(0.5);
    this.targetImg = this.add.image(119, 180, 'redbok_00');
    this.targetWord = this.add.text(119, 258, '', textStyle(24, COLORS.berryShade)).setOrigin(0.5);
    this.hearts = this.add.graphics();
    const basketKey = this.textures.exists('item_basket') ? 'item_basket' : 'item_backpack';
    this.basket = fitSprite(this.add.image(this.w / 2, BASKET_Y, basketKey), 110).setDepth(5);
    this.input.on('pointermove', (p) => this.moveBasket(p.x));
    this.input.on('pointerdown', (p) => this.moveBasket(p.x));
    this.cursors = this.input.keyboard.createCursorKeys();
    this.falling = [];
    this.again = againButton(this, () => this.start());
    this.start();
  }

  moveBasket(x) {
    this.basket.x = Phaser.Math.Clamp(x, 260, this.w - 60);
  }

  start() {
    this.again.setVisible(false);
    this.falling.forEach((f) => f.img.destroy());
    this.falling = [];
    this.points = 0;
    this.lives = HEARTS;
    this.elapsed = 0;
    this.spawnIn = 800;
    this.switchIn = SWITCH_MS;
    this.over = false;
    this.pickTarget();
    this.drawHearts();
  }

  pickTarget() {
    const pool = ALL_ENTRIES.filter((e) => e.word !== this.target?.word);
    this.target = Phaser.Utils.Array.GetRandom(pool);
    this.targetImg.setTexture(this.target.sprite);
    fitSprite(this.targetImg, 120);
    this.targetWord.setText(this.target.word.toUpperCase());
    speak(`Catch the ${this.target.word}!`);
  }

  drawHearts() {
    this.hearts.clear();
    drawPips(this.hearts, 119, 310, this.lives, HEARTS, COLORS.berry);
  }

  update(_t, delta) {
    if (this.over) return;
    if (this.cursors.left.isDown) this.moveBasket(this.basket.x - delta * 0.6);
    if (this.cursors.right.isDown) this.moveBasket(this.basket.x + delta * 0.6);
    this.elapsed += delta;
    const k = Math.min(1, this.elapsed / DURATION);
    this.score.setText(`Пойманы ${this.points}   ${Math.ceil((DURATION - this.elapsed) / 1000)} с   Рекорд ${getRecord('fruits')}`);
    if (this.elapsed >= DURATION) return this.finish();

    this.switchIn -= delta;
    if (this.switchIn <= 0) {
      this.switchIn = SWITCH_MS;
      this.pickTarget();
      this.message.setText('Новая цель!');
    }
    this.spawnIn -= delta;
    if (this.spawnIn <= 0) {
      this.spawnIn = Phaser.Math.Linear(1300, 650, k);
      this.spawn(Phaser.Math.Linear(0.12, 0.3, k));
    }

    const speedK = delta;
    this.falling = this.falling.filter((f) => {
      f.img.y += f.speed * speedK;
      f.img.angle += f.spin * speedK;
      if (Math.abs(f.img.y - (BASKET_Y - 20)) < 26 && Math.abs(f.img.x - this.basket.x) < 62) {
        this.catch(f);
        return false;
      }
      if (f.img.y > FLOOR_Y) {
        f.img.destroy();
        return false;
      }
      return true;
    });
  }

  // speed — пикселей за мс; цель падает примерно в 40% случаев.
  spawn(speed) {
    const entry = Math.random() < 0.4 ? this.target : Phaser.Utils.Array.GetRandom(ALL_ENTRIES.filter((e) => e.word !== this.target.word));
    const img = fitSprite(this.add.image(Phaser.Math.Between(280, this.w - 80), 70, entry.sprite), 70).setDepth(4);
    this.falling.push({ img, entry, speed, spin: Phaser.Math.FloatBetween(-0.05, 0.05) });
  }

  catch(f) {
    const right = f.entry.word === this.target.word;
    speak(f.entry.word);
    const label = this.add.text(f.img.x, f.img.y - 30, right ? '+1' : f.entry.word.toUpperCase(), outlinedTextStyle(26, right ? COLORS.sun : COLORS.berry)).setOrigin(0.5);
    this.tweens.add({ targets: label, y: label.y - 50, alpha: 0, duration: 700, onComplete: () => label.destroy() });
    f.img.destroy();
    this.tweens.add({ targets: this.basket, scaleY: this.basket.scaleY * 0.85, duration: 80, yoyo: true });
    if (right) {
      this.points += 1;
      return;
    }
    this.lives -= 1;
    this.drawHearts();
    this.cameras.main.shake(120, 0.006);
    this.message.setText(`Это ${f.entry.word.toUpperCase()}! Лови только ${this.target.word.toUpperCase()}`);
    if (this.lives <= 0) this.finish();
  }

  finish() {
    this.over = true;
    this.falling.forEach((f) => f.img.destroy());
    this.falling = [];
    const stars = Math.floor(this.points / 4);
    if (stars) addStars(stars);
    const record = submitRecord('fruits', this.points);
    arenaPlayed();
    this.score.setText(`Пойманы ${this.points}${record ? ' — новый рекорд!' : ''}   +${stars} ★`);
    this.message.setText('');
    this.again.setVisible(true);
  }
}
