import type { Response } from 'express';
import { z } from 'zod';
import { ok } from '../lib/http.js';
import { validate, emailSchema, passwordSchema } from '../lib/validate.js';
import { unauthorized } from '../lib/AppError.js';
import * as authService from '../services/authService.js';
import type { AuthRequest } from '../types/index.js';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(1, 'Name is required'),
});

export async function login(req: AuthRequest, res: Response): Promise<void> {
  const { email, password } = validate(loginSchema, req.body);
  const result = await authService.login(email, password);
  ok(res, result);
}

export async function register(req: AuthRequest, res: Response): Promise<void> {
  const input = validate(registerSchema, req.body);
  const result = await authService.registerCustomer(input);
  ok(res, result, 201);
}

export async function me(req: AuthRequest, res: Response): Promise<void> {
  if (!req.user) {
    throw unauthorized();
  }
  const profile = await authService.getProfile(req.user.userId);
  ok(res, profile);
}
