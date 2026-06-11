import type { Request } from 'express';
import type { Role } from '@prisma/client';

/** Decoded JWT payload attached to every authenticated request. */
export interface JwtPayload {
  userId: number;
  email: string;
  role: Role;
  branchId: number | null;
}

/** Express request after the `auth` middleware has run. */
export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PageMeta;
}

export interface ApiError {
  success: false;
  error: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/** Roles that are NOT tied to a single branch (global scope). */
export const GLOBAL_ROLES: Role[] = ['ADMIN', 'HQ_MANAGER'];
