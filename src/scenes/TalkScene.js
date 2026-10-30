import Phaser from 'phaser';
import { ALL_ENTRIES } from '../data/vocab.js';
import { addStars } from '../data/progress.js';
import { COLORS, fitSprite, outlinedTextStyle, textStyle } from '../ui/theme.js';
import { Button, drawPanel, drawSpeakerIcon } from '../ui/widgets.js';
import { speak } from '../ui/speech.js';

const CARD = 150;

// Диалог с выбором (после обычных реплик NPC, если у него есть npc.talk):
// житель задаёт вопрос по-английски («Do you want an APPLE or a BANANA?»),
// ребёнок отвечает картинкой. Без answer — любой ответ хорош (житель повторяет
// фразу с выбранным словом), с answer — вопрос «на знание», за верный +1 ★.
export class TalkScene extends Phaser.Scene {
  constructor() {
    super('Talk');
  }

  init(data) {
    this.npc = data.npc;
    this.talk = Phaser.Utils.Array.GetRandom(this.npc.talk);
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.add.rectangle(0, 0, w, h, COLORS.night, 0.8).setOrigin(0, 0).setInteractive();
    drawPanel(this.add.graphics(), 60, 70, w - 120, 500, { radius: 24 });
    fitSprite(this.add.image(170, 190, this.npc.sprite), 150);
    this.add.text(260, 110, this.npc.name, textStyle(22, COLORS.berryShade)).setOrigin(0, 0.5);
    this.add.text(260, 150, this.talk.q, textStyle(26, COLORS.ink, { wordWrap: { width: 560 } })).setOrigin(0, 0);
    new Button(this, {
      x: w - 130,
      y: 120,
      width: 80,
      height: 56,
      variant: 'info',
      icon: (g, cx, cy, color) => drawSpeakerIcon(g, cx, cy, color),
      onClick: () => speak(this.talk.q),
    });
    this.reply = this.add.text(w / 2, 480, '', outlinedTextStyle(26, COLORS.sun, { align: 'center', wordWrap: { width: 760 } })).setOrigin(0.5);
    const entries = this.talk.options.map((word) => ALL_ENTRIES.find((e) => e.word === word));
    this.cards = entries.map((entry, i) => this.createCard(entry, w / 2 + (i - (entries.length - 1) / 2) * (CARD + 40), 340));
    this.done = new Button(this, { x: w / 2, y: 530, width: 200, height: 50, label: 'Пока! ▶', fontSize: 22, variant: 'good', onClick: () => this.close() }).setVisible(false);
    this.time.delayedCall(300, () => speak(this.talk.q));
  }

  createCard(entry, x, y) {
    const g = this.add.graphics();
    const draw = (fill) => {
      g.clear();
      drawPanel(g, x - CARD / 2, y - CARD / 2, CARD, CARD + 30, { fill, radius: 18 });
    };
    draw(COLORS.creamShade);
    fitSprite(this.add.image(x, y - 6, entry.sprite), CARD - 40);
    this.add.text(x, y + CARD / 2 + 4, entry.word.toUpperCase(), textStyle(20, COLORS.berryShade)).setOrigin(0.5);
    this.add.zone(x, y + 15, CARD, CARD + 30).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.choose(entry, draw));
    return { entry, draw };
  }

  choose(entry, draw) {
    if (this.answered) return speak(entry.word);
    this.answered = true;
    const article = /^[aeiou]/.test(entry.word) ? 'an' : 'a';
    if (this.talk.answer) {
      const right = entry.word === this.talk.answer;
      draw(right ? COLORS.leaf : COLORS.berry);
      if (!right) this.cards.find((c) => c.entry.word === this.talk.answer)?.draw(COLORS.leaf);
      const text = right ? this.talk.right : this.talk.wrong;
      if (right) addStars(1);
      this.reply.setText(`${text}${right ? '  +1 ★' : ''}`);
      speak(text);
    } else {
      draw(COLORS.leaf);
      const text = this.talk.reply.replace('{a}', article).replace('{word}', entry.word.toUpperCase());
      this.reply.setText(text);
      speak(text);
    }
    this.done.setVisible(true);
  }

  close() {
    this.scene.stop();
    this.scene.resume('World');
  }
}
