import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, HOUR, MINUTE } from './helpers.js';

const NOW = new Date('2026-09-22T19:30:00Z'); // 14:30 Bogotá
const PASSWORD = 'password123';

let ctx: ReturnType<typeof createTestApp>;

beforeEach(() => {
  ctx = createTestApp(NOW);
});

const register = (email: string, password = PASSWORD) =>
  request(ctx.app).post('/api/auth/register').send({ email, password });

const login = (email: string, password = PASSWORD) =>
  request(ctx.app).post('/api/auth/login').send({ email, password });

const sidCookie = (res: request.Response): string | undefined =>
  ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('sid='));

describe('POST /api/auth/register', () => {
  it('crea la cuenta, inicia sesión y normaliza el correo', async () => {
    const res = await register(' Ana@Test.com ');
    expect(res.status).toBe(201);
    expect(res.body.user).toEqual({ id: expect.any(Number), email: 'ana@test.com' });
    expect(sidCookie(res)).toMatch(/HttpOnly/i);
  });

  it('no guarda la contraseña en texto plano', async () => {
    await register('ana@test.com');
    const row = ctx.db.prepare('SELECT password_hash FROM users').get() as {
      password_hash: string;
    };
    expect(row.password_hash).not.toContain(PASSWORD);
    expect(row.password_hash).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
  });

  it('rechaza un correo ya registrado sin importar mayúsculas', async () => {
    await register('ana@test.com');
    const res = await register('ANA@test.com');
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'EMAIL_TAKEN',
      message: 'Este correo ya está registrado',
    });
  });

  it('valida formato de correo y longitud de contraseña', async () => {
    expect((await register('no-es-correo')).body.error.code).toBe('INVALID_EMAIL');
    const weak = await register('ana@test.com', '1234567');
    expect(weak.status).toBe(400);
    expect(weak.body.error.code).toBe('WEAK_PASSWORD');
    const missing = await request(ctx.app).post('/api/auth/register').send({});
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await register('ana@test.com');
  });

  it('inicia sesión con credenciales correctas', async () => {
    const res = await login('ANA@test.com');
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('ana@test.com');
    expect(sidCookie(res)).toBeDefined();
  });

  it('usa el mismo mensaje para contraseña errónea y correo inexistente', async () => {
    const wrong = await login('ana@test.com', 'incorrecta');
    const unknown = await login('nadie@test.com', 'incorrecta');
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(wrong.body.error).toEqual({
      code: 'INVALID_CREDENTIALS',
      message: 'Correo o contraseña incorrectos',
    });
  });

  it('bloquea 15 minutos tras 5 fallos consecutivos, incluso con la contraseña correcta', async () => {
    for (let i = 1; i <= 4; i++) {
      expect((await login('ana@test.com', 'incorrecta')).status).toBe(401);
    }
    const fifth = await login('ana@test.com', 'incorrecta');
    expect(fifth.status).toBe(429);
    expect(fifth.body.error.message).toBe(
      'Demasiados intentos fallidos. Intenta de nuevo en 15 minutos',
    );
    expect((await login('ana@test.com')).status).toBe(429);

    ctx.advance(14 * MINUTE);
    expect((await login('ana@test.com')).status).toBe(429);

    ctx.advance(1 * MINUTE);
    expect((await login('ana@test.com')).status).toBe(200);
  });

  it('aplica el bloqueo también a correos no registrados', async () => {
    for (let i = 1; i <= 4; i++) await login('nadie@test.com', 'x');
    expect((await login('nadie@test.com', 'x')).status).toBe(429);
  });

  it('un inicio de sesión exitoso reinicia el contador', async () => {
    for (let i = 1; i <= 4; i++) await login('ana@test.com', 'incorrecta');
    expect((await login('ana@test.com')).status).toBe(200);
    for (let i = 1; i <= 4; i++) {
      expect((await login('ana@test.com', 'incorrecta')).status).toBe(401);
    }
  });
});

describe('sesión: /me y logout', () => {
  it('sin cookie responde 401', async () => {
    const res = await request(ctx.app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('logout invalida la sesión', async () => {
    const agent = request.agent(ctx.app);
    await agent.post('/api/auth/register').send({ email: 'ana@test.com', password: PASSWORD });
    expect((await agent.get('/api/auth/me')).body.user.email).toBe('ana@test.com');
    expect((await agent.post('/api/auth/logout')).status).toBe(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('la sesión expira a las 24 horas', async () => {
    const agent = request.agent(ctx.app);
    await agent.post('/api/auth/register').send({ email: 'ana@test.com', password: PASSWORD });
    ctx.advance(24 * HOUR - MINUTE);
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    ctx.advance(MINUTE);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
});

describe('registro: choque de unicidad en el INSERT', () => {
  it('convierte SQLITE_CONSTRAINT_UNIQUE en 409 EMAIL_TAKEN', async () => {
    // Simula una carrera: el correo aparece entre la consulta previa y el INSERT.
    ctx.db.exec(`
      CREATE TRIGGER race BEFORE INSERT ON users
      BEGIN
        INSERT INTO users (email, password_hash, created_at)
        SELECT NEW.email, 'x:y', NEW.created_at
        WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = NEW.email);
      END;
    `);
    const res = await register('ana@test.com');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });
});
