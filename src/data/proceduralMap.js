// Процедурная генерация карты биома: комнаты + коридоры (BSP-lite / random
// placement), детерминированная по seed — один и тот же биом всегда даёт
// одну и ту же карту в рамках сессии/перезагрузок, чтобы туман войны и
// пространственная память игрока не "ломались" между заходами.
// Визуальную идентичность биому даёт фон/спрайты, не форма карты.

// mulberry32 — маленький быстрый seedable PRNG (детерминированный по числу)
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function roomsOverlap(a, b, pad = 1) {
  return !(a.x2 + pad < b.x1 || b.x2 + pad < a.x1 || a.y2 + pad < b.y1 || b.y2 + pad < a.y1);
}

function roomCenter(room) {
  return { col: Math.floor((room.x1 + room.x2) / 2), row: Math.floor((room.y1 + room.y2) / 2) };
}

export function generateDungeon({
  seed,
  monsterCount,
  chestCount = 2,
  width = 32,
  height = 20,
  minRoomSize = 4,
  maxRoomSize = 7,
}) {
  const rand = mulberry32(seed);
  const grid = Array.from({ length: height }, () => Array(width).fill('#'));
  const roomTarget = monsterCount + 2; // стартовая комната + комната на монстра + запасная
  const rooms = [];

  let attempts = 0;
  while (rooms.length < roomTarget && attempts < roomTarget * 40) {
    attempts++;
    const w = minRoomSize + Math.floor(rand() * (maxRoomSize - minRoomSize + 1));
    const h = minRoomSize + Math.floor(rand() * (maxRoomSize - minRoomSize + 1));
    const x1 = 1 + Math.floor(rand() * (width - w - 2));
    const y1 = 1 + Math.floor(rand() * (height - h - 2));
    const room = { x1, y1, x2: x1 + w - 1, y2: y1 + h - 1 };
    if (rooms.some((r) => roomsOverlap(r, room))) continue;
    rooms.push(room);
  }

  // На случай тесной карты/невезучих попыток — гарантируем хотя бы одну комнату
  if (rooms.length === 0) {
    rooms.push({ x1: 1, y1: 1, x2: Math.min(width - 2, 6), y2: Math.min(height - 2, 5) });
  }

  for (const r of rooms) {
    for (let y = r.y1; y <= r.y2; y++) {
      for (let x = r.x1; x <= r.x2; x++) {
        grid[y][x] = '.';
      }
    }
  }

  function carveCorridor(x1, y1, x2, y2) {
    let x = x1;
    let y = y1;
    const horizontalFirst = rand() < 0.5;
    if (horizontalFirst) {
      while (x !== x2) {
        grid[y][x] = '.';
        x += x < x2 ? 1 : -1;
      }
      while (y !== y2) {
        grid[y][x] = '.';
        y += y < y2 ? 1 : -1;
      }
    } else {
      while (y !== y2) {
        grid[y][x] = '.';
        y += y < y2 ? 1 : -1;
      }
      while (x !== x2) {
        grid[y][x] = '.';
        x += x < x2 ? 1 : -1;
      }
    }
    grid[y2][x2] = '.';
  }

  // Соединяем комнаты цепочкой в порядке размещения — гарантирует связность
  // без сложного MST, для нашего масштаба карт этого достаточно.
  for (let i = 1; i < rooms.length; i++) {
    const a = roomCenter(rooms[i - 1]);
    const b = roomCenter(rooms[i]);
    carveCorridor(a.col, a.row, b.col, b.row);
  }

  const layout = grid.map((row) => row.join(''));
  const playerStart = roomCenter(rooms[0]);

  // Монстры — по одному в центре каждой не-стартовой комнаты; если монстров
  // больше, чем свободных комнат, докидываем оставшихся в те же комнаты со
  // смещением.
  const monsterRooms = rooms.slice(1);
  const monsterTiles = [];
  for (let i = 0; i < monsterCount; i++) {
    const room = monsterRooms.length > 0 ? monsterRooms[i % monsterRooms.length] : rooms[0];
    const offset = Math.floor(i / Math.max(monsterRooms.length, 1));
    const center = roomCenter(room);
    const col = Phaser_clampToRoom(center.col + offset, room.x1, room.x2);
    monsterTiles.push({ col, row: center.row });
  }

  // Сундуки — в дальнем углу комнат (без лишних вызовов rand(), чтобы не
  // поменять уже знакомую игрокам форму карт). Пропускаем клетки монстров.
  const chestTiles = [];
  for (const room of rooms.slice(1)) {
    if (chestTiles.length >= chestCount) break;
    const tile = { col: room.x2, row: room.y2 };
    if (monsterTiles.some((t) => t.col === tile.col && t.row === tile.row)) continue;
    chestTiles.push(tile);
  }

  return { layout, playerStart, monsterTiles, chestTiles };
}

// маленький локальный хелпер без зависимости от Phaser в data-слое
function Phaser_clampToRoom(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
