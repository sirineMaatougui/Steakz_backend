import { GLOBAL_ROLES } from '../types/index.js';
import type { JwtPayload } from '../types/index.js';
import { forbidden } from './AppError.js';

/** ADMIN and HQ_MANAGER are global (no branch scoping). */
export function isGlobal(user: JwtPayload): boolean {
  return GLOBAL_ROLES.includes(user.role);
}

/**
 * Branch isolation: global roles pass; branch-scoped roles may only touch
 * resources belonging to their own branch. Throws 403 otherwise.
 */
export function assertBranchAccess(user: JwtPayload, branchId: number): void {
  if (isGlobal(user)) return;
  if (user.branchId !== branchId) {
    throw forbidden('You do not have access to this branch');
  }
}

/** Ownership check (e.g. a customer may only read their own resource). */
export function assertOwnership(user: JwtPayload, ownerId: number | null): void {
  if (isGlobal(user)) return;
  if (ownerId === null || user.userId !== ownerId) {
    throw forbidden('You can only access your own records');
  }
}

/**
 * Resolve the branch a branch-scoped user is acting within. Global roles must
 * pass an explicit branchId; branch-scoped roles use their own.
 */
export function resolveBranchId(user: JwtPayload, requested?: number): number {
  if (isGlobal(user)) {
    if (requested === undefined) {
      throw forbidden('A branchId is required for this action');
    }
    return requested;
  }
  if (user.branchId === null) {
    throw forbidden('Your account is not assigned to a branch');
  }
  return user.branchId;
}
