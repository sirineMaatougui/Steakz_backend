import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import * as waiter from '../controllers/waiterController.js';

const router = Router();
router.use(auth, requireRole('WAITER'));

router.get('/menu', waiter.listMenu);
router.get('/orders', waiter.listOrders);
router.post('/orders', waiter.createOrder);
router.patch('/orders/:id/serve', waiter.serveOrder);

export default router;
