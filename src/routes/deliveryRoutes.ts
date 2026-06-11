import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import * as delivery from '../controllers/deliveryController.js';

const router = Router();
router.use(auth, requireRole('DELIVERY', 'BRANCH_MANAGER'));

router.get('/deliveries', delivery.listDeliveries);
router.patch('/deliveries/:id/status', delivery.updateStatus);

export default router;
