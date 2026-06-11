import type { Response, NextFunction } from 'express';
import type { Role } from '@prisma/client';
import { forbidden, unauthorized } from '../lib/AppError.js';
import type { AuthRequest } from '../types/index.js';

/**
 * Role guard factory. Apply AFTER the `auth` middleware.
 * Usage: router.get('/', auth, requireRole('ADMIN', 'HQ_MANAGER'), handler)
 */
export function requireRole(...roles: Role[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw unauthorized();
    }
    if (!roles.includes(req.user.role)) {
      throw forbidden('Your role does not have permission for this action');
    }
    next();
  };
}
