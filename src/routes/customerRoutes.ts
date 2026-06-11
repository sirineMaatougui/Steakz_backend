import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import * as customer from '../controllers/customerController.js';

const router = Router();
router.use(auth, requireRole('CUSTOMER'));

router.get('/branches', customer.listBranches);
router.get('/branches/:branchId/menu', customer.browseMenu);
router.post('/orders', customer.placeOrder);
router.get('/orders', customer.myOrders);
router.get('/orders/:id', customer.getMyOrder);
router.patch('/orders/:id/cancel', customer.cancelMyOrder);

export default router;
