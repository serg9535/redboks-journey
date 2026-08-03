import Phaser from 'phaser';
import { BIOMES } from '../data/vocab.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    // BASE_URL is '/' locally and '/redboks-journey/' on GitHub Pages (see vite.config.js)
    this.load.setBaseURL(import.meta.env.BASE_URL);

    const bar = this.add.graphics();
    this.load.on('progress', (value) => {
      bar.clear();
      bar.fillStyle(0xe94d3f, 1);
      bar.fillRect(280, 310, 400 * value, 20);
    });

    this.load.json('manifest', 'assets/sprites/manifest.json');

    for (const biome of Object.values(BIOMES)) {
      this.load.image(biome.background, `assets/backgrounds/${biome.background}.png`);
      for (const entry of biome.words) {
        this.load.image(entry.sprite, `assets/sprites/${entry.sprite}.png`);
      }
    }

    for (let i = 0; i <= 10; i++) {
      const n = String(i).padStart(2, '0');
      this.load.image(`redbok_${n}`, `assets/sprites/redbok_${n}.png`);
    }
  }

  create() {
    // Redbok animations built from individual sliced frames (no shared grid size, so
    // Phaser's frame-based animation isn't used — WorldScene/BattleScene swap textures manually).
    this.scene.start('World', { biomeKey: 'forest' });
  }
}
