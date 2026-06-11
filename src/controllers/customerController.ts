import type { Response } from 'express';
import { z } from 'zod';
import { ok } from '../lib/http.js';
import { validate, parseIntParam } from '../lib/validate.js';
import { currentUser } from '../lib/context.js';
import * as branchService from '../services/branchService.js';
import * as menuService from '../services/menuService.js';
import * as orderService from '../services/orderService.js';
import type { AuthRequest } from '../types/index.js';

const placeOrderSchema = z.object({
  branchId: z.number().int().positive(),
  type: z.enum(['TAKEAWAY', 'DELIVERY']),
  items: z
    .array(
      z.object({
        menuItemId: z.number().int().positive(),
        quantity: z.number().int().positive(),
        notes: z.string().optional(),
      }),
    )
    .min(1, 'At least one item is required'),
  deliveryAddress: z.string().optional(),
});

/** Customers choose a branch to order from. */
export async function listBranches(_req: AuthRequest, res: Response): Promise<void> {
  ok(res, await branchService.listBranches());
}

export async function browseMenu(req: AuthRequest, res: Response): Promise<void> {
  ok(res, await menuService.listMenu(parseIntParam(req.params.branchId, 'branchId'), true));
}

export async function placeOrder(req: AuthRequest, res: Response): Promise<void> {
  const user = currentUser(req);
  const input = validate(placeOrderSchema, req.body);
  const order = await orderService.createOrder({
    branchId: input.branchId,
    type: input.type,
    items: input.items,
    customerId: user.userId,
    deliveryAddress: input.deliveryAddress,
  });
  ok(res, order, 201);
}

export async function myOrders(req: AuthRequest, res: Response): Promise<void> {
  const user = currentUser(req);
  ok(res, await orderService.listOrders({ customerId: user.userId }));
}

export async function getMyOrder(req: AuthRequest, res: Response): Promise<void> {
  ok(res, await orderService.getOrderForUser(currentUser(req), parseIntParam(req.params.id)));
}

export async function cancelMyOrder(req: AuthRequest, res: Response): Promise<void> {
  ok(res, await orderService.cancelOwnOrder(currentUser(req), parseIntParam(req.params.id)));
}
