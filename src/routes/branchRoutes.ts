import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import * as branch from '../controllers/branchController.js';

const router = Router();
router.use(auth, requireRole('BRANCH_MANAGER', 'ADMIN'));

// Staff (own branch)
router.get('/staff', branch.listStaff);
router.post('/staff', branch.createStaff);

// Menu (own branch)
router.get('/menu', branch.listMenu);
router.post('/menu', branch.createMenuItem);
router.patch('/menu/:id', branch.updateMenuItem);
router.delete('/menu/:id', branch.deleteMenuItem);

// Orders + report (own branch)
router.get('/orders', branch.listOrders);
router.patch('/orders/:id/assign', branch.assignDriver);
router.patch('/orders/:id/cancel', branch.cancelOrder);
router.get('/report', branch.report);

export default router;
