import Phaser from 'phaser';
import { BIOMES } from '../data/vocab.js';
import { MAPS, TILE_SIZE, isWalkable, mapPixelSize } from '../data/maps.js';

const MOVE_DURATION = 160;
const VISIBLE_RADIUS = 2; // клеток вокруг игрока — полностью видно
const REMEMBERED_ALPHA = 0.55; // мягкий туман на уже посещённых, но не видимых сейчас клетках
const UNSEEN_ALPHA = 0.92;

export class WorldScene extends Phaser.Scene {
  constructor() {
    super('World');
  }

  init(data) {
    this.biomeKey = data.biomeKey ?? 'forest';
    this.defeatedSprites = data.defeatedSprites ?? [];
    this.retreat = data.retreat ?? false;
  }

  create() {
    const biome = BIOMES[this.biomeKey];
    const map = MAPS[this.biomeKey];
    this.map = map;
    this.layout = map.layout;
    const { width: mapW, height: mapH } = mapPixelSize(this.layout);

    // Фон биома под картой — накрывает всю область тайлов
    const bg = this.add.image(0, 0, biome.background).setOrigin(0, 0).setDepth(0);
    bg.setDisplaySize(mapW, mapH);

    // Стены — плашки поверх фона
    this.wallLayer = this.add.layer().setDepth(1);
    for (let row = 0; row < this.layout.length; row++) {
      for (let col = 0; col < this.layout[row].length; col++) {
        if (this.layout[row][col] === '#') {
          const wall = this.add.rectangle(
            col * TILE_SIZE + TILE_SIZE / 2,
            row * TILE_SIZE + TILE_SIZE / 2,
            TILE_SIZE,
            TILE_SIZE,
            0x241a3d,
            0.88
          );
          wall.setStrokeStyle(2, 0x3a2c5c, 0.9);
          this.wallLayer.add(wall);
        }
      }
    }

    // Монстры
    this.monsterSprites = [];
    biome.words.forEach((entry, i) => {
      if (this.defeatedSprites.includes(entry.sprite)) return;
      const tile = map.monsterTiles[i % map.monsterTiles.length];
      const img = this.add.image(
        tile.col * TILE_SIZE + TILE_SIZE / 2,
        tile.row * TILE_SIZE + TILE_SIZE / 2,
        entry.sprite
      );
      img.setScale(0.17).setDepth(2);
      img.wordEntry = entry;
      img.tile = tile;
      this.monsterSprites.push(img);
    });

    // Игрок — всегда стартует с чекпоинта карты (мягкий откат при поражении тоже сюда)
    this.playerTile = { col: map.playerStart.col, row: map.playerStart.row };
    this.player = this.add.image(
      this.playerTile.col * TILE_SIZE + TILE_SIZE / 2,
      this.playerTile.row * TILE_SIZE + TILE_SIZE / 2,
      'redbok_00'
    );
    this.player.setScale(0.26).setDepth(3);
    this.isMoving = false;

    // Туман войны
    this.fogTiles = [];
    for (let row = 0; row < this.layout.length; row++) {
      const rowArr = [];
      for (let col = 0; col < this.layout[row].length; col++) {
        const fog = this.add.rectangle(
          col * TILE_SIZE + TILE_SIZE / 2,
          row * TILE_SIZE + TILE_SIZE / 2,
          TILE_SIZE + 1,
          TILE_SIZE + 1,
          0x0a0e27,
          UNSEEN_ALPHA
        );
        fog.setDepth(5);
        fog.visited = false;
        rowArr.push(fog);
      }
      this.fogTiles.push(rowArr);
    }
    this.revealAround(this.playerTile.col, this.playerTile.row, true);

    // HUD
    this.hudBg = this.add.rectangle(0, 0, this.scale.width, 34, 0x0a0e27, 0.75).setOrigin(0, 0).setDepth(10);
    this.hpText = this.add.text(10, 7, '', this.hudStyle()).setDepth(11);
    this.wordsText = this.add.text(this.scale.width - 10, 7, '', this.hudStyle()).setOrigin(1, 0).setDepth(11);
    this.updateHud(biome);

    const hint = 'Стрелки/WASD или кнопки внизу слева — шаг за шагом. Врежься в монстра, чтобы напасть.';
    this.hintText = this.add
      .text(this.scale.width / 2, this.scale.height - 12, hint, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#ffffff',
        stroke: '#0a0e27',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(11);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');

    // Always on (not gated behind touch-capability detection): device.input.touch
    // is unreliable across mobile browsers/webviews, and the buttons are a
    // harmless small corner overlay that also works fine with a mouse.
    this.touchDirection = null;
    this.createTouchControls();

    if (this.retreat) {
      this.showToast('Redbok отдохнул и снова готов!');
    }
  }

  hudStyle() {
    return {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#ffffff',
    };
  }

  updateHud(biome) {
    const learned = biome.words.filter((w) => this.defeatedSprites.includes(w.sprite)).length;
    this.hpText.setText(`${biome.label}`);
    this.wordsText.setText(`Выучено слов: ${learned}/${biome.words.length}`);
  }

  revealAround(col, row, instant = false) {
    for (let r = 0; r < this.fogTiles.length; r++) {
      for (let c = 0; c < this.fogTiles[r].length; c++) {
        const fog = this.fogTiles[r][c];
        const dist = Math.max(Math.abs(c - col), Math.abs(r - row));
        let targetAlpha;
        if (dist <= VISIBLE_RADIUS) {
          targetAlpha = 0;
          fog.visited = true;
        } else if (fog.visited) {
          targetAlpha = REMEMBERED_ALPHA;
        } else {
          continue;
        }
        if (instant) {
          fog.setAlpha(targetAlpha);
        } else {
          this.tweens.add({ targets: fog, alpha: targetAlpha, duration: 220, ease: 'Quad.easeOut' });
        }
      }
    }
  }

  update() {
    if (this.isMoving) return;

    let dCol = 0;
    let dRow = 0;
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left) || Phaser.Input.Keyboard.JustDown(this.wasd.A)) dCol = -1;
    else if (Phaser.Input.Keyboard.JustDown(this.cursors.right) || Phaser.Input.Keyboard.JustDown(this.wasd.D)) dCol = 1;
    else if (Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.wasd.W)) dRow = -1;
    else if (Phaser.Input.Keyboard.JustDown(this.cursors.down) || Phaser.Input.Keyboard.JustDown(this.wasd.S)) dRow = 1;

    if (dCol === 0 && dRow === 0) {
      if (!this.touchDirection) return;
      ({ dCol, dRow } = this.touchDirection);
    }

    this.attemptMove(dCol, dRow);
  }

  attemptMove(dCol, dRow) {
    const targetCol = this.playerTile.col + dCol;
    const targetRow = this.playerTile.row + dRow;

    const monster = this.monsterSprites.find((m) => m.tile.col === targetCol && m.tile.row === targetRow);
    if (monster) {
      this.startBattle(monster);
      return;
    }

    if (!isWalkable(this.layout, targetCol, targetRow)) return;

    this.isMoving = true;
    if (dCol !== 0) this.player.setFlipX(dCol < 0);

    this.playerTile = { col: targetCol, row: targetRow };
    this.tweens.add({
      targets: this.player,
      x: targetCol * TILE_SIZE + TILE_SIZE / 2,
      y: targetRow * TILE_SIZE + TILE_SIZE / 2,
      duration: MOVE_DURATION,
      ease: 'Linear',
      onComplete: () => {
        this.isMoving = false;
      },
    });
    this.revealAround(targetCol, targetRow);
  }

  createTouchControls() {
    const cx = 92;
    const cy = this.scale.height - 150;
    const gap = 62;
    const size = 56;
    const dirs = [
      { dx: 0, dy: -gap, dCol: 0, dRow: -1, label: '▲' },
      { dx: 0, dy: gap, dCol: 0, dRow: 1, label: '▼' },
      { dx: -gap, dy: 0, dCol: -1, dRow: 0, label: '◀' },
      { dx: gap, dy: 0, dCol: 1, dRow: 0, label: '▶' },
    ];

    dirs.forEach(({ dx, dy, dCol, dRow, label }) => {
      const bx = cx + dx;
      const by = cy + dy;
      const btn = this.add.rectangle(bx, by, size, size, 0x1b2454, 0.55).setDepth(25);
      btn.setStrokeStyle(2, 0xffffff, 0.5);
      btn.setInteractive({ useHandCursor: true });
      this.add.text(bx, by, label, { fontSize: '22px', color: '#ffffff' }).setOrigin(0.5).setDepth(26);

      const press = () => {
        this.touchDirection = { dCol, dRow };
        btn.setFillStyle(0x3a4a9a, 0.75);
        if (!this.isMoving) this.attemptMove(dCol, dRow);
      };
      const release = () => {
        if (this.touchDirection && this.touchDirection.dCol === dCol && this.touchDirection.dRow === dRow) {
          this.touchDirection = null;
        }
        btn.setFillStyle(0x1b2454, 0.55);
      };

      btn.on('pointerdown', press);
      btn.on('pointerup', release);
      btn.on('pointerout', release);
    });
  }

  startBattle(monster) {
    this.scene.start('Battle', {
      biomeKey: this.biomeKey,
      wordEntry: monster.wordEntry,
      defeatedSprites: [...this.defeatedSprites],
    });
  }

  showToast(text) {
    const toast = this.add
      .text(this.scale.width / 2, 60, text, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#ffe37b',
        stroke: '#0a0e27',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.tweens.add({ targets: toast, alpha: 0, delay: 1200, duration: 500, onComplete: () => toast.destroy() });
  }
}
