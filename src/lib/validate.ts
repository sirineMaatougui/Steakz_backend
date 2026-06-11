import { z } from 'zod';
import { AppError } from './AppError.js';

/** Parse `data` against a zod schema; throw 400 AppError with a readable message on failure. */
export function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
      .join('; ');
    throw new AppError(400, message || 'Validation failed');
  }
  return result.data;
}

/** Reusable field schemas. */
export const emailSchema = z
  .string()
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address');

export const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

/** Parse a route/query param into a positive integer, or throw 400. */
export function parseIntParam(value: string | string[] | undefined, name = 'id'): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new AppError(400, `Invalid ${name}`);
  }
  return n;
}
