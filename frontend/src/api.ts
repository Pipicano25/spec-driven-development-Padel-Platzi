import type { ApiError } from './types';

export const GENERIC_ERROR_MESSAGE = 'Ocurrió un problema. Intenta de nuevo.';

// Lo registra useAuth: si el servidor indica que la sesión ya no es válida, se cierra en el
// frontend y RequireAuth lleva al usuario a /login.
let onUnauthenticated: (() => void) | null = null;

export const setUnauthenticatedHandler = (handler: (() => void) | null): void => {
  onUnauthenticated = handler;
};

const genericError = (status = 0): ApiError => ({
  status,
  code: 'INTERNAL_ERROR',
  message: GENERIC_ERROR_MESSAGE,
});

const toApiError = async (response: Response): Promise<ApiError> => {
  try {
    const body = await response.json();
    const error = body?.error;
    if (typeof error?.message === 'string' && typeof error?.code === 'string') {
      return { status: response.status, code: error.code, message: error.message };
    }
  } catch {
    // Cuerpo vacío o no JSON: se usa el mensaje genérico.
  }
  return genericError(response.status);
};

// Único punto de acceso a la API: cualquier fallo se convierte en un ApiError con un
// mensaje apto para mostrarse al usuario.
export const apiFetch = async <T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw genericError();
  }

  if (!response.ok) {
    const error = await toApiError(response);
    if (error.code === 'UNAUTHENTICATED') onUnauthenticated?.();
    throw error;
  }
  if (response.status === 204) return undefined as T;

  try {
    return (await response.json()) as T;
  } catch {
    throw genericError(response.status);
  }
};

export const errorMessage = (error: unknown): string =>
  typeof (error as ApiError)?.message === 'string' && typeof (error as ApiError)?.code === 'string'
    ? (error as ApiError).message
    : GENERIC_ERROR_MESSAGE;
