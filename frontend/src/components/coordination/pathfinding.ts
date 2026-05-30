// Pathfinding em grid de tiles para o click-to-walk do cockpit (#411).
// Núcleo PURO (sem React/Canvas) → testável. O OfficeMap usa pra mover o avatar
// do CEO até o tile clicado, desviando de paredes (bordas das salas) e desks.

export type Tile = [number, number]; // [x, y] em tiles

export interface RoomRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Grid de tiles ANDÁVEIS (true). Espelha o `drawFloor` do OfficeMap:
 *  - chão é andável;
 *  - as 4 bordas de cada sala são parede (bloqueio);
 *  - há uma PORTA de 2 tiles no meio da parede sul (volta a ser andável);
 *  - cada desk bloqueia seu tile.
 */
export function buildWalkable(
  cols: number,
  rows: number,
  rooms: RoomRect[],
  desks: Tile[],
): boolean[][] {
  const grid: boolean[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => true),
  );
  const block = (x: number, y: number): void => {
    if (y >= 0 && y < rows && x >= 0 && x < cols) grid[y][x] = false;
  };
  const open = (x: number, y: number): void => {
    if (y >= 0 && y < rows && x >= 0 && x < cols) grid[y][x] = true;
  };

  for (const r of rooms) {
    const top = r.y;
    const bottom = r.y + r.h - 1;
    const left = r.x;
    const right = r.x + r.w - 1;
    for (let x = left; x <= right; x++) {
      block(x, top);
      block(x, bottom);
    }
    for (let y = top; y <= bottom; y++) {
      block(left, y);
      block(right, y);
    }
    // porta de 2 tiles na parede sul (igual ao drawFloor)
    const doorX = r.x + Math.floor(r.w / 2);
    open(doorX, bottom);
    open(doorX + 1, bottom);
  }

  for (const [dx, dy] of desks) block(dx, dy);

  return grid;
}

/** Tile andável mais próximo de (x,y), por anel crescente; null se nada no raio.
 *  Usado pra "snap" do clique quando o usuário clica numa parede/desk. */
export function nearestWalkable(
  walkable: boolean[][],
  x: number,
  y: number,
  maxR = 6,
): Tile | null {
  const rows = walkable.length;
  const cols = rows > 0 ? walkable[0].length : 0;
  const ok = (px: number, py: number): boolean =>
    px >= 0 && px < cols && py >= 0 && py < rows && walkable[py][px];
  if (ok(x, y)) return [x, y];
  for (let r = 1; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (ok(x + dx, y + dy)) return [x + dx, y + dy];
      }
    }
  }
  return null;
}

function key(x: number, y: number): number {
  return y * 100000 + x;
}

/**
 * A* 4-direções. Retorna o caminho do `start` ao `goal` (inclusive) como lista de
 * tiles, ou `[]` se não houver caminho (ou se start/goal forem inandáveis).
 */
export function findPath(
  walkable: boolean[][],
  start: Tile,
  goal: Tile,
): Tile[] {
  const rows = walkable.length;
  const cols = rows > 0 ? walkable[0].length : 0;
  const inBounds = (x: number, y: number): boolean =>
    x >= 0 && x < cols && y >= 0 && y < rows;
  const passable = (x: number, y: number): boolean =>
    inBounds(x, y) && walkable[y][x];

  const [sx, sy] = start;
  const [gx, gy] = goal;
  if (!passable(sx, sy) || !passable(gx, gy)) return [];
  if (sx === gx && sy === gy) return [start];

  const h = (x: number, y: number): number =>
    Math.abs(x - gx) + Math.abs(y - gy);
  const open: { x: number; y: number; f: number }[] = [
    { x: sx, y: sy, f: h(sx, sy) },
  ];
  const gScore = new Map<number, number>([[key(sx, sy), 0]]);
  const cameFrom = new Map<number, number>();

  while (open.length > 0) {
    // menor f (lista pequena: linear é suficiente p/ um grid 80x44)
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];

    if (cur.x === gx && cur.y === gy) {
      const path: Tile[] = [];
      let k: number | undefined = key(gx, gy);
      while (k !== undefined) {
        const x = k % 100000;
        const y = Math.floor(k / 100000);
        path.push([x, y]);
        k = cameFrom.get(k);
      }
      return path.reverse();
    }

    const g = gScore.get(key(cur.x, cur.y)) ?? Infinity;
    for (const [nx, ny] of [
      [cur.x + 1, cur.y],
      [cur.x - 1, cur.y],
      [cur.x, cur.y + 1],
      [cur.x, cur.y - 1],
    ] as Tile[]) {
      if (!passable(nx, ny)) continue;
      const tentative = g + 1;
      const nk = key(nx, ny);
      if (tentative < (gScore.get(nk) ?? Infinity)) {
        cameFrom.set(nk, key(cur.x, cur.y));
        gScore.set(nk, tentative);
        const f = tentative + h(nx, ny);
        const existing = open.find((n) => n.x === nx && n.y === ny);
        if (existing) existing.f = f;
        else open.push({ x: nx, y: ny, f });
      }
    }
  }
  return [];
}
