import express from 'express';
import cookieParser from 'cookie-parser';
import { authRouter } from './auth.js';
import { courtsRouter } from './courts.js';
import { errorHandler, notFoundHandler } from './errors.js';
import { reservationsRouter } from './reservations.js';
import type { AppDeps } from './types.js';

export const createApp = (deps: AppDeps) => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.use('/api/auth', authRouter(deps));
  app.use('/api/courts', courtsRouter(deps));
  app.use('/api/reservations', reservationsRouter(deps));

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
};
