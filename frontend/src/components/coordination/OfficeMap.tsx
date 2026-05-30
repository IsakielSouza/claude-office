"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CoordAgent } from "./coordinationApi";
import {
  buildWalkable,
  findPath,
  nearestWalkable,
  type Tile,
} from "./pathfinding";

// ── Camada 3, slice 2: mapa espacial estilo Gather (planta-baixa pixel-art).
// Renderizador Canvas 2D adaptado do mockup Agents-Office (pixel-office.jsx):
// reaproveita planos de sala, paleta e o sprite 8x10. Os agentes vêm do ROSTER
// real (cor por status). Movimento/A* e CEO-(Humano) = slice 3.

export const TILE = 8;
const COLS = 80;
const ROWS = 44;

const PALETTE = {
  floor1: "#1c2236",
  floor2: "#222a44",
  floorLite: "#28324f",
  wall: "#3a4569",
  wallHi: "#536284",
  wallShade: "#1d2540",
  desk: "#6b4a2e",
  deskHi: "#8a6238",
  monitor: "#0e1a2e",
  monitorOn: "#38bdf8",
  monitorOn2: "#4ade80",
  plant: "#2f6b3a",
  plantHi: "#4ade80",
  plantPot: "#5e3a1f",
};

// Planta F1 do mockup (salas + desks). É a "planta da empresa" (um andar só).
export const ROOMS = [
  { x: 1, y: 1, w: 22, h: 13, label: "DEV BAY A" },
  { x: 24, y: 1, w: 22, h: 13, label: "DEV BAY B" },
  { x: 47, y: 1, w: 14, h: 13, label: "MEETING" },
  { x: 62, y: 1, w: 17, h: 13, label: "LOUNGE" },
  { x: 1, y: 15, w: 30, h: 14, label: "OPEN FLOOR" },
  { x: 32, y: 15, w: 22, h: 14, label: "WAR ROOM" },
  { x: 55, y: 15, w: 24, h: 14, label: "KITCHEN" },
  { x: 1, y: 30, w: 22, h: 13, label: "STAND-UP" },
  { x: 24, y: 30, w: 30, h: 13, label: "DESIGN STUDIO" },
  { x: 55, y: 30, w: 24, h: 13, label: "PHONE BOOTHS" },
];

const DESKS: [number, number][] = [
  [4, 4],
  [8, 4],
  [12, 4],
  [16, 4],
  [27, 4],
  [31, 4],
  [35, 4],
  [39, 4],
  [4, 18],
  [8, 18],
  [12, 18],
  [16, 18],
  [20, 18],
  [24, 18],
  [35, 18],
  [39, 18],
  [43, 18],
  [60, 18],
  [64, 18],
  [68, 18],
  [4, 33],
  [8, 33],
  [12, 33],
  [27, 33],
  [31, 33],
  [35, 33],
  [39, 33],
  [43, 33],
];

// Desks contidos em cada sala (índice alinhado a ROOMS). Só as salas COM desk
// podem virar "sala de uma função" (sala = role) — #410.
const ROOM_DESKS: [number, number][][] = ROOMS.map((r) =>
  DESKS.filter(
    ([dx, dy]) =>
      dx > r.x && dx < r.x + r.w - 1 && dy > r.y && dy < r.y + r.h - 1,
  ),
);
const ROOMS_WITH_DESKS: number[] = ROOMS.map((_, i) => i).filter(
  (i) => ROOM_DESKS[i].length > 0,
);

const STATUS_COLOR: Record<string, string> = {
  busy: "#4ade80",
  idle: "#38bdf8",
  offline: "#6b7280",
};

// CEO-(Humano): presença do usuário no mapa (não é agente/roster). Spawn na área
// central (OPEN FLOOR). Click-to-walk (A*) movimenta o avatar até o tile clicado (#411).
const CEO_SPAWN_TILE: Tile = [16, 21];
const WALK_STEP_MS = 110; // tempo por tile na animação

function px(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  c: string,
  w = 1,
  h = 1,
) {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
}

function drawDesk(ctx: CanvasRenderingContext2D, tx: number, ty: number) {
  const x = tx * TILE;
  const y = ty * TILE;
  px(ctx, x + 1, y + 4, PALETTE.desk, 14, 8);
  px(ctx, x + 1, y + 4, PALETTE.deskHi, 14, 1);
  px(ctx, x + 4, y + 1, PALETTE.monitor, 8, 4);
  const on = (tx + ty) % 3 === 0 ? PALETTE.monitorOn2 : PALETTE.monitorOn;
  px(ctx, x + 5, y + 2, on, 6, 2);
}

function drawPlant(ctx: CanvasRenderingContext2D, tx: number, ty: number) {
  const x = tx * TILE;
  const y = ty * TILE;
  px(ctx, x + 2, y + 5, PALETTE.plantPot, 4, 2);
  px(ctx, x + 1, y + 1, PALETTE.plant, 6, 4);
  px(ctx, x + 2, y + 1, PALETTE.plantHi, 4, 1);
}

function drawFloor(ctx: CanvasRenderingContext2D) {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      px(
        ctx,
        x * TILE,
        y * TILE,
        (x + y) & 1 ? PALETTE.floor1 : PALETTE.floor2,
        TILE,
        TILE,
      );
    }
  }
  for (const r of ROOMS) {
    ctx.fillStyle = PALETTE.wallShade;
    ctx.fillRect(r.x * TILE, r.y * TILE, r.w * TILE, TILE);
    ctx.fillStyle = PALETTE.wall;
    ctx.fillRect(r.x * TILE, r.y * TILE, r.w * TILE, TILE - 2);
    ctx.fillStyle = PALETTE.wallHi;
    ctx.fillRect(r.x * TILE, r.y * TILE, r.w * TILE, 1);
    ctx.fillStyle = PALETTE.wall;
    ctx.fillRect(r.x * TILE, (r.y + r.h - 1) * TILE, r.w * TILE, TILE);
    ctx.fillRect(r.x * TILE, r.y * TILE, TILE, r.h * TILE);
    ctx.fillRect((r.x + r.w - 1) * TILE, r.y * TILE, TILE, r.h * TILE);
    // porta (gap na parede sul)
    const doorX = r.x + Math.floor(r.w / 2);
    ctx.fillStyle = PALETTE.floorLite;
    ctx.fillRect(doorX * TILE, (r.y + r.h - 1) * TILE, TILE * 2, TILE);
    // plantas nos cantos
    drawPlant(ctx, r.x + 1, r.y + r.h - 2);
    drawPlant(ctx, r.x + r.w - 2, r.y + r.h - 2);
  }
  for (const [dx, dy] of DESKS) drawDesk(ctx, dx, dy);
}

function drawAgent(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string,
) {
  const x = Math.round(cx) - 4;
  const y = Math.round(cy) - 8;
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(x + 1, y + 9, 6, 1);
  px(ctx, x + 2, y + 4, color, 4, 5); // corpo
  px(ctx, x + 2, y, "#f4d4b0", 4, 4); // cabeça
  px(ctx, x + 2, y, color, 4, 1); // cabelo
  px(ctx, x + 3, y + 2, "#0a0a0a", 1, 1); // olhos
  px(ctx, x + 5, y + 2, "#0a0a0a", 1, 1);
}

// CEO-(Humano): corpo violeta + coroa dourada — visual distinto dos agentes.
function drawCEO(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const x = Math.round(cx) - 4;
  const y = Math.round(cy) - 8;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(x + 1, y + 10, 6, 1);
  px(ctx, x + 2, y + 4, "#a78bfa", 4, 5); // corpo
  px(ctx, x + 2, y + 1, "#f4d4b0", 4, 3); // cabeça
  px(ctx, x + 3, y + 3, "#0a0a0a", 1, 1);
  px(ctx, x + 5, y + 3, "#0a0a0a", 1, 1);
  px(ctx, x + 2, y - 1, "#fbbf24", 4, 1); // coroa
  px(ctx, x + 2, y - 2, "#fbbf24", 1, 1);
  px(ctx, x + 4, y - 2, "#fbbf24", 1, 1);
  px(ctx, x + 6, y - 2, "#fbbf24", 1, 1);
}

interface Placed {
  agent: CoordAgent;
  cx: number;
  cy: number;
}

// Posiciona os agentes na SALA da sua FUNÇÃO (sala = role), não por índice (#410).
// Roles ordenadas com o MESMO sort dos cards do /console (buildRooms/localeCompare)
// → mapeadas 1:1 às salas com desk, em ordem. Cada agente senta num desk da sala
// da sua role. roomRole devolve o rótulo (role) de cada sala usada, p/ a legenda.
export function placeByRole(agents: CoordAgent[]): {
  placed: Placed[];
  roomRole: Map<number, string>;
} {
  const roles = [...new Set(agents.map((a) => a.role))].sort((a, b) =>
    a.localeCompare(b),
  );
  const roleRoom = new Map<string, number>();
  const roomRole = new Map<number, string>();
  roles.forEach((role, i) => {
    if (i < ROOMS_WITH_DESKS.length) {
      const roomIdx = ROOMS_WITH_DESKS[i];
      roleRoom.set(role, roomIdx);
      roomRole.set(roomIdx, role);
    }
  });
  const seatByRole = new Map<string, number>();
  const placed = agents.map((agent, i) => {
    const roomIdx = roleRoom.get(agent.role);
    const desks = roomIdx != null ? ROOM_DESKS[roomIdx] : DESKS;
    const seat = seatByRole.get(agent.role) ?? 0;
    seatByRole.set(agent.role, seat + 1);
    const [dx, dy] = desks[seat % desks.length] ?? DESKS[i % DESKS.length];
    return {
      agent,
      cx: dx * TILE + TILE / 2 + 4,
      cy: dy * TILE + TILE / 2 + 12,
    };
  });
  return { placed, roomRole };
}

export function OfficeMap({
  agents,
}: {
  agents: CoordAgent[];
}): React.ReactNode {
  const bgRef = useRef<HTMLCanvasElement>(null);
  const fgRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<Placed | null>(null);

  // ── Click-to-walk (#411): o avatar do CEO anda (A*) até o tile clicado ──────
  const [ceo, setCeo] = useState<Tile>(CEO_SPAWN_TILE);
  const ceoRef = useRef<Tile>(CEO_SPAWN_TILE);
  // ref atualizada em effect (não no render) — regra react-hooks/refs
  useEffect(() => {
    ceoRef.current = ceo;
  });
  const walkTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // grid de tiles andáveis (paredes/portas/desks) — fixo, computado uma vez
  const grid = useMemo(() => buildWalkable(COLS, ROWS, ROOMS, DESKS), []);

  // para a animação ao desmontar
  useEffect(() => {
    return () => {
      if (walkTimer.current) clearInterval(walkTimer.current);
    };
  }, []);

  function walkTo(tileX: number, tileY: number): void {
    const target = nearestWalkable(grid, tileX, tileY);
    if (!target) return;
    const path = findPath(grid, ceoRef.current, target);
    if (path.length < 2) return; // já está lá / sem caminho
    if (walkTimer.current) clearInterval(walkTimer.current);
    let i = 1; // pula o tile atual
    walkTimer.current = setInterval(() => {
      if (i >= path.length) {
        if (walkTimer.current) clearInterval(walkTimer.current);
        walkTimer.current = null;
        return;
      }
      setCeo(path[i]);
      i += 1;
    }, WALK_STEP_MS);
  }

  // desenha a planta uma vez
  useEffect(() => {
    const c = bgRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    drawFloor(ctx);
  }, []);

  // posiciona os agentes na sala da sua função (sala = role); cor por status
  const { placed, roomRole } = useMemo(() => placeByRole(agents), [agents]);

  useEffect(() => {
    const c = fgRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    for (const p of placed) {
      drawAgent(ctx, p.cx, p.cy, STATUS_COLOR[p.agent.status] ?? "#a78bfa");
    }
    drawCEO(ctx, ceo[0] * TILE + TILE / 2, ceo[1] * TILE + TILE / 2);
  }, [placed, ceo]);

  const ceoPx = { cx: ceo[0] * TILE + TILE / 2, cy: ceo[1] * TILE + TILE / 2 };

  const W = COLS * TILE;
  const H = ROWS * TILE;

  return (
    <div className="relative w-full h-full grid place-items-center overflow-hidden">
      <div
        className="relative"
        style={{
          aspectRatio: `${W} / ${H}`,
          maxHeight: "100%",
          maxWidth: "100%",
          width: "100%",
        }}
      >
        <canvas
          ref={bgRef}
          width={W}
          height={H}
          className="absolute inset-0 w-full h-full"
          style={{ imageRendering: "pixelated" }}
        />
        <canvas
          ref={fgRef}
          width={W}
          height={H}
          className="absolute inset-0 w-full h-full cursor-pointer"
          style={{ imageRendering: "pixelated" }}
          title="Clique para o CEO caminhar até o ponto"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mx = ((e.clientX - rect.left) / rect.width) * W;
            const my = ((e.clientY - rect.top) / rect.height) * H;
            walkTo(Math.floor(mx / TILE), Math.floor(my / TILE));
          }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const mx = ((e.clientX - rect.left) / rect.width) * W;
            const my = ((e.clientY - rect.top) / rect.height) * H;
            let hit: Placed | null = null;
            let best = 10;
            for (const p of placed) {
              const d = Math.hypot(p.cx - mx, p.cy - my);
              if (d < best) {
                best = d;
                hit = p;
              }
            }
            setHover(hit);
          }}
          onMouseLeave={() => setHover(null)}
        />
        {/* rótulos das salas: sala COM função mostra o role (= cards do /console);
            sala sem função fica com o rótulo genérico esmaecido */}
        {ROOMS.map((r, i) => {
          const role = roomRole.get(i);
          return (
            <div
              key={r.label}
              className={`absolute -translate-x-1/2 text-[8px] font-mono uppercase tracking-wide pointer-events-none whitespace-nowrap ${
                role ? "text-[#9aa6c4] font-bold" : "text-[#4b5573] opacity-50"
              }`}
              style={{
                left: `${((r.x + r.w / 2) * TILE * 100) / W}%`,
                top: `${(r.y * TILE * 100) / H + 1}%`,
              }}
            >
              {role ?? r.label}
            </div>
          );
        })}
        {/* CEO-(Humano): label segue o avatar (click-to-walk) */}
        <div
          className="absolute -translate-x-1/2 -translate-y-full text-[8px] font-mono text-[#a78bfa] pointer-events-none whitespace-nowrap transition-all duration-100"
          style={{
            left: `${(ceoPx.cx * 100) / W}%`,
            top: `${((ceoPx.cy - 12) * 100) / H}%`,
          }}
        >
          CEO (Humano)
        </div>
        {/* tooltip do agente */}
        {hover && (
          <div
            className="absolute -translate-x-1/2 -translate-y-full px-1.5 py-0.5 rounded bg-[#0a0e1a] border border-[#2e3653] text-[9px] font-mono whitespace-nowrap pointer-events-none z-10"
            style={{
              left: `${(hover.cx * 100) / W}%`,
              top: `${(hover.cy * 100) / H}%`,
            }}
          >
            <span
              style={{ color: STATUS_COLOR[hover.agent.status] ?? "#a78bfa" }}
            >
              ●{" "}
            </span>
            <span className="text-[#c7d0e0]">{hover.agent.nome}</span>{" "}
            <span className="text-[#4b5573]">{hover.agent.role}</span>
          </div>
        )}
      </div>
    </div>
  );
}
