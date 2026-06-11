import type { Response } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { ok } from '../lib/http.js';
import { validate, emailSchema, passwordSchema, parseIntParam } from '../lib/validate.js';
import { currentUser } from '../lib/context.js';
import * as userService from '../services/userService.js';
import * as branchService from '../services/branchService.js';
import type { AuthRequest } from '../types/index.js';

const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(1, 'Name is required'),
  role: z.enum(Role),
  branchId: z.number().int().positive().nullable().optional(),
});

const updateUserSchema = z
  .object({
    name: z.string().min(1).optional(),
    role: z.enum(Role).optional(),
    branchId: z.number().int().positive().nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields provided to update' });

const branchSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().min(1, 'Address is required'),
  phone: z.string().min(1, 'Phone is required'),
});

// ── Users ──────────────────────────────────────────────────────────────
export async function listUsers(req: AuthRequest, res: Response): Promise<void> {
  const branchId = req.query.branchId ? parseIntParam(String(req.query.branchId), 'branchId') : undefined;
  ok(res, await userService.listUsers(branchId));
}

export async function getUser(req: AuthRequest, res: Response): Promise<void> {
  ok(res, await userService.getUser(parseIntParam(req.params.id)));
}

export async function createUser(req: AuthRequest, res: Response): Promise<void> {
  const input = validate(createUserSchema, req.body);
  ok(res, await userService.createUser({ ...input, branchId: input.branchId ?? null }), 201);
}

export async function updateUser(req: AuthRequest, res: Response): Promise<void> {
  const actor = currentUser(req);
  const input = validate(updateUserSchema, req.body);
  ok(res, await userService.updateUser(parseIntParam(req.params.id), input, actor.userId));
}

export async function deleteUser(req: AuthRequest, res: Response): Promise<void> {
  const actor = currentUser(req);
  await userService.deleteUser(parseIntParam(req.params.id), actor.userId);
  res.status(204).send();
}

// ── Branches ───────────────────────────────────────────────────────────
export async function listBranches(_req: AuthRequest, res: Response): Promise<void> {
  ok(res, await branchService.listBranches());
}

export async function createBranch(req: AuthRequest, res: Response): Promise<void> {
  ok(res, await branchService.createBranch(validate(branchSchema, req.body)), 201);
}

export async function updateBranch(req: AuthRequest, res: Response): Promise<void> {
  const input = validate(branchSchema.partial(), req.body);
  ok(res, await branchService.updateBranch(parseIntParam(req.params.id), input));
}

export async function deleteBranch(req: AuthRequest, res: Response): Promise<void> {
  await branchService.deleteBranch(parseIntParam(req.params.id));
  res.status(204).send();
}
