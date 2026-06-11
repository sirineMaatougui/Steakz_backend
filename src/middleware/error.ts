import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../lib/AppError.js';
import { env } from '../config/env.js';

/** 404 for any unmatched route. */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ success: false, error: 'Route not found' });
}

/** Central error handler — converts thrown errors to the standard error envelope. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, error: err.message });
    return;
  }

  // Map common Prisma errors to sensible status codes.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ success: false, error: 'A record with that value already exists' });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ success: false, error: 'Resource not found' });
      return;
    }
    if (err.code === 'P2003') {
      res.status(409).json({ success: false, error: 'Operation blocked by related records' });
      return;
    }
  }

  if (!env.isTest) {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  res.status(500).json({ success: false, error: 'Internal server error' });
}
