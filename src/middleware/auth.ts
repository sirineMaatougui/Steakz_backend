import type { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { unauthorized } from '../lib/AppError.js';
import type { AuthRequest, JwtPayload } from '../types/index.js';

/** Verify the Bearer JWT and attach the decoded payload to req.user. */
export function auth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw unauthorized('Missing or invalid Authorization header');
  }

  const token = header.slice('Bearer '.length).trim();
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      branchId: decoded.branchId ?? null,
    };
    next();
  } catch {
    throw unauthorized('Invalid or expired token');
  }
}
