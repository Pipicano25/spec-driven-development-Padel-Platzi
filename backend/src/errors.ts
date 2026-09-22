import type { ErrorRequestHandler, RequestHandler } from 'express';

export const errorCatalog = {
  VALIDATION_ERROR: { status: 400, message: 'Revisa los datos ingresados' },
  INVALID_EMAIL: { status: 400, message: 'Ingresa un correo electrónico válido' },
  WEAK_PASSWORD: { status: 400, message: 'La contraseña debe tener al menos 8 caracteres' },
  UNKNOWN_COURT: { status: 400, message: 'La cancha seleccionada no existe' },
  OUTSIDE_BOOKING_WINDOW: {
    status: 400,
    message: 'Solo puedes reservar con hasta 7 días de anticipación',
  },
  PAST_SLOT: { status: 400, message: 'No puedes reservar en un horario que ya pasó' },
  RESERVATION_STARTED: { status: 400, message: 'No puedes cancelar una reserva que ya comenzó' },
  UNAUTHENTICATED: { status: 401, message: 'Inicia sesión para continuar' },
  INVALID_CREDENTIALS: { status: 401, message: 'Correo o contraseña incorrectos' },
  RESERVATION_NOT_FOUND: { status: 404, message: 'No encontramos esa reserva' },
  NOT_FOUND: { status: 404, message: 'No encontramos lo que buscas' },
  EMAIL_TAKEN: { status: 409, message: 'Este correo ya está registrado' },
  SLOT_TAKEN: { status: 409, message: 'La cancha ya fue reservada en este horario' },
  ACTIVE_RESERVATION_EXISTS: {
    status: 409,
    message: 'Ya tienes una reserva activa. Cancélala o espera a que termine para hacer otra',
  },
  LOGIN_LOCKED: {
    status: 429,
    message: 'Demasiados intentos fallidos. Intenta de nuevo en 15 minutos',
  },
  INTERNAL_ERROR: { status: 500, message: 'Ocurrió un problema. Intenta de nuevo.' },
} as const;

export type ErrorCode = keyof typeof errorCatalog;

export interface HttpError {
  isHttpError: true;
  status: number;
  code: ErrorCode;
  message: string;
}

export const httpError = (code: ErrorCode, message?: string): HttpError => ({
  isHttpError: true,
  status: errorCatalog[code].status,
  code,
  message: message ?? errorCatalog[code].message,
});

const isHttpError = (value: unknown): value is HttpError =>
  typeof value === 'object' && value !== null && (value as HttpError).isHttpError === true;

// Errores de la petición detectados por Express o express.json() (JSON mal formado, cuerpo
// demasiado grande, URL mal codificada…): llevan un status 4xx.
const isClientRequestError = (value: unknown): boolean => {
  const status = (value as { status?: unknown; statusCode?: unknown } | null)?.status ??
    (value as { statusCode?: unknown } | null)?.statusCode;
  return typeof status === 'number' && status >= 400 && status < 500;
};

// Rutas /api inexistentes: también responden con el cuerpo de error JSON.
export const notFoundHandler: RequestHandler = () => {
  throw httpError('NOT_FOUND');
};

// Nunca se envían stack traces ni detalles internos al cliente.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const known = isHttpError(err)
    ? err
    : isClientRequestError(err)
      ? httpError('VALIDATION_ERROR')
      : undefined;

  if (!known) console.error(err);
  const { status, code, message } = known ?? httpError('INTERNAL_ERROR');
  res.status(status).json({ error: { code, message } });
};
