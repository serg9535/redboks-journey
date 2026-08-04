import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { WorldScene } from './scenes/WorldScene.js';
import { BattleScene } from './scenes/BattleScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'app',
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 960,
    height: 640,
  },
  // default 32 is lower than our total asset count; without this the loader
  // silently drops files beyond the first 32 (no error, no load — see BootScene)
  loader: { maxParallelDownloads: 200 },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [BootScene, WorldScene, BattleScene],
};

window.__game = new Phaser.Game(config);

// Mobile browsers (address-bar show/hide, orientation change) can settle their
// viewport size *after* Phaser's initial FIT measurement, leaving the canvas
// stuck at native/unscaled size. Force a re-measure whenever the viewport
// actually changes, plus once shortly after boot as a safety net.
const refreshScale = () => window.__game.scale.refresh();
window.addEventListener('resize', refreshScale);
window.addEventListener('orientationchange', () => setTimeout(refreshScale, 100));
setTimeout(refreshScale, 100);
