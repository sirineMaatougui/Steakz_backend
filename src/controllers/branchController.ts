import type { Response } from 'express';
import { z } from 'zod';
import { ok } from '../lib/http.js';
import { validate, emailSchema, passwordSchema, parseIntParam } from '../lib/validate.js';
import { currentUser } from '../lib/context.js';
import { resolveBranchId } from '../lib/access.js';
import * as userService from '../services/userService.js';
import * as menuService from '../services/menuService.js';
import * as orderService from '../services/orderService.js';
import * as deliveryService from '../services/deliveryService.js';
import * as reportService from '../services/reportService.js';
import type { AuthRequest } from '../types/index.js';

/** Operational roles a branch manager may provision for their branch (not other managers). */
const STAFF_ROLES = ['CHEF', 'CASHIER', 'WAITER', 'DELIVERY'] as const;

const assignDriverSchema = z.object({ driverId: z.number().int().positive() });

const createStaffSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(1, 'Name is required'),
  role: z.enum(STAFF_ROLES),
});

const menuSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  price: z.number().positive('Price must be positive'),
  category: z.string().min(1, 'Category is required'),
  image: z.string().nullable().optional(),
  available: z.boolean().optional(),
});

/** Resolve which branch this request acts on (own branch, or ?branchId for global roles). */
function branchOf(req: AuthRequest): number {
  const requested = req.query.branchId ? parseIntParam(String(req.query.branchId), 'branchId') : undefined;
  return resolveBranchId(currentUser(req), requested);
}

// ── Staff ──────────────────────────────────────────────────────────────
export async function listStaff(req: AuthRequest, res: Response): Promise<void> {
  ok(res, await userService.listUsers(branchOf(req)));
}

export async function createStaff(req: AuthRequest, res: Response): Promise<void> {
  const input = validate(createStaffSchema, req.body);
  ok(res, await userService.createUser({ ...input, branchId: branchOf(req) }), 201);
}

// ── Menu ───────────────────────────────────────────────────────────────
export async function listMenu(req: AuthRequest, res: Response): Promise<void> {
  ok(res, await menuService.listMenu(branchOf(req)));
}

export async function createMenuItem(req: AuthRequest, res: Response): Promise<void> {
  const input = validate(menuSchema, req.body);
  ok(res, await menuService.createMenuItem(branchOf(req), input), 201);
}

export async function updateMenuItem(req: AuthRequest, res: Response): Promise<void> {
  const input = validate(menuSchema.partial(), req.body);
  ok(res, await menuService.updateMenuItem(currentUser(req), parseIntParam(req.params.id), input));
}

export async function deleteMenuItem(req: AuthRequest, res: Response): Promise<void> {
  await menuService.deleteMenuItem(currentUser(req), parseIntParam(req.params.id));
  res.status(204).send();
}

// ── Orders + report ─────────────────────────────────────────────────────
export async function listOrders(req: AuthRequest, res: Response): Promise<void> {
  ok(res, await orderService.listOrders({ branchId: branchOf(req) }));
}

export async function report(req: AuthRequest, res: Response): Promise<void> {
  ok(res, await reportService.branchReport(branchOf(req)));
}

/** Assign (or reassign) a delivery driver to a delivery order. */
export async function assignDriver(req: AuthRequest, res: Response): Promise<void> {
  const { driverId } = validate(assignDriverSchema, req.body);
  ok(res, await deliveryService.assignDriverToOrder(currentUser(req), parseIntParam(req.params.id), driverId));
}

/** Cancel (void) an order that is not yet paid or delivered. */
export async function cancelOrder(req: AuthRequest, res: Response): Promise<void> {
  ok(res, await orderService.cancelOrderByStaff(currentUser(req), parseIntParam(req.params.id)));
}
