import { TILE_SIZE } from '../data/maps.js';

const isWall = (layout, col, row) => {
  const r = layout[row];
  return !r || col < 0 || col >= r.length || r[col] === '#';
};

// Детерминированный «шум» по координатам клетки — чтобы крапинки на стенах
// не прыгали между заходами в локацию.
const hash = (col, row, salt) => {
  let h = (col * 374761393 + row * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// Фон локации растягивается «cover» (с сохранением пропорций, обрезая лишнее),
// а не setDisplaySize на всю карту — иначе квадратные текстуры сплющиваются
// по-разному на картах разной формы.
export function drawBackground(scene, layer, textureKey, mapW, mapH) {
  const img = scene.add.image(0, 0, textureKey).setOrigin(0, 0).setDepth(0);
  const s = Math.max(mapW / img.width, mapH / img.height);
  const ox = (mapW - img.width * s) / 2;
  const oy = (mapH - img.height * s) / 2;
  img.setScale(s).setPosition(ox, oy).setCrop(-ox / s, -oy / s, mapW / s, mapH / s);
  layer.add(img);
  return img;
}

// Стены — одним Graphics в цветах биома, с псевдо-объёмом (светлая кромка
// сверху, тёмная грань и тень над полом), чтобы они не путались с туманом.
export function drawWalls(scene, layer, layout, palette) {
  const T = TILE_SIZE;
  const g = scene.add.graphics().setDepth(1);

  layout.forEach((rowStr, row) => {
    [...rowStr].forEach((ch, col) => {
      if (ch !== '#') return;
      const x = col * T;
      const y = row * T;
      const floorAbove = !isWall(layout, col, row - 1);
      const floorBelow = !isWall(layout, col, row + 1);
      const floorLeft = !isWall(layout, col - 1, row);
      const floorRight = !isWall(layout, col + 1, row);

      g.fillStyle(palette.wall, 1).fillRect(x, y, T, T);

      for (let i = 0; i < 3; i++) {
        if (hash(col, row, i) < 0.55) continue;
        const sx = x + 6 + hash(col, row, i + 10) * (T - 16);
        const sy = y + 6 + hash(col, row, i + 20) * (T - 22);
        const size = 3 + Math.floor(hash(col, row, i + 30) * 4);
        g.fillStyle(palette.speck, 0.8).fillRect(sx, sy, size, size);
      }

      if (floorAbove) g.fillStyle(palette.top, 1).fillRect(x, y, T, 6);
      if (floorBelow) {
        g.fillStyle(palette.face, 1).fillRect(x, y + T - 14, T, 14);
        g.fillStyle(palette.edge, 1).fillRect(x, y + T - 2, T, 2);
        g.fillStyle(0x000000, 0.22).fillRect(x, y + T, T, 8);
      }
      g.fillStyle(palette.edge, 1);
      if (floorAbove) g.fillRect(x, y, T, 2);
      if (floorLeft) g.fillRect(x, y, 2, T);
      if (floorRight) g.fillRect(x + T - 2, y, 2, T);
    });
  });

  layer.add(g);
  return g;
}

// Тень под персонажем — «приземляет» спрайты на пол, у всех одинаковая.
export function addShadow(scene, layer, x, y, width = 34) {
  const shadow = scene.add.ellipse(x, y, width, width * 0.32, 0x000000, 0.28).setDepth(1.5);
  layer.add(shadow);
  return shadow;
}
