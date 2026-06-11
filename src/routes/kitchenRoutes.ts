import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import * as kitchen from '../controllers/kitchenController.js';

const router = Router();
router.use(auth, requireRole('CHEF'));

router.get('/orders', kitchen.queue);
router.patch('/orders/:id/status', kitchen.updateStatus);

export default router;
