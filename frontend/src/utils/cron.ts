/** Helpers puros entre o editor amigável e a expressão cron (5 campos). */

export type CronEditor =
  | { mode: "times"; minute: number; hours: number[] }
  | { mode: "interval"; everyMin: number; startHour: number; endHour: number }
  | { mode: "raw" };

/** ["08:00","22:00"] -> "0 8,22 * * *". Assume minuto único (usa o do 1º horário). */
export function timesToCron(times: string[]): string {
  const parsed = times.map((t) => {
    const [h, m] = t.split(":").map(Number);
    return { h, m };
  });
  const minute = parsed.length ? parsed[0].m : 0;
  const hours = parsed.map((p) => p.h).sort((a, b) => a - b);
  return `${minute} ${hours.join(",")} * * *`;
}

/** intervalo de N min dentro de [startHour, endHour]. N deve dividir 60. */
export function intervalToCron(everyMin: number, startHour: number, endHour: number): string {
  const mins: number[] = [];
  for (let m = 0; m < 60; m += everyMin) mins.push(m);
  return `${mins.join(",")} ${startHour}-${endHour} * * *`;
}

function isPlainHourList(field: string): number[] | null {
  if (!/^\d+(,\d+)*$/.test(field)) return null;
  return field.split(",").map(Number);
}

/** Parse de volta pro editor; cai em {mode:"raw"} se não casar os 2 padrões. */
export function cronToEditor(expr: string): CronEditor {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return { mode: "raw" };
  const [min, hour, dom, mon, dow] = parts;
  if (dom !== "*" || mon !== "*" || dow !== "*") return { mode: "raw" };

  // intervalo: minuto = lista começando em 0 com passo constante; hora = range a-b
  const minList = isPlainHourList(min);
  const rangeMatch = hour.match(/^(\d+)-(\d+)$/);
  if (minList && minList.length >= 2 && minList[0] === 0 && rangeMatch) {
    const step = minList[1] - minList[0];
    const ok = step > 0 && minList.every((m, i) => m === i * step);
    if (ok) {
      return {
        mode: "interval",
        everyMin: step,
        startHour: Number(rangeMatch[1]),
        endHour: Number(rangeMatch[2]),
      };
    }
  }

  // horários fixos: minuto único + hora = lista simples
  const hourList = isPlainHourList(hour);
  if (/^\d+$/.test(min) && hourList) {
    return { mode: "times", minute: Number(min), hours: hourList };
  }
  return { mode: "raw" };
}
