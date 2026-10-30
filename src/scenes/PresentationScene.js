import Phaser from 'phaser';
import { getLocation } from '../data/locations.js';
import { VILLAGE_NPCS } from '../data/npcs.js';
import { markIntroduced } from '../data/progress.js';
import { COLORS, fitSprite, textStyle } from '../ui/theme.js';
import { Button, drawPanel, drawPips, drawSpeakerIcon } from '../ui/widgets.js';
import { canSpeak, speak } from '../ui/speech.js';

const CARD = { x: 560, y: 300, w: 440, h: 420 };
const SPRITE_SIZE = 220;
const TEACHER = VILLAGE_NPCS.find((n) => n.id === 'teacher');

// Этап Presentation из брифа: перед боями биома NPC знакомит со словами —
// картинка + слово + перевод + озвучка, по одной карточке. Запускается поверх
// поставленной на паузу WorldScene (см. WorldScene.openOverlay), дальше —
// мини-игра на сопоставление (MatchingScene), затем возврат в мир.
export class PresentationScene extends Phaser.Scene {
  constructor() {
    super('Presentation');
  }

  init(data) {
    this.locationKey = data.biomeKey;
    this.index = 0;
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    const location = getLocation(this.locationKey);
    this.words = location.words;
    markIntroduced(this.locationKey);

    const bg = this.add.image(w / 2, h / 2, location.background);
    bg.setScale(Math.max(w / bg.width, h / bg.height));
    this.add.rectangle(0, 0, w, h, COLORS.night, 0.45).setOrigin(0, 0).setInteractive();

    drawPanel(this.add.graphics(), w / 2 - 300, 14, 600, 50, { radius: 16 });
    this.add.text(w / 2, 39, `Знакомимся: ${location.label}`, textStyle(24)).setOrigin(0.5);

    // Учитель слева — тот же NPC, что в деревне, «ведёт урок».
    this.add.ellipse(150, 470, 170, 40, 0x000000, 0.3);
    const teacher = fitSprite(this.add.image(150, 390, TEACHER.sprite), 180);
    this.tweens.add({ targets: teacher, y: 382, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    drawPanel(this.add.graphics(), 30, 110, 240, 120, { radius: 16 });
    this.add.text(150, 128, TEACHER.name, textStyle(18, COLORS.berryShade)).setOrigin(0.5, 0);
    this.add
      .text(150, 158, 'Послушай слово и повтори вслух!', textStyle(17, COLORS.ink, { fontStyle: '700', align: 'center', wordWrap: { width: 210 } }))
      .setOrigin(0.5, 0);

    drawPanel(this.add.graphics(), CARD.x - CARD.w / 2, CARD.y - CARD.h / 2, CARD.w, CARD.h, { radius: 24 });
    this.cardShadow = this.add.ellipse(CARD.x, CARD.y + 30, 180, 34, 0x000000, 0.18);
    this.sprite = this.add.image(CARD.x, CARD.y - 60, this.words[0].sprite).setInteractive({ useHandCursor: true });
    this.sprite.on('pointerdown', () => this.sayCurrent());
    this.wordText = this.add.text(CARD.x, CARD.y + 80, '', textStyle(52, COLORS.berryShade)).setOrigin(0.5);
    this.ruText = this.add.text(CARD.x, CARD.y + 128, '', textStyle(22, COLORS.greyShade)).setOrigin(0.5);
    this.pips = this.add.graphics();

    if (canSpeak) {
      new Button(this, {
        x: CARD.x + CARD.w / 2 - 44,
        y: CARD.y - CARD.h / 2 + 40,
        width: 56,
        height: 50,
        variant: 'info',
        icon: (g, cx, cy, color) => drawSpeakerIcon(g, cx, cy, color),
        onClick: () => this.sayCurrent(),
      });
    }

    this.prevBtn = new Button(this, { x: CARD.x - 150, y: h - 52, width: 120, height: 56, label: '◀', fontSize: 26, variant: 'secondary', onClick: () => this.show(this.index - 1) });
    this.nextBtn = new Button(this, { x: CARD.x + 90, y: h - 52, width: 240, height: 56, label: '', fontSize: 24, variant: 'primary', onClick: () => this.next() });

    this.show(0);
  }

  show(index) {
    this.index = Phaser.Math.Clamp(index, 0, this.words.length - 1);
    const entry = this.words[this.index];
    this.sprite.setTexture(entry.sprite);
    fitSprite(this.sprite, SPRITE_SIZE);
    this.wordText.setText(entry.word.toUpperCase());
    this.ruText.setText(entry.ru ?? '');
    this.pips.clear();
    drawPips(this.pips, CARD.x, CARD.y + CARD.h / 2 - 28, this.index + 1, this.words.length, COLORS.sun, { size: 16, gap: 6 });

    this.prevBtn.setEnabled(this.index > 0);
    const last = this.index === this.words.length - 1;
    this.nextBtn.setLabel(last ? 'Играть! ★' : 'Дальше ▶').setVariant(last ? 'good' : 'primary');

    // Карточка «выпрыгивает» — привлекает внимание к новому слову.
    const scale = this.sprite.scale;
    this.sprite.setScale(scale * 0.7);
    this.tweens.add({ targets: this.sprite, scale, duration: 280, ease: 'Back.easeOut' });
    this.sayCurrent();
  }

  sayCurrent() {
    speak(this.words[this.index].word);
    // Частые тапы не должны «увозить» картинку: подпрыгивание всегда от исходной точки.
    this.bounce?.stop();
    this.sprite.setY(CARD.y - 60);
    this.bounce = this.tweens.add({ targets: this.sprite, y: CARD.y - 74, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
  }

  next() {
    if (this.index < this.words.length - 1) this.show(this.index + 1);
    else this.scene.start('Matching', { biomeKey: this.locationKey });
  }
}
