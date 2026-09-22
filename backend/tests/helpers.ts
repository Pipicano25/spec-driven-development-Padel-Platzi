import request from 'supertest';
import { createApp } from '../src/app.js';
import { openDb } from '../src/db.js';

// App con base en memoria y reloj controlable desde las pruebas.
export const createTestApp = (initialNow: Date) => {
  let now = initialNow.getTime();
  const db = openDb(':memory:');
  const app = createApp({ db, clock: () => new Date(now) });
  return {
    app,
    db,
    setNow: (date: Date) => {
      now = date.getTime();
    },
    advance: (ms: number) => {
      now += ms;
    },
  };
};

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;

export const TEST_PASSWORD = 'password123';

// Registra un usuario y devuelve un agente de supertest que conserva su cookie de sesión.
export const registerAndLogin = async (app: Parameters<typeof request.agent>[0], email: string) => {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({ email, password: TEST_PASSWORD });
  if (res.status !== 201) throw new Error(`No se pudo registrar ${email}: ${res.status}`);
  return agent;
};
