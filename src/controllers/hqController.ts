import type { Response } from 'express';
import { ok } from '../lib/http.js';
import { parseIntParam } from '../lib/validate.js';
import * as branchService from '../services/branchService.js';
import * as reportService from '../services/reportService.js';
import * as orderService from '../services/orderService.js';
import * as menuService from '../services/menuService.js';
import type { AuthRequest } from '../types/index.js';

/** HQ_MANAGER: global read + chain analytics. */
export async function listBranches(_req: AuthRequest, res: Response): Promise<void> {
  ok(res, await branchService.listBranches());
}

export async function chainReport(_req: AuthRequest, res: Response): Promise<void> {
  ok(res, await reportService.chainReport());
}

export async function branchReport(req: AuthRequest, res: Response): Promise<void> {
  ok(res, await reportService.branchReport(parseIntParam(req.params.branchId, 'branchId')));
}

export async function allOrders(_req: AuthRequest, res: Response): Promise<void> {
  ok(res, await orderService.listOrders({}));
}

export async function branchMenu(req: AuthRequest, res: Response): Promise<void> {
  ok(res, await menuService.listMenu(parseIntParam(req.params.branchId, 'branchId')));
}
