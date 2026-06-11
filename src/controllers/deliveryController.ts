import type { Response } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { ok } from '../lib/http.js';
import { validate, parseIntParam } from '../lib/validate.js';
import { currentUser } from '../lib/context.js';
import { resolveBranchId } from '../lib/access.js';
import * as deliveryService from '../services/deliveryService.js';
import type { AuthRequest } from '../types/index.js';

// A driver progresses a run forward only; assignment (ASSIGNED) is a manager action.
const statusSchema = z.object({ status: z.enum(['OUT_FOR_DELIVERY', 'DELIVERED']) });

/** A driver sees deliveries assigned to them; a manager sees all branch deliveries. */
export async function listDeliveries(req: AuthRequest, res: Response): Promise<void> {
  const user = currentUser(req);
  const branchId = resolveBranchId(user);
  const driverId = user.role === Role.DELIVERY ? user.userId : undefined;
  ok(res, await deliveryService.listDeliveries(branchId, driverId));
}

export async function updateStatus(req: AuthRequest, res: Response): Promise<void> {
  const { status } = validate(statusSchema, req.body);
  ok(res, await deliveryService.updateDeliveryStatus(currentUser(req), parseIntParam(req.params.id), status));
}
