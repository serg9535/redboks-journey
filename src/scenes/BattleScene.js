import Phaser from 'phaser';
import { randomChoices } from '../data/vocab.js';
import { getLocation } from '../data/locations.js';
import { getShowTranslation } from '../data/settings.js';
import { COLORS, fitSprite, outlinedTextStyle, textStyle } from '../ui/theme.js';
import { Button, drawPanel, drawPips, drawSpeakerIcon } from '../ui/widgets.js';
import { canSpeak, speak } from '../ui/speech.js';

const MONSTER_HP = 3;
const PLAYER_HP = 3;
const PLAYER_POS = { x: 250, y: 290 };
const MONSTER_POS = { x: 700, y: 270 };

// Этап Production из брифа: слово не показывается заранее — ребёнок сам
// узнаёт монстра и выбирает слово. Кнопка 🔊 у варианта даёт его услышать
// (для тех, кто ещё не читает). Правильное слово раскрывается после ответа.
export class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  init(data) {
    this.locationKey = data.biomeKey;
    this.wordEntry = data.wordEntry;
    this.defeatedSprites = data.defeatedSprites ?? [];
    this.returnTile = data.returnTile;
    this.visitedTiles = data.visitedTiles;
    this.monsterHP = MONSTER_HP;
    this.playerHP = PLAYER_HP;
    this.locked = false;
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    const location = getLocation(this.locationKey);

    const bg = this.add.image(w / 2, h / 2, location.background);
    bg.setScale(Math.max(w / bg.width, h / bg.height));
    this.add.rectangle(0, 0, w, h, COLORS.night, 0.3).setOrigin(0, 0);

    this.add.ellipse(PLAYER_POS.x, PLAYER_POS.y + 95, 170, 40, 0x000000, 0.3);
    this.add.ellipse(MONSTER_POS.x, MONSTER_POS.y + 115, 220, 50, 0x000000, 0.3);
    this.player = fitSprite(this.add.image(PLAYER_POS.x, PLAYER_POS.y, 'redbok_00'), 200);
    this.monster = fitSprite(this.add.image(MONSTER_POS.x, MONSTER_POS.y, this.wordEntry.sprite), 250);
    this.tweens.add({ targets: this.monster, y: MONSTER_POS.y - 8, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.hp = this.add.graphics();
    this.drawHp();

    drawPanel(this.add.graphics(), w / 2 - 230, 14, 460, 50, { radius: 16 });
    this.add.text(w / 2, 39, 'Кто это? Выбери слово!', textStyle(24)).setOrigin(0.5);

    this.revealWord = this.add.text(MONSTER_POS.x, 418, '', outlinedTextStyle(44, COLORS.sun)).setOrigin(0.5).setAlpha(0);
    this.revealRu = this.add.text(MONSTER_POS.x, 456, '', outlinedTextStyle(20)).setOrigin(0.5).setAlpha(0);

    this.choices = [0, 1, 2].map((i) => this.createChoice(w / 2 + (i - 1) * 306, h - 64));

    this.banner = this.add.text(w / 2, h / 2 - 20, '', outlinedTextStyle(56, COLORS.sun)).setOrigin(0.5).setDepth(20).setAlpha(0);

    this.newRound();
  }

  createChoice(x, y) {
    const hasSpeaker = canSpeak;
    const wordW = hasSpeaker ? 214 : 280;
    const choice = { word: '' };
    choice.button = new Button(this, {
      x: hasSpeaker ? x - 34 : x,
      y,
      width: wordW,
      height: 60,
      fontSize: 26,
      variant: 'secondary',
      onClick: () => this.handleChoice(choice),
    });
    if (hasSpeaker) {
      choice.speaker = new Button(this, {
        x: x + wordW / 2 + 10,
        y,
        width: 56,
        height: 60,
        variant: 'info',
        icon: (g, cx, cy, color) => drawSpeakerIcon(g, cx, cy, color),
        onClick: () => speak(choice.word),
      });
    }
    return choice;
  }

  drawHp() {
    this.hp.clear();
    drawPips(this.hp, PLAYER_POS.x, PLAYER_POS.y + 135, this.playerHP, PLAYER_HP, COLORS.berry);
    drawPips(this.hp, MONSTER_POS.x, 92, this.monsterHP, MONSTER_HP, COLORS.sun);
  }

  newRound() {
    const words = randomChoices(this.wordEntry.word, 3);
    this.choices.forEach((choice, i) => {
      choice.word = words[i];
      choice.button.setLabel(words[i]).setVariant('secondary').setEnabled(true);
    });
    this.tweens.add({ targets: [this.revealWord, this.revealRu], alpha: 0, duration: 200 });
    this.locked = false;
  }

  handleChoice(choice) {
    if (this.locked) return;
    this.locked = true;
    if (choice.word === this.wordEntry.word) this.onCorrect(choice);
    else this.onWrong(choice);
  }

  // Показ правильного слова (+ перевод, если включён) и его произношение —
  // и после верного, и после неверного ответа: ребёнок всегда видит и слышит ответ.
  reveal() {
    this.revealWord.setText(this.wordEntry.word.toUpperCase());
    this.revealRu.setText(getShowTranslation() ? this.wordEntry.ru ?? '' : '');
    this.tweens.add({ targets: [this.revealWord, this.revealRu], alpha: 1, duration: 200 });
    speak(this.wordEntry.word);
  }

  onCorrect(choice) {
    choice.button.setVariant('good');
    this.monsterHP -= 1;
    this.drawHp();
    this.reveal();

    this.tweens.add({ targets: this.player, x: PLAYER_POS.x + 90, duration: 130, yoyo: true, ease: 'Quad.easeOut' });
    this.time.delayedCall(130, () => {
      this.monster.setTintFill(0xffffff);
      this.time.delayedCall(90, () => this.monster.clearTint());
    });

    if (this.monsterHP <= 0) {
      this.setPlayerFrame('redbok_10');
      this.tweens.add({ targets: this.monster, alpha: 0, scale: this.monster.scale * 0.6, delay: 500, duration: 500 });
      this.showBanner('Победа!', COLORS.leaf, () => this.finish(true));
    } else {
      this.time.delayedCall(1300, () => this.newRound());
    }
  }

  onWrong(choice) {
    choice.button.setVariant('bad');
    this.choices.find((c) => c.word === this.wordEntry.word)?.button.setVariant('good');
    this.playerHP -= 1;
    this.drawHp();
    this.reveal();
    this.setPlayerFrame('redbok_08');
    this.cameras.main.shake(150, 0.008);

    if (this.playerHP <= 0) {
      this.setPlayerFrame('redbok_09');
      this.showBanner('Попробуем ещё раз!', COLORS.sky, () => this.finish(false));
    } else {
      this.time.delayedCall(1600, () => {
        this.setPlayerFrame('redbok_00');
        this.newRound();
      });
    }
  }

  setPlayerFrame(key) {
    this.player.setTexture(key);
    fitSprite(this.player, 200);
  }

  showBanner(text, color, onDone) {
    this.choices.forEach((c) => c.button.setEnabled(false));
    this.banner.setText(text).setColor(`#${color.toString(16).padStart(6, '0')}`).setScale(0.6);
    this.tweens.add({ targets: this.banner, alpha: 1, scale: 1, duration: 300, ease: 'Back.easeOut' });
    this.time.delayedCall(1700, onDone);
  }

  finish(won) {
    const defeatedSprites = [...this.defeatedSprites];
    if (won) defeatedSprites.push(this.wordEntry.sprite);
    this.scene.start('World', {
      biomeKey: this.locationKey,
      defeatedSprites,
      retreat: !won,
      // Победа — продолжаем с того же места; поражение — мягкий откат на
      // чекпоинт карты. Исследованный туман не теряется в обоих случаях.
      playerTile: won ? this.returnTile : undefined,
      visitedTiles: this.visitedTiles,
    });
  }
}
