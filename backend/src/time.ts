// Toda la lógica de tiempo usa la hora local del club (America/Bogota, UTC-5, sin DST),
// sin depender de la zona horaria del servidor.

export type Clock = () => Date;

export interface LocalNow {
  date: string; // YYYY-MM-DD
  hour: number; // 0–23
}

export const systemClock: Clock = () => new Date();

const BOOKING_WINDOW_DAYS = 7;

const bogotaFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Bogota',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
});

export const bogotaNow = (clock: Clock): LocalNow => {
  const parts = Object.fromEntries(
    bogotaFormatter.formatToParts(clock()).map((part) => [part.type, part.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const isValidDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const daysSinceEpoch = (date: string): number =>
  Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);

export const addDays = (date: string, days: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

// Clave comparable de un instante horario: horas transcurridas desde la época.
const hourKey = (date: string, hour: number): number => daysSinceEpoch(date) * 24 + hour;

const nowKey = (clock: Clock): number => {
  const now = bogotaNow(clock);
  return hourKey(now.date, now.hour);
};

export const bookingWindow = (clock: Clock): { firstDate: string; lastDate: string } => {
  const today = bogotaNow(clock).date;
  return { firstDate: today, lastDate: addDays(today, BOOKING_WINDOW_DAYS - 1) };
};

export const isInWindow = (date: string, clock: Clock): boolean => {
  const { firstDate, lastDate } = bookingWindow(clock);
  return date >= firstDate && date <= lastDate;
};

// Un bloque es "pasado" en cuanto llega su hora de inicio (el bloque en curso no es reservable).
export const isPastSlot = (date: string, startHour: number, clock: Clock): boolean =>
  hourKey(date, startHour) <= nowKey(clock);

// Una reserva sigue activa hasta su hora de fin (incluye la reserva en curso).
export const isActive = (date: string, startHour: number, clock: Clock): boolean =>
  hourKey(date, startHour + 1) > nowKey(clock);

export const isCancellable = (date: string, startHour: number, clock: Clock): boolean =>
  !isPastSlot(date, startHour, clock);
