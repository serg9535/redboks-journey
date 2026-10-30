import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { WorldScene } from './scenes/WorldScene.js';
import { BattleScene } from './scenes/BattleScene.js';
import { PresentationScene } from './scenes/PresentationScene.js';
import { MatchingScene } from './scenes/MatchingScene.js';
import { CollectionScene } from './scenes/CollectionScene.js';
import { ChestScene } from './scenes/ChestScene.js';
import { ShopScene } from './scenes/ShopScene.js';
import { GardenScene } from './scenes/GardenScene.js';
import { InventoryScene } from './scenes/InventoryScene.js';
import { DictationScene } from './scenes/DictationScene.js';
import { MemoryScene } from './scenes/MemoryScene.js';
import { WhackScene } from './scenes/WhackScene.js';
import { StroopScene } from './scenes/StroopScene.js';
import { SchulteScene } from './scenes/SchulteScene.js';
import { LogicScene } from './scenes/LogicScene.js';
import { FruitsScene } from './scenes/FruitsScene.js';
import { SimonSaysScene } from './scenes/SimonSaysScene.js';
import { PhraseScene } from './scenes/PhraseScene.js';
import { RhythmScene } from './scenes/RhythmScene.js';
import { TalkScene } from './scenes/TalkScene.js';

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
  // Presentation/Matching/Collection/Chest/Shop/Garden/Inventory/мини-игры Арены — оверлеи поверх WorldScene, поэтому
  // идут после неё в списке (сцены рисуются в порядке списка).
  scene: [BootScene, WorldScene, BattleScene, PresentationScene, MatchingScene, CollectionScene, ChestScene, ShopScene, GardenScene, InventoryScene, DictationScene, MemoryScene, WhackScene, StroopScene, SchulteScene, LogicScene, FruitsScene, SimonSaysScene, PhraseScene, RhythmScene, TalkScene],
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
