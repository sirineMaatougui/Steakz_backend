import type { AuthRequest, JwtPayload } from '../types/index.js';
import { unauthorized } from './AppError.js';

/** Return the authenticated user or throw 401 (routes always run `auth` first). */
export function currentUser(req: AuthRequest): JwtPayload {
  if (!req.user) {
    throw unauthorized();
  }
  return req.user;
}
