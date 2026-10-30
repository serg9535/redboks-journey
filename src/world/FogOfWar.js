import { TILE_SIZE } from '../data/maps.js';
import { COLORS } from '../ui/theme.js';

const VISIBLE_RADIUS = 2;
const REMEMBERED_ALPHA = 0.5;
const UNSEEN_ALPHA = 0.9;

// Мягкий туман войны (не пугающая чернота — детская аудитория): клетки рядом
// с игроком видны полностью, посещённые — полупрозрачны, остальные скрыты.
export class FogOfWar {
  // radius — сколько клеток вокруг видно (тёмная пещера без факела — 1, с факелом — 3).
  constructor(scene, layer, layout, visitedTiles = [], radius = VISIBLE_RADIUS) {
    this.scene = scene;
    this.radius = radius;
    this.tiles = layout.map((rowStr, row) =>
      [...rowStr].map((_, col) => {
        const fog = scene.add
          .rectangle(col * TILE_SIZE + TILE_SIZE / 2, row * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE + 1, TILE_SIZE + 1, COLORS.night, UNSEEN_ALPHA)
          .setDepth(5);
        fog.visited = false;
        layer.add(fog);
        return fog;
      })
    );
    for (const [c, r] of visitedTiles) {
      const fog = this.tiles[r]?.[c];
      if (fog) {
        fog.visited = true;
        fog.setAlpha(REMEMBERED_ALPHA);
      }
    }
  }

  reveal(col, row, instant = false) {
    this.tiles.forEach((rowArr, r) =>
      rowArr.forEach((fog, c) => {
        const dist = Math.max(Math.abs(c - col), Math.abs(r - row));
        let alpha;
        if (dist <= this.radius) {
          alpha = 0;
          fog.visited = true;
        } else if (fog.visited) {
          alpha = REMEMBERED_ALPHA;
        } else {
          return;
        }
        if (fog.alpha === alpha) return;
        if (instant) fog.setAlpha(alpha);
        else this.scene.tweens.add({ targets: fog, alpha, duration: 220, ease: 'Quad.easeOut' });
      })
    );
  }

  visitedTiles() {
    const visited = [];
    this.tiles.forEach((rowArr, r) => rowArr.forEach((fog, c) => fog.visited && visited.push([c, r])));
    return visited;
  }
}
