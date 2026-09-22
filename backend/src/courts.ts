import { Router } from 'express';
import { requireAuth } from './auth.js';
import type { Db } from './db.js';
import { httpError } from './errors.js';
import { bookingWindow, isInWindow, isPastSlot, isValidDate, type Clock } from './time.js';
import type { AppDeps, Court, Slot } from './types.js';

const HOURS_PER_DAY = 24;

// Orden fijo del catálogo, tal como se siembra en db/schema.sql.
const listCourts = (db: Db): Court[] =>
  db.prepare('SELECT id, name FROM courts ORDER BY rowid').all() as Court[];

// Validaciones compartidas con la creación de reservas.
export const requireCourt = (db: Db, courtId: unknown): Court => {
  const court =
    typeof courtId === 'string'
      ? (db.prepare('SELECT id, name FROM courts WHERE id = ?').get(courtId) as Court | undefined)
      : undefined;
  if (!court) throw httpError('UNKNOWN_COURT');
  return court;
};

export const requireBookableDate = (date: unknown, clock: Clock): string => {
  if (!isValidDate(date)) throw httpError('VALIDATION_ERROR');
  if (!isInWindow(date, clock)) throw httpError('OUTSIDE_BOOKING_WINDOW');
  return date;
};

const buildSlots = (db: Db, courtId: string, date: string, clock: Clock): Slot[] => {
  const reserved = new Set(
    (
      db
        .prepare('SELECT start_hour AS startHour FROM reservations WHERE court_id = ? AND date = ?')
        .all(courtId, date) as { startHour: number }[]
    ).map((row) => row.startHour),
  );

  return Array.from({ length: HOURS_PER_DAY }, (_, startHour) => {
    const status = reserved.has(startHour) ? 'reserved' : 'available';
    return {
      startHour,
      status,
      selectable: status === 'available' && !isPastSlot(date, startHour, clock),
    };
  });
};

export const courtsRouter = (deps: AppDeps): Router => {
  const { db, clock } = deps;
  const router = Router();
  router.use(requireAuth(deps));

  router.get('/', (_req, res) => {
    res.json({ courts: listCourts(db), bookingWindow: bookingWindow(clock) });
  });

  router.get('/:courtId/availability', (req, res) => {
    const court = requireCourt(db, req.params.courtId);
    const date = requireBookableDate(req.query.date, clock);
    res.json({ courtId: court.id, date, slots: buildSlots(db, court.id, date, clock) });
  });

  return router;
};
