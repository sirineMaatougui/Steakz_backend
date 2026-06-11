import type { Response } from 'express';
import { z } from 'zod';
import { OrderStatus } from '@prisma/client';
import { ok } from '../lib/http.js';
import { validate, parseIntParam } from '../lib/validate.js';
import { currentUser } from '../lib/context.js';
import { resolveBranchId } from '../lib/access.js';
import * as orderService from '../services/orderService.js';
import type { AuthRequest } from '../types/index.js';

// A chef may only move tickets through the kitchen stages.
const statusSchema = z.object({ status: z.enum(['PREPARING', 'READY']) });

/** Kitchen queue: orders still being prepared for this branch. */
export async function queue(req: AuthRequest, res: Response): Promise<void> {
  const branchId = resolveBranchId(currentUser(req));
  ok(
    res,
    await orderService.listOrders({
      branchId,
      statuses: [OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.READY],
    }),
  );
}

export async function updateStatus(req: AuthRequest, res: Response): Promise<void> {
  const { status } = validate(statusSchema, req.body);
  ok(res, await orderService.advanceKitchenStatus(currentUser(req), parseIntParam(req.params.id), status));
}
