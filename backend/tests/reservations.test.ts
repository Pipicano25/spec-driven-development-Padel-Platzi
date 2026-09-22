import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, HOUR, registerAndLogin } from './helpers.js';

const NOW = new Date('2026-09-22T19:30:00Z'); // 2026-09-22 14:30 Bogotá

let ctx: ReturnType<typeof createTestApp>;

beforeEach(() => {
  ctx = createTestApp(NOW);
});

const reservationCount = (): number =>
  (ctx.db.prepare('SELECT COUNT(*) AS n FROM reservations').get() as { n: number }).n;

const slot = (overrides: Record<string, unknown> = {}) => ({
  courtId: 'laureles',
  date: '2026-09-23',
  startHour: 10,
  ...overrides,
});

describe('POST /api/reservations', () => {
  it('crea la reserva y devuelve sus datos', async () => {
    const agent = await registerAndLogin(ctx.app, 'ana@test.com');
    const res = await agent.post('/api/reservations').send(slot());
    expect(res.status).toBe(201);
    expect(res.body.reservation).toEqual({
      id: expect.any(Number),
      courtId: 'laureles',
      courtName: 'Cancha Laureles',
      date: '2026-09-23',
      startHour: 10,
      endHour: 11,
      cancellable: true,
    });
    expect(reservationCount()).toBe(1);
  });

  it('exige sesión', async () => {
    const res = await request(ctx.app).post('/api/reservations').send(slot());
    expect(res.status).toBe(401);
    expect(reservationCount()).toBe(0);
  });

  it('rechaza un bloque ya reservado por otro usuario sin escribir nada', async () => {
    const ana = await registerAndLogin(ctx.app, 'ana@test.com');
    const beto = await registerAndLogin(ctx.app, 'beto@test.com');
    await ana.post('/api/reservations').send(slot());

    const res = await beto.post('/api/reservations').send(slot());
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'SLOT_TAKEN',
      message: 'La cancha ya fue reservada en este horario',
    });
    expect(reservationCount()).toBe(1);
  });

  it('rechaza bloques pasados o en curso', async () => {
    const agent = await registerAndLogin(ctx.app, 'ana@test.com');
    const current = await agent.post('/api/reservations').send(slot({ date: '2026-09-22', startHour: 14 }));
    expect(current.status).toBe(400);
    expect(current.body.error.code).toBe('PAST_SLOT');

    const yesterday = await agent.post('/api/reservations').send(slot({ date: '2026-09-21' }));
    expect(yesterday.status).toBe(400);
    expect(['PAST_SLOT', 'OUTSIDE_BOOKING_WINDOW']).toContain(yesterday.body.error.code);
    expect(reservationCount()).toBe(0);
  });

  it('rechaza fechas fuera de la ventana de 7 días', async () => {
    const agent = await registerAndLogin(ctx.app, 'ana@test.com');
    const res = await agent.post('/api/reservations').send(slot({ date: '2026-09-29' }));
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'OUTSIDE_BOOKING_WINDOW',
      message: 'Solo puedes reservar con hasta 7 días de anticipación',
    });
    const lastDay = await agent.post('/api/reservations').send(slot({ date: '2026-09-28' }));
    expect(lastDay.status).toBe(201);
  });

  it('valida hora y cancha', async () => {
    const agent = await registerAndLogin(ctx.app, 'ana@test.com');
    for (const startHour of [24, -1, 1.5, '10', null]) {
      const res = await agent.post('/api/reservations').send(slot({ startHour }));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    const badDate = await agent.post('/api/reservations').send(slot({ date: '2026-02-30' }));
    expect(badDate.body.error.code).toBe('VALIDATION_ERROR');

    const unknown = await agent.post('/api/reservations').send(slot({ courtId: 'medellin' }));
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.code).toBe('UNKNOWN_COURT');
    expect(reservationCount()).toBe(0);
  });

  it('permite solo una reserva activa por usuario', async () => {
    const agent = await registerAndLogin(ctx.app, 'ana@test.com');
    await agent.post('/api/reservations').send(slot({ date: '2026-09-22', startHour: 15 }));

    const second = await agent.post('/api/reservations').send(slot({ courtId: 'belen' }));
    expect(second.status).toBe(409);
    expect(second.body.error.message).toBe(
      'Ya tienes una reserva activa. Cancélala o espera a que termine para hacer otra',
    );

    // 15:30: la reserva está en curso y sigue contando como activa.
    ctx.advance(1 * HOUR);
    const during = await agent.post('/api/reservations').send(slot({ courtId: 'belen' }));
    expect(during.body.error.code).toBe('ACTIVE_RESERVATION_EXISTS');

    // 16:30: ya terminó, puede reservar de nuevo.
    ctx.advance(1 * HOUR);
    const after = await agent.post('/api/reservations').send(slot({ courtId: 'belen' }));
    expect(after.status).toBe(201);
  });

  it('SC-002: 10 reservas simultáneas del mismo bloque producen exactamente 1 éxito', async () => {
    const agents = await Promise.all(
      Array.from({ length: 10 }, (_, i) => registerAndLogin(ctx.app, `user${i}@test.com`)),
    );
    const results = await Promise.all(agents.map((a) => a.post('/api/reservations').send(slot())));

    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(9);
    for (const r of results.filter((r) => r.status === 409)) {
      expect(r.body.error.code).toBe('SLOT_TAKEN');
    }
    expect(reservationCount()).toBe(1);
  });

  it('un doble envío del mismo usuario crea una sola reserva', async () => {
    const agent = await registerAndLogin(ctx.app, 'ana@test.com');
    await Promise.all([
      agent.post('/api/reservations').send(slot()),
      agent.post('/api/reservations').send(slot()),
    ]);
    expect(reservationCount()).toBe(1);
  });
});

// Inserta una reserva directamente (p. ej. en el pasado) sin pasar por la API.
const insertReservation = (userEmail: string, courtId: string, date: string, startHour: number) => {
  const { id: userId } = ctx.db.prepare('SELECT id FROM users WHERE email = ?').get(userEmail) as {
    id: number;
  };
  const { lastInsertRowid } = ctx.db
    .prepare(
      'INSERT INTO reservations (user_id, court_id, date, start_hour, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run(userId, courtId, date, startHour, NOW.toISOString());
  return Number(lastInsertRowid);
};

describe('GET /api/reservations/me', () => {
  it('exige sesión', async () => {
    expect((await request(ctx.app).get('/api/reservations/me')).status).toBe(401);
  });

  it('separa próximas e historial y solo muestra las propias', async () => {
    const ana = await registerAndLogin(ctx.app, 'ana@test.com');
    await registerAndLogin(ctx.app, 'beto@test.com');
    insertReservation('ana@test.com', 'belen', '2026-09-10', 8);
    insertReservation('ana@test.com', 'robledo', '2026-09-20', 18);
    insertReservation('beto@test.com', 'envigado', '2026-09-24', 9);
    await ana.post('/api/reservations').send(slot());

    const res = await ana.get('/api/reservations/me');
    expect(res.status).toBe(200);
    expect(res.body.upcoming).toEqual([
      {
        id: expect.any(Number),
        courtId: 'laureles',
        courtName: 'Cancha Laureles',
        date: '2026-09-23',
        startHour: 10,
        endHour: 11,
        cancellable: true,
      },
    ]);
    expect(res.body.history.map((r: { date: string }) => r.date)).toEqual([
      '2026-09-20',
      '2026-09-10',
    ]);
    expect(res.body.history[0]).toMatchObject({
      courtName: 'Cancha Robledo',
      startHour: 18,
      endHour: 19,
      cancellable: false,
    });
    expect(JSON.stringify(res.body)).not.toContain('envigado');
  });

  it('la reserva en curso aparece en próximas y no es cancelable', async () => {
    const ana = await registerAndLogin(ctx.app, 'ana@test.com');
    insertReservation('ana@test.com', 'laureles', '2026-09-22', 14); // 14:00–15:00, son las 14:30
    const res = await ana.get('/api/reservations/me');
    expect(res.body.upcoming).toHaveLength(1);
    expect(res.body.upcoming[0].cancellable).toBe(false);
    expect(res.body.history).toEqual([]);
  });
});

describe('DELETE /api/reservations/:id', () => {
  it('cancela una reserva futura, libera el bloque y permite reservar de nuevo', async () => {
    const ana = await registerAndLogin(ctx.app, 'ana@test.com');
    const { body } = await ana.post('/api/reservations').send(slot());

    const res = await ana.delete(`/api/reservations/${body.reservation.id}`);
    expect(res.status).toBe(204);

    const mine = await ana.get('/api/reservations/me');
    expect(mine.body).toEqual({ upcoming: [], history: [] });

    const grid = await ana.get('/api/courts/laureles/availability?date=2026-09-23');
    expect(grid.body.slots[10]).toEqual({ startHour: 10, status: 'available', selectable: true });

    expect((await ana.post('/api/reservations').send(slot())).status).toBe(201);
  });

  it('no permite cancelar una reserva en curso o pasada', async () => {
    const ana = await registerAndLogin(ctx.app, 'ana@test.com');
    for (const id of [
      insertReservation('ana@test.com', 'laureles', '2026-09-22', 14),
      insertReservation('ana@test.com', 'belen', '2026-09-20', 9),
    ]) {
      const res = await ana.delete(`/api/reservations/${id}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toEqual({
        code: 'RESERVATION_STARTED',
        message: 'No puedes cancelar una reserva que ya comenzó',
      });
    }
    expect(reservationCount()).toBe(2);
  });

  it('responde 404 para reservas ajenas, inexistentes o ids inválidos', async () => {
    await registerAndLogin(ctx.app, 'ana@test.com');
    const beto = await registerAndLogin(ctx.app, 'beto@test.com');
    const anaId = insertReservation('ana@test.com', 'laureles', '2026-09-23', 10);

    for (const id of [String(anaId), '9999', 'abc', '1.5']) {
      const res = await beto.delete(`/api/reservations/${id}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RESERVATION_NOT_FOUND');
    }
    expect(reservationCount()).toBe(1);
  });

  it('exige sesión', async () => {
    await registerAndLogin(ctx.app, 'ana@test.com');
    const id = insertReservation('ana@test.com', 'laureles', '2026-09-23', 10);
    expect((await request(ctx.app).delete(`/api/reservations/${id}`)).status).toBe(401);
  });
});
