import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import * as admin from '../controllers/adminController.js';

const router = Router();
router.use(auth, requireRole('ADMIN'));

// Users
router.get('/users', admin.listUsers);
router.post('/users', admin.createUser);
router.get('/users/:id', admin.getUser);
router.patch('/users/:id', admin.updateUser);
router.delete('/users/:id', admin.deleteUser);

// Branches
router.get('/branches', admin.listBranches);
router.post('/branches', admin.createBranch);
router.patch('/branches/:id', admin.updateBranch);
router.delete('/branches/:id', admin.deleteBranch);

export default router;
