import { describe, expect, it } from 'vitest';
import {
  bogotaNow,
  bookingWindow,
  isActive,
  isCancellable,
  isInWindow,
  isPastSlot,
  isValidDate,
} from '../src/time.js';

// 2026-09-22 14:30 en Bogotá (UTC-5) = 19:30 UTC.
const clock = () => new Date('2026-09-22T19:30:00Z');

describe('time', () => {
  it('calcula la hora local de Bogotá sin importar la zona del servidor', () => {
    expect(bogotaNow(clock)).toEqual({ date: '2026-09-22', hour: 14 });
    expect(bogotaNow(() => new Date('2026-09-23T03:30:00Z'))).toEqual({
      date: '2026-09-22',
      hour: 22,
    });
  });

  it('la ventana de reserva es hoy y los 6 días siguientes', () => {
    expect(bookingWindow(clock)).toEqual({ firstDate: '2026-09-22', lastDate: '2026-09-28' });
    expect(isInWindow('2026-09-22', clock)).toBe(true);
    expect(isInWindow('2026-09-28', clock)).toBe(true);
    expect(isInWindow('2026-09-29', clock)).toBe(false);
    expect(isInWindow('2026-09-21', clock)).toBe(false);
  });

  it('el bloque en curso ya es pasado y el siguiente no', () => {
    expect(isPastSlot('2026-09-22', 14, clock)).toBe(true);
    expect(isPastSlot('2026-09-22', 13, clock)).toBe(true);
    expect(isPastSlot('2026-09-22', 15, clock)).toBe(false);
    expect(isPastSlot('2026-09-21', 23, clock)).toBe(true);
  });

  it('la reserva en curso sigue activa pero no es cancelable', () => {
    expect(isActive('2026-09-22', 14, clock)).toBe(true);
    expect(isCancellable('2026-09-22', 14, clock)).toBe(false);
    expect(isActive('2026-09-22', 13, clock)).toBe(false);
    expect(isCancellable('2026-09-22', 15, clock)).toBe(true);
  });

  it('el bloque de las 23:00 sigue activo hasta la medianoche', () => {
    const at2330 = () => new Date('2026-09-23T04:30:00Z'); // 23:30 Bogotá del 22
    const at0030 = () => new Date('2026-09-23T05:30:00Z'); // 00:30 Bogotá del 23
    expect(isActive('2026-09-22', 23, at2330)).toBe(true);
    expect(isActive('2026-09-22', 23, at0030)).toBe(false);
  });

  it('valida fechas en formato YYYY-MM-DD reales', () => {
    expect(isValidDate('2026-09-22')).toBe(true);
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('2026-9-1')).toBe(false);
    expect(isValidDate('22-09-2026')).toBe(false);
    expect(isValidDate(20260922)).toBe(false);
  });
});
