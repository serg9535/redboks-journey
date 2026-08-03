import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { WorldScene } from './scenes/WorldScene.js';
import { BattleScene } from './scenes/BattleScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'app',
  width: 960,
  height: 640,
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [BootScene, WorldScene, BattleScene],
};

window.__game = new Phaser.Game(config);
