import type { Response } from 'express';
import { z } from 'zod';
import { ok } from '../lib/http.js';
import { validate, parseIntParam } from '../lib/validate.js';
import { currentUser } from '../lib/context.js';
import { resolveBranchId } from '../lib/access.js';
import * as orderService from '../services/orderService.js';
import * as menuService from '../services/menuService.js';
import type { AuthRequest } from '../types/index.js';

const createOrderSchema = z.object({
  type: z.enum(['DINE_IN', 'TAKEAWAY']), // waiters take floor orders; deliveries come from customers
  items: z
    .array(
      z.object({
        menuItemId: z.number().int().positive(),
        quantity: z.number().int().positive(),
        notes: z.string().optional(),
      }),
    )
    .min(1, 'At least one item is required'),
  customerId: z.number().int().positive().nullable().optional(),
  deliveryAddress: z.string().optional(),
});

export async function listMenu(req: AuthRequest, res: Response): Promise<void> {
  const branchId = resolveBranchId(currentUser(req));
  ok(res, await menuService.listMenu(branchId, true));
}

export async function createOrder(req: AuthRequest, res: Response): Promise<void> {
  const user = currentUser(req);
  const input = validate(createOrderSchema, req.body);
  const order = await orderService.createOrder({
    branchId: resolveBranchId(user),
    type: input.type,
    items: input.items,
    customerId: input.customerId ?? null,
    waiterId: user.userId,
    deliveryAddress: input.deliveryAddress,
  });
  ok(res, order, 201);
}

export async function listOrders(req: AuthRequest, res: Response): Promise<void> {
  const branchId = resolveBranchId(currentUser(req));
  ok(res, await orderService.listOrders({ branchId }));
}

export async function serveOrder(req: AuthRequest, res: Response): Promise<void> {
  ok(res, await orderService.markServed(currentUser(req), parseIntParam(req.params.id)));
}
