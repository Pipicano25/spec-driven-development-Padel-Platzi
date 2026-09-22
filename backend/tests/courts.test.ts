import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, registerAndLogin } from './helpers.js';

const NOW = new Date('2026-09-22T19:30:00Z'); // 2026-09-22 14:30 Bogotá

let ctx: ReturnType<typeof createTestApp>;

beforeEach(() => {
  ctx = createTestApp(NOW);
});

describe('GET /api/courts', () => {
  it('exige sesión', async () => {
    const res = await request(ctx.app).get('/api/courts');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('devuelve exactamente las 5 canchas y la ventana de 7 días', async () => {
    const agent = await registerAndLogin(ctx.app, 'ana@test.com');
    const res = await agent.get('/api/courts');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      courts: [
        { id: 'laureles', name: 'Cancha Laureles' },
        { id: 'el-poblado', name: 'Cancha El Poblado' },
        { id: 'belen', name: 'Cancha Belén' },
        { id: 'robledo', name: 'Cancha Robledo' },
        { id: 'envigado', name: 'Cancha Envigado' },
      ],
      bookingWindow: { firstDate: '2026-09-22', lastDate: '2026-09-28' },
    });
  });
});

describe('GET /api/courts/:courtId/availability', () => {
  it('exige sesión', async () => {
    const res = await request(ctx.app).get('/api/courts/laureles/availability?date=2026-09-23');
    expect(res.status).toBe(401);
  });

  it('devuelve 24 bloques y marca como no seleccionables los ya comenzados', async () => {
    const agent = await registerAndLogin(ctx.app, 'ana@test.com');
    const res = await agent.get('/api/courts/laureles/availability?date=2026-09-22');
    expect(res.status).toBe(200);
    expect(res.body.courtId).toBe('laureles');
    expect(res.body.date).toBe('2026-09-22');
    expect(res.body.slots).toHaveLength(24);
    expect(res.body.slots.map((s: { startHour: number }) => s.startHour)).toEqual(
      Array.from({ length: 24 }, (_, i) => i),
    );
    for (let hour = 0; hour <= 14; hour++) {
      expect(res.body.slots[hour]).toEqual({
        startHour: hour,
        status: 'available',
        selectable: false,
      });
    }
    expect(res.body.slots[15]).toEqual({ startHour: 15, status: 'available', selectable: true });
  });

  it('muestra los bloques reservados sin datos del dueño, ni siquiera para el propio dueño', async () => {
    const owner = await registerAndLogin(ctx.app, 'ana@test.com');
    const other = await registerAndLogin(ctx.app, 'beto@test.com');
    await owner.post('/api/reservations').send({ courtId: 'laureles', date: '2026-09-23', startHour: 10 });

    for (const agent of [owner, other]) {
      const res = await agent.get('/api/courts/laureles/availability?date=2026-09-23');
      expect(res.body.slots[10]).toEqual({ startHour: 10, status: 'reserved', selectable: false });
      expect(JSON.stringify(res.body)).not.toMatch(/ana@test\.com|userId|user_id/);
    }

    const otherCourt = await other.get('/api/courts/belen/availability?date=2026-09-23');
    expect(otherCourt.body.slots[10].status).toBe('available');
  });

  it('valida cancha, formato de fecha y ventana', async () => {
    const agent = await registerAndLogin(ctx.app, 'ana@test.com');
    const unknown = await agent.get('/api/courts/medellin/availability?date=2026-09-23');
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.code).toBe('UNKNOWN_COURT');

    for (const date of ['2026-09-29', '2026-09-21']) {
      const res = await agent.get(`/api/courts/laureles/availability?date=${date}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('OUTSIDE_BOOKING_WINDOW');
    }

    for (const query of ['?date=22-09-2026', '']) {
      const res = await agent.get(`/api/courts/laureles/availability${query}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });
});
