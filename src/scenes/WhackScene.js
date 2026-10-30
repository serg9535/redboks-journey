import Phaser from 'phaser';
import { ALL_ENTRIES } from '../data/vocab.js';
import { addStars, getLearnedSprites, getRecord, submitRecord } from '../data/progress.js';
import { COLORS, fitSprite, outlinedTextStyle, textStyle } from '../ui/theme.js';
import { Button, drawPanel, drawPips, drawSpeakerIcon } from '../ui/widgets.js';
import { speak } from '../ui/speech.js';
import { arenaPlayed } from '../ui/overlay.js';

const HOLE_COLS = 3;
const HOLE_ROWS = 3;
const HOLE = { x0: 330, y0: 230, dx: 150, dy: 120 };
const POPS = 30;
const SWITCH_EVERY = 10; // каждые N выскакиваний цель меняется
const TARGET_CHANCE = 0.4;
const HEARTS = 3;

// «Лови только…» (Go / No-Go — тренировка торможения): монстры выскакивают из
// норок, бить молотком только названного. Не того — минус сердечко, пропустить
// нужного не страшно. Темп растёт, каждые SWITCH_EVERY выскакиваний цель
// меняется (переключение внимания). Рекорд — progress.records.whack.
export class WhackScene extends Phaser.Scene {
  constructor() {
    super('Whack');
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.add.rectangle(0, 0, w, h, COLORS.night, 0.85).setOrigin(0, 0).setInteractive();
    drawPanel(this.add.graphics(), 12, 10, w - 24, 52, { radius: 16 });
    this.add.text(32, 36, 'Лови только…', textStyle(26, COLORS.berryShade)).setOrigin(0, 0.5);
    this.scoreText = this.add.text(w / 2 + 40, 36, '', textStyle(20)).setOrigin(0.5);
    new Button(this, { x: w - 92, y: 36, width: 140, height: 40, label: 'Закрыть', fontSize: 18, variant: 'bad', onClick: () => this.close() });

    // Цель — слева: картинка + слово + повтор.
    drawPanel(this.add.graphics(), 30, 120, 210, 300, { radius: 18 });
    this.add.text(135, 148, 'Бей только', textStyle(20)).setOrigin(0.5);
    this.targetImg = this.add.image(135, 250, 'redbok_00');
    this.targetWord = this.add.text(135, 345, '', textStyle(28, COLORS.berryShade)).setOrigin(0.5);
    new Button(this, {
      x: 135,
      y: 392,
      width: 90,
      height: 44,
      variant: 'info',
      icon: (g, cx, cy, color) => drawSpeakerIcon(g, cx, cy, color),
      onClick: () => this.sayTarget(),
    });
    this.hearts = this.add.graphics();

    this.holes = [];
    for (let r = 0; r < HOLE_ROWS; r++) {
      for (let c = 0; c < HOLE_COLS; c++) {
        const x = HOLE.x0 + c * HOLE.dx;
        const y = HOLE.y0 + r * HOLE.dy;
        const g = this.add.graphics();
        g.fillStyle(COLORS.ink, 1).fillEllipse(x, y + 34, 116, 40);
        g.fillStyle(0x4a3226, 1).fillEllipse(x, y + 34, 106, 32);
        // Монстр «вылезает» из норки: маска скрывает всё ниже её края.
        const img = this.add.image(x, y + 70, 'redbok_00').setVisible(false);
        const maskG = this.make.graphics().fillRect(x - 70, y - 80, 140, 116);
        img.setMask(maskG.createGeometryMask());
        const front = this.add.graphics();
        front.fillStyle(0x6b4a35, 1).fillEllipse(x, y + 44, 116, 22);
        const zone = this.add.zone(x, y, 130, 120).setInteractive({ useHandCursor: true });
        const hole = { x, y, img, entry: null, up: false };
        zone.on('pointerdown', () => this.hit(hole));
        this.holes.push(hole);
      }
    }
    this.hammer = this.textures.exists('item_hammer') ? fitSprite(this.add.image(0, 0, 'item_hammer'), 90).setDepth(10).setVisible(false) : null;

    this.message = this.add.text(w / 2 + 120, h - 40, '', outlinedTextStyle(24)).setOrigin(0.5);
    this.againBtn = new Button(this, { x: w / 2 + 120, y: h - 40, width: 220, height: 54, label: 'Ещё раз', fontSize: 22, variant: 'good', onClick: () => this.start() }).setVisible(false);
    this.start();
  }

  start() {
    this.againBtn.setVisible(false);
    const learned = getLearnedSprites();
    let pool = ALL_ENTRIES.filter((e) => learned.has(e.sprite));
    if (pool.length < 6) pool = ALL_ENTRIES;
    this.pool = pool;
    this.score = 0;
    this.lives = HEARTS;
    this.pops = 0;
    this.over = false;
    this.pickTarget();
    this.drawHearts();
    this.refreshScore();
    this.message.setText('');
    // Отложенные вызовы прошлой попытки не должны выскакивать в новой.
    this.gen = (this.gen ?? 0) + 1;
    const gen = this.gen;
    this.time.delayedCall(1500, () => this.popNext(gen));
  }

  pickTarget() {
    const others = this.pool.filter((e) => e.word !== this.target?.word);
    this.target = Phaser.Utils.Array.GetRandom(others);
    this.targetImg.setTexture(this.target.sprite);
    fitSprite(this.targetImg, 140);
    this.targetWord.setText(this.target.word.toUpperCase());
    this.tweens.add({ targets: this.targetImg, scale: this.targetImg.scale * 1.2, duration: 200, yoyo: true });
    this.sayTarget();
  }

  sayTarget() {
    speak(`Hit only the ${this.target.word}!`);
  }

  drawHearts() {
    this.hearts.clear();
    drawPips(this.hearts, 135, 450, this.lives, HEARTS, COLORS.berry);
  }

  refreshScore() {
    this.scoreText.setText(`Очки ${this.score}   Рекорд ${getRecord('whack')}`);
  }

  // Темп: окно показа и пауза сокращаются с каждым выскакиванием.
  popNext(gen) {
    if (this.over || gen !== this.gen) return;
    if (this.pops >= POPS) return this.finish();
    if (this.pops > 0 && this.pops % SWITCH_EVERY === 0) {
      this.pickTarget();
      this.message.setText('Новая цель!');
      this.pops += 1; // чтобы не переключаться повторно на этой же отметке
      this.time.delayedCall(1800, () => this.popNext(gen));
      return;
    }
    this.pops += 1;
    const k = this.pops / POPS;
    const showMs = Phaser.Math.Linear(1500, 800, k);
    const gapMs = Phaser.Math.Linear(700, 300, k);
    const free = this.holes.filter((hole) => !hole.up);
    const hole = Phaser.Utils.Array.GetRandom(free);
    const isTarget = Math.random() < TARGET_CHANCE;
    const distractors = this.pool.filter((e) => e.word !== this.target.word);
    hole.entry = isTarget ? this.target : Phaser.Utils.Array.GetRandom(distractors);
    hole.up = true;
    hole.hit = false;
    hole.img.setTexture(hole.entry.sprite).setVisible(true).clearTint();
    fitSprite(hole.img, 96);
    hole.img.y = hole.y + 70;
    this.tweens.add({ targets: hole.img, y: hole.y - 6, duration: 160, ease: 'Back.easeOut' });
    hole.timer = this.time.delayedCall(showMs, () => this.hide(hole));
    this.time.delayedCall(showMs + gapMs, () => this.popNext(gen));
  }

  hide(hole) {
    if (!hole.up) return;
    hole.up = false;
    hole.timer?.remove();
    this.tweens.add({ targets: hole.img, y: hole.y + 70, duration: 140, onComplete: () => hole.img.setVisible(false) });
  }

  hit(hole) {
    if (this.over || !hole.up || hole.hit) return;
    hole.hit = true;
    if (this.hammer) {
      this.hammer.setPosition(hole.x + 30, hole.y - 50).setVisible(true).setAngle(-40);
      this.tweens.add({ targets: this.hammer, angle: 10, duration: 90, yoyo: true, onComplete: () => this.hammer.setVisible(false) });
    }
    if (hole.entry.word === this.target.word) {
      this.score += 1;
      this.refreshScore();
      hole.img.setTintFill(0xffffff);
      this.time.delayedCall(80, () => hole.img.clearTint());
      const star = this.add.text(hole.x, hole.y - 40, '+1', outlinedTextStyle(28, COLORS.sun)).setOrigin(0.5);
      this.tweens.add({ targets: star, y: hole.y - 90, alpha: 0, duration: 600, onComplete: () => star.destroy() });
      this.time.delayedCall(120, () => this.hide(hole));
    } else {
      this.lives -= 1;
      this.drawHearts();
      speak(hole.entry.word);
      this.message.setText(`Это ${hole.entry.word.toUpperCase()}! Не бей!`);
      this.cameras.main.shake(140, 0.007);
      hole.img.setTint(COLORS.berry);
      this.time.delayedCall(300, () => this.hide(hole));
      if (this.lives <= 0) this.finish();
    }
  }

  finish() {
    if (this.over) return;
    this.over = true;
    this.holes.forEach((hole) => this.hide(hole));
    const stars = Math.floor(this.score / 3);
    if (stars) addStars(stars);
    const record = submitRecord('whack', this.score);
    arenaPlayed();
    this.scoreText.setText(`Очки ${this.score}${record ? ' — новый рекорд!' : ''}   +${stars} ★`);
    this.message.setText('');
    this.againBtn.setVisible(true);
  }

  close() {
    this.over = true;
    this.scene.stop();
    this.scene.resume('World');
  }
}
