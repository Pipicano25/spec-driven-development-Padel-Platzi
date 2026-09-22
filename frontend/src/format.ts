const pad = (hour: number): string => String(hour % 24).padStart(2, '0');

// 23 → "23:00 – 00:00"
export const formatHourRange = (startHour: number): string =>
  `${pad(startHour)}:00 – ${pad(startHour + 1)}:00`;

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

// "2026-09-22" → "martes, 22 de septiembre de 2026", sin desplazar el día por la zona horaria.
export const formatDate = (date: string): string => {
  const [year, month, day] = date.split('-').map(Number);
  return dateFormatter.format(new Date(Date.UTC(year, month - 1, day)));
};
