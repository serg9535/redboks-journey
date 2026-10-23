import { COLORS, fitSprite, textStyle } from './theme.js';
import { Button, drawPanel, drawSpeakerIcon } from './widgets.js';
import { canSpeak, englishWordsIn, speak } from './speech.js';

const BOX_H = 170;

// Окно диалога с NPC: портрет слева, имя, реплика. Английские слова в
// реплике (ЗАГЛАВНЫЕ) озвучиваются при показе, кнопкой 🔊 — повторно.
export class DialogueBox {
  constructor(scene, layer, npc, onClose) {
    const w = scene.scale.width;
    const h = scene.scale.height;
    const top = h - BOX_H - 14;
    const left = 14;
    const boxW = w - 28;

    this.objects = [];
    const add = (obj) => {
      this.objects.push(obj);
      layer.add(obj);
      return obj;
    };

    add(scene.add.zone(0, 0, w, h).setOrigin(0, 0).setDepth(40).setInteractive());
    add(drawPanel(scene.add.graphics().setDepth(41), left, top, boxW, BOX_H));

    const portraitBg = add(scene.add.graphics().setDepth(41));
    portraitBg.fillStyle(COLORS.creamShade, 1).fillRoundedRect(left + 14, top + 14, BOX_H - 28, BOX_H - 28, 14);
    add(fitSprite(scene.add.image(left + BOX_H / 2, top + BOX_H / 2, npc.sprite), BOX_H - 44).setDepth(42));

    const textX = left + BOX_H + 4;
    add(scene.add.text(textX, top + 16, npc.name, textStyle(22, COLORS.berryShade)).setDepth(42));
    const lineText = add(
      scene.add
        .text(textX, top + 50, '', textStyle(20, COLORS.ink, { fontStyle: '700', wordWrap: { width: boxW - BOX_H - 90 }, lineSpacing: 4 }))
        .setDepth(42)
    );
    const hint = add(scene.add.text(left + boxW - 18, top + BOX_H - 14, 'Дальше ▶', textStyle(16, COLORS.greyShade)).setOrigin(1, 1).setDepth(42));

    let words = [];
    if (canSpeak) {
      add(
        new Button(scene, {
          x: left + boxW - 44,
          y: top + 40,
          width: 52,
          height: 44,
          variant: 'info',
          icon: (g, cx, cy, color) => drawSpeakerIcon(g, cx, cy, color),
          onClick: () => words.forEach((word, i) => scene.time.delayedCall(i * 900, () => speak(word))),
        }).setDepth(43)
      );
    }

    let index = 0;
    const show = () => {
      const line = npc.lines[index];
      lineText.setText(line);
      hint.setText(index === npc.lines.length - 1 ? 'Пока! ✓' : 'Дальше ▶');
      words = englishWordsIn(line);
      if (words.length) speak(words[0]);
    };
    show();

    this.objects[0].on('pointerdown', () => {
      index++;
      if (index >= npc.lines.length) {
        this.destroy();
        onClose();
      } else {
        show();
      }
    });
  }

  destroy() {
    this.objects.forEach((o) => o.destroy());
    this.objects = [];
  }
}
