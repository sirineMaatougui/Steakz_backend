import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import * as cashier from '../controllers/cashierController.js';

const router = Router();
router.use(auth, requireRole('CASHIER'));

router.get('/orders', cashier.unpaidOrders);
router.post('/orders/:id/payment', cashier.takePayment);

export default router;
