// Fecha/hora en zona horaria de Chile (America/Santiago), formato estable.
function partsSantiago(): { date: string; time: string } {
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now); // 'YYYY-MM-DD'
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Santiago", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(now); // 'HH:MM'
  return { date, time };
}

export function nowSantiago(): string {
  const { date, time } = partsSantiago();
  return `${date} ${time}`;
}
export function todaySantiago(): string {
  return partsSantiago().date;
}
export function monthSantiago(): string {
  return partsSantiago().date.slice(0, 7);
}
