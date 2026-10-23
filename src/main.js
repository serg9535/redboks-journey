import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { WorldScene } from './scenes/WorldScene.js';
import { BattleScene } from './scenes/BattleScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'app',
  pixelArt: true,
  backgroundColor: '#1b1530',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 960,
    height: 640,
  },
  // default 32 is lower than our total asset count; without this the loader
  // silently drops files beyond the first 32 (no error, no load — see BootScene)
  loader: { maxParallelDownloads: 200 },
  // 2 simultaneous pointers so WorldScene can detect pinch-zoom gestures
  input: { activePointers: 2 },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [BootScene, WorldScene, BattleScene],
};

// Phaser рисует текст в canvas один раз — если веб-шрифт ещё не загружен,
// надписи останутся системным шрифтом. Ждём Nunito, но не дольше 2 с (офлайн).
async function waitForFont() {
  if (!document.fonts) return;
  const timeout = new Promise((resolve) => setTimeout(resolve, 2000));
  await Promise.race([Promise.all([document.fonts.load('800 20px Nunito'), document.fonts.load('700 20px Nunito')]), timeout]);
}

waitForFont().then(() => {
  window.__game = new Phaser.Game(config);

  // Mobile browsers (address-bar show/hide, orientation change) can settle their
  // viewport size *after* Phaser's initial FIT measurement, leaving the canvas
  // stuck at native/unscaled size. Force a re-measure whenever the viewport
  // actually changes, plus once shortly after boot as a safety net.
  const refreshScale = () => window.__game.scale.refresh();
  window.addEventListener('resize', refreshScale);
  window.addEventListener('orientationchange', () => setTimeout(refreshScale, 100));
  // Контейнер может поменять размер и без window 'resize' (встроенные вебвью, панели).
  new ResizeObserver(refreshScale).observe(document.getElementById('app'));
  setTimeout(refreshScale, 100);
});
