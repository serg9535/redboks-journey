import { isWalkable } from '../data/maps.js';

// Кратчайший путь по клеткам (BFS, 4 направления). Возвращает список шагов
// без стартовой клетки, [] если уже на месте, null если недостижимо.
export function findPath(layout, from, to) {
  if (!isWalkable(layout, to.col, to.row)) return null;
  if (from.col === to.col && from.row === to.row) return [];

  const key = (c, r) => `${c},${r}`;
  const startKey = key(from.col, from.row);
  const prev = new Map([[startKey, null]]);
  const queue = [[from.col, from.row]];

  for (let qi = 0; qi < queue.length; qi++) {
    const [c, r] = queue[qi];
    if (c === to.col && r === to.row) {
      const path = [];
      let cur = key(c, r);
      while (cur !== startKey) {
        const [pc, pr] = cur.split(',').map(Number);
        path.unshift({ col: pc, row: pr });
        cur = prev.get(cur);
      }
      return path;
    }
    for (const [nc, nr] of [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]]) {
      const nk = key(nc, nr);
      if (!prev.has(nk) && isWalkable(layout, nc, nr)) {
        prev.set(nk, key(c, r));
        queue.push([nc, nr]);
      }
    }
  }
  return null;
}
