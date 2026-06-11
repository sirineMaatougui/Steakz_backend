import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import * as hq from '../controllers/hqController.js';

const router = Router();
router.use(auth, requireRole('HQ_MANAGER', 'ADMIN'));

router.get('/branches', hq.listBranches);
router.get('/orders', hq.allOrders);
router.get('/reports/chain', hq.chainReport);
router.get('/reports/branch/:branchId', hq.branchReport);
router.get('/branches/:branchId/menu', hq.branchMenu);

export default router;
