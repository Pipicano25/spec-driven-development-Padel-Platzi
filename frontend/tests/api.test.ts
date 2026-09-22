import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, errorMessage, GENERIC_ERROR_MESSAGE, setUnauthenticatedHandler } from '../src/api';

const mockFetch = (impl: () => Promise<Response>) => {
  vi.stubGlobal('fetch', vi.fn(impl));
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiFetch', () => {
  it('devuelve el cuerpo JSON en respuestas exitosas', async () => {
    mockFetch(async () => Response.json({ ok: true }));
    await expect(apiFetch('/api/x')).resolves.toEqual({ ok: true });
  });

  it('devuelve undefined en respuestas 204', async () => {
    mockFetch(async () => new Response(null, { status: 204 }));
    await expect(apiFetch('/api/x', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('pasa tal cual el mensaje amigable del servidor', async () => {
    mockFetch(async () =>
      Response.json(
        { error: { code: 'SLOT_TAKEN', message: 'La cancha ya fue reservada en este horario' } },
        { status: 409 },
      ),
    );
    await expect(apiFetch('/api/reservations', { method: 'POST', body: {} })).rejects.toEqual({
      status: 409,
      code: 'SLOT_TAKEN',
      message: 'La cancha ya fue reservada en este horario',
    });
  });

  it('usa el mensaje genérico si el cuerpo no es JSON', async () => {
    mockFetch(async () => new Response('<html>Error: stack at foo.js:1</html>', { status: 502 }));
    const error = (await apiFetch('/api/x').catch((e) => e)) as { message: string };
    expect(error.message).toBe(GENERIC_ERROR_MESSAGE);
    expect(JSON.stringify(error)).not.toMatch(/stack|foo\.js/);
  });

  it('usa el mensaje genérico ante un error de red', async () => {
    mockFetch(async () => {
      throw new TypeError('Failed to fetch');
    });
    const error = (await apiFetch('/api/x').catch((e) => e)) as { message: string };
    expect(error).toEqual({ status: 0, code: 'INTERNAL_ERROR', message: GENERIC_ERROR_MESSAGE });
  });
});

describe('errorMessage', () => {
  it('nunca expone errores crudos', () => {
    expect(errorMessage(new Error('SQLITE_BUSY: database is locked'))).toBe(GENERIC_ERROR_MESSAGE);
    expect(errorMessage({ status: 400, code: 'PAST_SLOT', message: 'Ya pasó' })).toBe('Ya pasó');
  });
});

describe('sesión expirada', () => {
  afterEach(() => {
    setUnauthenticatedHandler(null);
  });

  it('avisa al manejador de sesión cuando el servidor responde UNAUTHENTICATED', async () => {
    const handler = vi.fn();
    setUnauthenticatedHandler(handler);
    mockFetch(async () =>
      Response.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Inicia sesión para continuar' } },
        { status: 401 },
      ),
    );
    await expect(apiFetch('/api/reservations', { method: 'POST', body: {} })).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('no lo llama ante credenciales incorrectas ni otros errores', async () => {
    const handler = vi.fn();
    setUnauthenticatedHandler(handler);
    mockFetch(async () =>
      Response.json(
        { error: { code: 'INVALID_CREDENTIALS', message: 'Correo o contraseña incorrectos' } },
        { status: 401 },
      ),
    );
    await apiFetch('/api/auth/login', { method: 'POST', body: {} }).catch(() => undefined);
    expect(handler).not.toHaveBeenCalled();
  });
});
