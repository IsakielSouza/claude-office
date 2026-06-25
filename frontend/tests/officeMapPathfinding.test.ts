import { describe, expect, it } from "vitest";
import {
  buildWalkable,
  findPath,
  nearestWalkable,
  type RoomRect,
  type Tile,
} from "../src/components/coordination/pathfinding";

// #411 — click-to-walk: o avatar do CEO anda até o tile clicado desviando de
// paredes (bordas das salas), entrando pela porta sul, e contornando desks.

const ROOM: RoomRect = { x: 1, y: 1, w: 5, h: 5 }; // bordas x∈1..5, y∈1..5

describe("buildWalkable", () => {
  const grid = buildWalkable(10, 10, [ROOM], [[2, 2]]);

  it("chão livre é andável; canto/parede da sala bloqueia", () => {
    expect(grid[0][0]).toBe(true); // fora da sala = chão
    expect(grid[1][1]).toBe(false); // canto (parede)
    expect(grid[1][3]).toBe(false); // parede topo
    expect(grid[3][1]).toBe(false); // parede esquerda
  });

  it("porta de 2 tiles na parede sul fica andável", () => {
    // doorX = 1 + floor(5/2) = 3 ; parede sul em y = 5
    expect(grid[5][3]).toBe(true);
    expect(grid[5][4]).toBe(true);
    expect(grid[5][2]).toBe(false); // resto da parede sul bloqueado
  });

  it("desk bloqueia o tile", () => {
    expect(grid[2][2]).toBe(false);
    expect(grid[3][3]).toBe(true); // interior livre da sala
  });
});

describe("findPath (A*)", () => {
  const open = buildWalkable(8, 8, [], []); // tudo andável

  it("acha caminho no grid aberto (start e goal inclusos)", () => {
    const path = findPath(open, [0, 0], [3, 0]);
    expect(path[0]).toEqual([0, 0]);
    expect(path[path.length - 1]).toEqual([3, 0]);
    expect(path.length).toBe(4); // 0,1,2,3
  });

  it("goal inandável → caminho vazio", () => {
    const grid = buildWalkable(10, 10, [ROOM], []);
    expect(findPath(grid, [0, 0], [1, 1])).toEqual([]); // (1,1) é parede
  });

  it("sai da sala pela porta (passa por um tile de porta)", () => {
    const grid = buildWalkable(10, 10, [ROOM], []);
    // de dentro da sala (3,3) para fora/embaixo (3,8)
    const path = findPath(grid, [3, 3], [3, 8]);
    expect(path.length).toBeGreaterThan(0);
    const doorTiles: Tile[] = [
      [3, 5],
      [4, 5],
    ];
    const usaPorta = path.some(([x, y]) =>
      doorTiles.some(([dx, dy]) => dx === x && dy === y),
    );
    expect(usaPorta).toBe(true);
  });

  it("contorna um desk no meio do caminho", () => {
    const grid = buildWalkable(8, 8, [], [[3, 0]]); // desk bloqueia (3,0)
    const path = findPath(grid, [0, 0], [6, 0]);
    expect(path.length).toBeGreaterThan(0);
    expect(path.some(([x, y]) => x === 3 && y === 0)).toBe(false); // desviou
  });
});

describe("nearestWalkable (snap do clique)", () => {
  it("devolve o próprio tile se já é andável", () => {
    const grid = buildWalkable(8, 8, [], []);
    expect(nearestWalkable(grid, 2, 2)).toEqual([2, 2]);
  });

  it("clique numa parede → snap pro andável adjacente", () => {
    const grid = buildWalkable(10, 10, [ROOM], []);
    const snap = nearestWalkable(grid, 1, 1); // (1,1) é canto/parede
    expect(snap).not.toBeNull();
    const [sx, sy] = snap as Tile;
    expect(grid[sy][sx]).toBe(true);
  });
});
