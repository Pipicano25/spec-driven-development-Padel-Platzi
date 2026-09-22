import { Router } from 'express';
import { currentUser, requireAuth } from './auth.js';
import { requireBookableDate, requireCourt } from './courts.js';
import type { Db } from './db.js';
import { httpError } from './errors.js';
import { isActive, isCancellable, isPastSlot, type Clock } from './time.js';
import type { AppDeps, ReservationDto } from './types.js';

interface ReservationRow {
  id: number;
  courtId: string;
  courtName: string;
  date: string;
  startHour: number;
}

const SELECT_RESERVATION = `
  SELECT r.id, r.court_id AS courtId, c.name AS courtName, r.date, r.start_hour AS startHour
  FROM reservations r JOIN courts c ON c.id = r.court_id`;

export const toReservationDto = (row: ReservationRow, clock: Clock): ReservationDto => ({
  id: row.id,
  courtId: row.courtId,
  courtName: row.courtName,
  date: row.date,
  startHour: row.startHour,
  endHour: row.startHour + 1,
  cancellable: isCancellable(row.date, row.startHour, clock),
});

const listUserReservations = (db: Db, userId: number): ReservationRow[] =>
  db
    .prepare(`${SELECT_RESERVATION} WHERE r.user_id = ? ORDER BY r.date, r.start_hour`)
    .all(userId) as ReservationRow[];

const findReservation = (db: Db, id: number): ReservationRow | undefined =>
  db.prepare(`${SELECT_RESERVATION} WHERE r.id = ?`).get(id) as ReservationRow | undefined;

const requireStartHour = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 23) {
    throw httpError('VALIDATION_ERROR');
  }
  return value;
};

const isUniqueViolation = (error: unknown): boolean =>
  (error as { code?: string })?.code === 'SQLITE_CONSTRAINT_UNIQUE';

// Regla crítica (Constitución, Principio II): todo se valida y se escribe dentro de una única
// transacción IMMEDIATE, y el índice UNIQUE (court_id, date, start_hour) es la última defensa.
const createReservation = (
  db: Db,
  clock: Clock,
  userId: number,
  body: Record<string, unknown>,
): ReservationRow =>
  db
    .transaction(() => {
      const court = requireCourt(db, body.courtId);
      const date = requireBookableDate(body.date, clock);
      const startHour = requireStartHour(body.startHour);
      if (isPastSlot(date, startHour, clock)) throw httpError('PAST_SLOT');

      const hasActive = listUserReservations(db, userId).some((r) =>
        isActive(r.date, r.startHour, clock),
      );
      if (hasActive) throw httpError('ACTIVE_RESERVATION_EXISTS');

      const taken = db
        .prepare('SELECT 1 FROM reservations WHERE court_id = ? AND date = ? AND start_hour = ?')
        .get(court.id, date, startHour);
      if (taken) throw httpError('SLOT_TAKEN');

      try {
        const { lastInsertRowid } = db
          .prepare(
            'INSERT INTO reservations (user_id, court_id, date, start_hour, created_at) VALUES (?, ?, ?, ?, ?)',
          )
          .run(userId, court.id, date, startHour, clock().toISOString());
        return findReservation(db, Number(lastInsertRowid))!;
      } catch (error) {
        if (isUniqueViolation(error)) throw httpError('SLOT_TAKEN');
        throw error;
      }
    })
    .immediate();

export const reservationsRouter = (deps: AppDeps): Router => {
  const { db, clock } = deps;
  const router = Router();
  router.use(requireAuth(deps));

  router.post('/', (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const row = createReservation(db, clock, currentUser(res).id, body);
    res.status(201).json({ reservation: toReservationDto(row, clock) });
  });

  // Las canceladas no existen (se borran), así que el historial solo tiene reservas jugadas.
  router.get('/me', (_req, res) => {
    const rows = listUserReservations(db, currentUser(res).id);
    const upcoming = rows.filter((r) => isActive(r.date, r.startHour, clock));
    const history = rows.filter((r) => !isActive(r.date, r.startHour, clock)).reverse();
    res.json({
      upcoming: upcoming.map((r) => toReservationDto(r, clock)),
      history: history.map((r) => toReservationDto(r, clock)),
    });
  });

  router.delete('/:id', (req, res) => {
    const id = /^\d+$/.test(req.params.id) ? Number(req.params.id) : NaN;
    // Una reserva ajena responde igual que una inexistente, para no revelar que existe.
    const reservation = Number.isSafeInteger(id)
      ? (db
          .prepare(`${SELECT_RESERVATION} WHERE r.id = ? AND r.user_id = ?`)
          .get(id, currentUser(res).id) as ReservationRow | undefined)
      : undefined;
    if (!reservation) throw httpError('RESERVATION_NOT_FOUND');
    if (!isCancellable(reservation.date, reservation.startHour, clock)) {
      throw httpError('RESERVATION_STARTED');
    }
    db.prepare('DELETE FROM reservations WHERE id = ?').run(reservation.id);
    res.status(204).end();
  });

  return router;
};
