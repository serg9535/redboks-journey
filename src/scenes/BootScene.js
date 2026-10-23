import Phaser from 'phaser';
import { BIOMES } from '../data/vocab.js';
import { ALL_BACKGROUNDS } from '../data/locations.js';
import { ALL_NPCS } from '../data/npcs.js';
import { COLORS, textStyle } from '../ui/theme.js';
import { drawPanel } from '../ui/widgets.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    // BASE_URL — '/' локально и '/redboks-journey/' на GitHub Pages (см. vite.config.js)
    this.load.setBaseURL(import.meta.env.BASE_URL);

    const w = this.scale.width;
    const h = this.scale.height;
    this.cameras.main.setBackgroundColor(COLORS.night);
    this.add.text(w / 2, h / 2 - 50, "Redbok's Journey", textStyle(40, COLORS.sun)).setOrigin(0.5);
    drawPanel(this.add.graphics(), w / 2 - 200, h / 2, 400, 26, { radius: 13 });
    const bar = this.add.graphics();
    this.load.on('progress', (value) => {
      bar.clear().fillStyle(COLORS.berry, 1).fillRoundedRect(w / 2 - 196, h / 2 + 4, Math.max(18, 392 * value), 18, 9);
    });
    this.load.on('loaderror', (file) => console.error('LOAD ERROR', file.key, file.src));

    for (const key of new Set(ALL_BACKGROUNDS)) {
      this.load.image(key, `assets/backgrounds/${key}.png`);
    }
    for (const biome of Object.values(BIOMES)) {
      for (const entry of biome.words) this.load.image(entry.sprite, `assets/sprites/${entry.sprite}.png`);
    }
    for (let i = 0; i <= 10; i++) {
      const key = `redbok_${String(i).padStart(2, '0')}`;
      this.load.image(key, `assets/sprites/${key}.png`);
    }
    this.load.image('redbok_back_00', 'assets/sprites/redbok_back_00.png');
    for (const npc of ALL_NPCS) this.load.image(npc.sprite, `assets/sprites/${npc.sprite}.png`);
  }

  create() {
    this.scene.start('World', { biomeKey: 'forest' });
  }
}
