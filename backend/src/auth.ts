import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { Router, type CookieOptions, type RequestHandler, type Response } from 'express';
import type { Db } from './db.js';
import { httpError } from './errors.js';
import type { Clock } from './time.js';
import type { AppDeps, User } from './types.js';

const SESSION_COOKIE = 'sid';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;
const MAX_FAILED_LOGINS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------- Contraseñas ----------

const KEY_LENGTH = 64;

export const hashPassword = (password: string): string => {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
};

export const verifyPassword = (password: string, stored: string): boolean => {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
};

// Se verifica contra este hash cuando el correo no existe, para que la respuesta tarde lo mismo.
const dummyHash = hashPassword(randomBytes(16).toString('hex'));

// ---------- Sesiones ----------

export const createSession = (db: Db, userId: number, clock: Clock): string => {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(clock().getTime() + SESSION_TTL_MS).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    userId,
    expiresAt,
  );
  return token;
};

export const deleteSession = (db: Db, token: string): void => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
};

export const getSessionUser = (db: Db, token: string, clock: Clock): User | undefined => {
  const row = db
    .prepare(
      `SELECT u.id, u.email, s.expires_at AS expiresAt
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`,
    )
    .get(token) as (User & { expiresAt: string }) | undefined;
  if (!row) return undefined;
  if (row.expiresAt <= clock().toISOString()) {
    deleteSession(db, token);
    return undefined;
  }
  return { id: row.id, email: row.email };
};

const readSessionToken = (cookies: unknown): string | undefined => {
  const token = (cookies as Record<string, unknown> | undefined)?.[SESSION_COOKIE];
  return typeof token === 'string' && token.length > 0 ? token : undefined;
};

export const requireAuth =
  ({ db, clock }: AppDeps): RequestHandler =>
  (req, res, next) => {
    const token = readSessionToken(req.cookies);
    const user = token ? getSessionUser(db, token, clock) : undefined;
    if (!user) throw httpError('UNAUTHENTICATED');
    res.locals.user = user;
    res.locals.sessionToken = token;
    next();
  };

export const currentUser = (res: Response): User => res.locals.user as User;

// ---------- Rutas ----------

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const readCredentials = (body: unknown): { email: string; password: string } => {
  const { email, password } = (body ?? {}) as Record<string, unknown>;
  if (typeof email !== 'string' || typeof password !== 'string') {
    throw httpError('VALIDATION_ERROR');
  }
  return { email: normalizeEmail(email), password };
};

const sessionCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: SESSION_TTL_MS,
  path: '/',
});

const startSession = (res: Response, { db, clock }: AppDeps, user: User): void => {
  const token = createSession(db, user.id, clock);
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
};

interface LoginAttempt {
  failedCount: number;
  lockedUntil: string | null;
}

const getLoginAttempt = (db: Db, email: string): LoginAttempt | undefined =>
  db
    .prepare(
      'SELECT failed_count AS failedCount, locked_until AS lockedUntil FROM login_attempts WHERE email = ?',
    )
    .get(email) as LoginAttempt | undefined;

const clearLoginAttempts = (db: Db, email: string): void => {
  db.prepare('DELETE FROM login_attempts WHERE email = ?').run(email);
};

// Registra un fallo y devuelve true si con él la cuenta queda bloqueada.
const recordFailedLogin = (db: Db, email: string, clock: Clock): boolean => {
  const { failedCount } = db
    .prepare(
      `INSERT INTO login_attempts (email, failed_count) VALUES (?, 1)
       ON CONFLICT (email) DO UPDATE SET failed_count = failed_count + 1
       RETURNING failed_count AS failedCount`,
    )
    .get(email) as { failedCount: number };
  if (failedCount < MAX_FAILED_LOGINS) return false;
  const lockedUntil = new Date(clock().getTime() + LOCK_DURATION_MS).toISOString();
  db.prepare('UPDATE login_attempts SET locked_until = ? WHERE email = ?').run(lockedUntil, email);
  return true;
};

export const authRouter = (deps: AppDeps): Router => {
  const { db, clock } = deps;
  const router = Router();

  router.post('/register', (req, res) => {
    const { email, password } = readCredentials(req.body);
    if (!EMAIL_PATTERN.test(email)) throw httpError('INVALID_EMAIL');
    if (password.length < MIN_PASSWORD_LENGTH) throw httpError('WEAK_PASSWORD');

    const existing = db.prepare('SELECT 1 FROM users WHERE email = ?').get(email);
    if (existing) throw httpError('EMAIL_TAKEN');

    let userId: number;
    try {
      const { lastInsertRowid } = db
        .prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)')
        .run(email, hashPassword(password), clock().toISOString());
      userId = Number(lastInsertRowid);
    } catch (error) {
      // Otro registro del mismo correo ganó la carrera entre la consulta y el INSERT.
      if ((error as { code?: string })?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw httpError('EMAIL_TAKEN');
      }
      throw error;
    }

    const user: User = { id: userId, email };
    startSession(res, deps, user);
    res.status(201).json({ user });
  });

  router.post('/login', (req, res) => {
    const { email, password } = readCredentials(req.body);
    const now = clock().toISOString();

    const attempt = getLoginAttempt(db, email);
    if (attempt?.lockedUntil) {
      if (attempt.lockedUntil > now) throw httpError('LOGIN_LOCKED');
      clearLoginAttempts(db, email); // el bloqueo expiró: el contador vuelve a cero
    }

    const row = db
      .prepare('SELECT id, email, password_hash AS passwordHash FROM users WHERE email = ?')
      .get(email) as (User & { passwordHash: string }) | undefined;
    const valid = verifyPassword(password, row?.passwordHash ?? dummyHash) && row !== undefined;

    if (!valid) {
      const locked = recordFailedLogin(db, email, clock);
      throw httpError(locked ? 'LOGIN_LOCKED' : 'INVALID_CREDENTIALS');
    }

    clearLoginAttempts(db, email);
    const user: User = { id: row.id, email: row.email };
    startSession(res, deps, user);
    res.json({ user });
  });

  router.post('/logout', requireAuth(deps), (_req, res) => {
    deleteSession(db, res.locals.sessionToken as string);
    res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions(), maxAge: undefined });
    res.status(204).end();
  });

  router.get('/me', requireAuth(deps), (_req, res) => {
    res.json({ user: currentUser(res) });
  });

  return router;
};
