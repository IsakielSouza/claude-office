import { describe, it, expect } from "vitest";
import { timesToCron, intervalToCron, cronToEditor } from "../src/utils/cron";

describe("timesToCron", () => {
  it("gera lista de horas no mesmo minuto", () => {
    expect(
      timesToCron(["08:00", "12:00", "15:00", "18:00", "22:00", "23:00"]),
    ).toBe("0 8,12,15,18,22,23 * * *");
  });
});

describe("intervalToCron", () => {
  it("a cada 15min das 7 às 23", () => {
    expect(intervalToCron(15, 7, 23)).toBe("0,15,30,45 7-23 * * *");
  });
});

describe("intervalToCron 24h", () => {
  it("a cada 15min, janela 0-23 (24h)", () => {
    expect(intervalToCron(15, 0, 23)).toBe("0,15,30,45 0-23 * * *");
  });
});

describe("cronToEditor", () => {
  it("reconhece janela 0-23 como 24h (round-trip)", () => {
    expect(cronToEditor("0,15,30,45 0-23 * * *")).toEqual({
      mode: "interval",
      everyMin: 15,
      startHour: 0,
      endHour: 23,
      h24: true,
    });
  });
  it("reconhece intervalo", () => {
    expect(cronToEditor("0,15,30,45 7-23 * * *")).toEqual({
      mode: "interval",
      everyMin: 15,
      startHour: 7,
      endHour: 23,
    });
  });
  it("reconhece horários fixos", () => {
    expect(cronToEditor("0 8,12,15,18,23 * * *")).toEqual({
      mode: "times",
      minute: 0,
      hours: [8, 12, 15, 18, 23],
    });
  });
  it("cai em raw para expressões fora do padrão", () => {
    expect(cronToEditor("*/5 * * * *")).toEqual({ mode: "raw" });
    expect(cronToEditor("0 8 * * 1-5")).toEqual({ mode: "raw" });
  });
});
