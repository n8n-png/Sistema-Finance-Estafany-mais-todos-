// Feriados nacionais brasileiros 2026–2029
const HOLIDAYS = new Set<string>([
  // 2026
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-04-03', '2026-04-21',
  '2026-05-01', '2026-06-04', '2026-09-07', '2026-10-12', '2026-11-02',
  '2026-11-15', '2026-11-20', '2026-12-25',
  // 2027
  '2027-01-01', '2027-02-08', '2027-02-09', '2027-03-26', '2027-04-21',
  '2027-05-01', '2027-05-27', '2027-09-07', '2027-10-12', '2027-11-02',
  '2027-11-15', '2027-11-20', '2027-12-25',
  // 2028
  '2028-01-01', '2028-02-28', '2028-02-29', '2028-04-14', '2028-04-21',
  '2028-05-01', '2028-06-15', '2028-09-07', '2028-10-12', '2028-11-02',
  '2028-11-15', '2028-11-20', '2028-12-25',
  // 2029
  '2029-01-01', '2029-02-12', '2029-02-13', '2029-03-30', '2029-04-21',
  '2029-05-01', '2029-05-31', '2029-09-07', '2029-10-12', '2029-11-02',
  '2029-11-15', '2029-11-20', '2029-12-25',
]);

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isBusinessDay(date: Date): boolean {
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return false;
  return !HOLIDAYS.has(toKey(date));
}

export function getNextBusinessDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  while (!isBusinessDay(d)) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/** Count business days between two dates (exclusive start, inclusive end) */
export function countBusinessDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const d = new Date(startDate);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1); // exclusive start
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  while (d <= end) {
    if (isBusinessDay(d)) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}
