import type { Response } from 'express';
import { z } from 'zod';
import { OrderStatus } from '@prisma/client';
import { ok } from '../lib/http.js';
import { validate, parseIntParam } from '../lib/validate.js';
import { currentUser } from '../lib/context.js';
import { resolveBranchId } from '../lib/access.js';
import * as orderService from '../services/orderService.js';
import * as paymentService from '../services/paymentService.js';
import type { AuthRequest } from '../types/index.js';

const paymentSchema = z.object({ method: z.enum(['CASH', 'CARD']) });

/** Orders awaiting payment at this branch. */
export async function unpaidOrders(req: AuthRequest, res: Response): Promise<void> {
  const branchId = resolveBranchId(currentUser(req));
  ok(
    res,
    await orderService.listOrders({
      branchId,
      statuses: [OrderStatus.PENDING, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.SERVED],
    }),
  );
}

export async function takePayment(req: AuthRequest, res: Response): Promise<void> {
  const { method } = validate(paymentSchema, req.body);
  ok(res, await paymentService.recordPayment(currentUser(req), parseIntParam(req.params.id), method), 201);
}
