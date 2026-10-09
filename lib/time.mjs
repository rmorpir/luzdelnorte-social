// Fecha y hora "de pared" en la zona horaria del fotógrafo (por defecto Europe/Madrid),
// con independencia de la zona horaria del servidor (Netlify funciona en UTC).

export function parts(date, timeZone) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23'
  });
  const o = {};
  for (const p of f.formatToParts(date)) o[p.type] = p.value;
  const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[o.weekday];
  return { date: `${o.year}-${o.month}-${o.day}`, hm: `${o.hour}:${o.minute}`, weekday: wd };
}

export function toMinutes(hm) {
  const [h, m] = String(hm || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(dateStr) {
  return new Date(dateStr + 'T12:00:00Z').getUTCDay();
}
