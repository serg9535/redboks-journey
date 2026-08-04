import Phaser from 'phaser';
import { BIOMES, randomChoices } from '../data/vocab.js';

const MONSTER_HP = 3;
const PLAYER_HP = 3;

export class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  init(data) {
    this.biomeKey = data.biomeKey;
    this.wordEntry = data.wordEntry;
    this.defeatedSprites = data.defeatedSprites ?? [];
    this.returnTile = data.returnTile;
    this.visitedTiles = data.visitedTiles;
    this.monsterHP = MONSTER_HP;
    this.playerHP = PLAYER_HP;
    this.locked = false;
  }

  create() {
    const biome = BIOMES[this.biomeKey];

    const bg = this.add.image(0, 0, biome.background).setOrigin(0, 0);
    bg.setDisplaySize(this.scale.width, this.scale.height);
    bg.setTint(0x9aa0c8);

    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x0a0e27, 0.35).setOrigin(0, 0);

    this.monster = this.add.image(660, 260, this.wordEntry.sprite).setScale(0.7);
    this.player = this.add.image(220, 320, 'redbok_00').setScale(0.7);

    this.hpText = this.add.text(16, 12, '', this.labelStyle());
    this.updateHpText();

    this.wordText = this.add
      .text(660, 400, this.wordEntry.word.toUpperCase(), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '42px',
        color: '#ffffff',
        stroke: '#0a0e27',
        strokeThickness: 6,
      })
      .setOrigin(0.5);

    this.instructionText = this.add
      .text(this.scale.width / 2, 40, 'Какое слово подходит к картинке?', this.labelStyle(22))
      .setOrigin(0.5, 0);

    this.buttons = [];
    for (let i = 0; i < 3; i++) {
      this.buttons.push(this.createChoiceButton(i));
    }

    this.messageText = this.add
      .text(this.scale.width / 2, this.scale.height / 2, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '48px',
        color: '#ffe37b',
        stroke: '#0a0e27',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.newRound();
  }

  labelStyle(size = 20) {
    return {
      fontFamily: 'system-ui, sans-serif',
      fontSize: `${size}px`,
      color: '#ffffff',
      stroke: '#0a0e27',
      strokeThickness: 4,
    };
  }

  createChoiceButton(index) {
    const y = 500 + index * 60;
    const bg = this.add
      .rectangle(this.scale.width / 2, y, 360, 48, 0x1b2454, 0.9)
      .setStrokeStyle(2, 0xffffff)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(this.scale.width / 2, y, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    bg.on('pointerover', () => bg.setFillStyle(0x2c3a86, 0.9));
    bg.on('pointerout', () => bg.setFillStyle(0x1b2454, 0.9));
    bg.on('pointerdown', () => this.handleChoice(label.getData('word')));

    return { bg, label };
  }

  updateHpText() {
    this.hpText.setText(`Redbok: ${'❤'.repeat(this.playerHP)}   Монстр: ${'💥'.repeat(this.monsterHP)}`);
  }

  newRound() {
    const choices = randomChoices(this.wordEntry.word, 3);
    this.buttons.forEach((btn, i) => {
      btn.label.setText(choices[i]);
      btn.label.setData('word', choices[i]);
      btn.bg.setFillStyle(0x1b2454, 0.9);
    });
    this.locked = false;
  }

  handleChoice(word) {
    if (this.locked) return;
    this.locked = true;

    if (word === this.wordEntry.word) {
      this.onCorrect();
    } else {
      this.onWrong();
    }
  }

  onCorrect() {
    this.monsterHP -= 1;
    this.updateHpText();

    this.tweens.add({
      targets: this.player,
      x: this.player.x + 80,
      duration: 120,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
    this.tweens.add({
      targets: this.monster,
      tint: 0xff6666,
      duration: 80,
      yoyo: true,
      repeat: 1,
      onStart: () => this.monster.setTintFill(0xff4d4d),
      onComplete: () => this.monster.clearTint(),
    });

    if (this.monsterHP <= 0) {
      this.player.setTexture('redbok_10');
      this.showMessage('Победа!', '#8fffb0', () => this.finishBattle(true));
    } else {
      this.time.delayedCall(500, () => this.newRound());
    }
  }

  onWrong() {
    this.playerHP -= 1;
    this.updateHpText();

    this.player.setTexture('redbok_08');
    this.cameras.main.shake(150, 0.01);

    if (this.playerHP <= 0) {
      this.player.setTexture('redbok_09');
      this.showMessage('Попробуем ещё раз позже', '#ff9c9c', () => this.finishBattle(false));
    } else {
      this.time.delayedCall(600, () => {
        this.player.setTexture('redbok_00');
        this.newRound();
      });
    }
  }

  showMessage(text, colorHex, onDone) {
    this.buttons.forEach((btn) => {
      btn.bg.disableInteractive();
    });
    this.messageText.setText(text).setColor(colorHex);
    this.time.delayedCall(1400, onDone);
  }

  finishBattle(won) {
    const defeatedSprites = [...this.defeatedSprites];
    if (won) defeatedSprites.push(this.wordEntry.sprite);
    this.scene.start('World', {
      biomeKey: this.biomeKey,
      defeatedSprites,
      retreat: !won,
      // On a win, resume exactly where the player stood — only a loss sends
      // them back to the checkpoint. Exploration progress (fog) is never
      // punished either way.
      playerTile: won ? this.returnTile : undefined,
      visitedTiles: this.visitedTiles,
    });
  }
}
