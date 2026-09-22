import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createTestApp, registerAndLogin } from './helpers.js';

const NOW = new Date('2026-09-22T19:30:00Z');

describe('manejo de errores', () => {
  it('un JSON mal formado responde 400 VALIDATION_ERROR', async () => {
    const { app } = createTestApp(NOW);
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'Revisa los datos ingresados' },
    });
  });

  it('un error inesperado responde 500 genérico sin detalles internos', async () => {
    const { app, db } = createTestApp(NOW);
    const agent = await registerAndLogin(app, 'ana@test.com');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    db.close(); // cualquier consulta posterior lanza un error interno de SQLite

    const res = await agent.get('/api/courts');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un problema. Intenta de nuevo.' },
    });
    expect(res.text).not.toMatch(/stack|database|sqlite|\.ts/i);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe('cuerpo de error JSON en toda la API', () => {
  it('una ruta /api inexistente responde 404 NOT_FOUND en JSON', async () => {
    const { app } = createTestApp(NOW);
    const res = await request(app).get('/api/no-existe');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'No encontramos lo que buscas' },
    });
  });

  it('un cuerpo demasiado grande responde 400 VALIDATION_ERROR, no 500', async () => {
    const { app } = createTestApp(NOW);
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a@test.com', password: 'x'.repeat(200_000) }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('una URL mal codificada responde 400 VALIDATION_ERROR, no 500', async () => {
    const { app } = createTestApp(NOW);
    const agent = await registerAndLogin(app, 'ana@test.com');
    const res = await agent.delete('/api/reservations/%E0%A4%A');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
