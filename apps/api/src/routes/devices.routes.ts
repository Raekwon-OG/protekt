import { Router } from 'express';
import * as controller from '../controllers/devices.controller';
import { authMiddleware } from '../middleware/auth';
import { orgScopeMiddleware } from '../middleware/orgScope';

// middleware exported from files:
const requireAuth = authMiddleware;
const requireOrg = orgScopeMiddleware;

const router = Router();

// All routes are authenticated + org-scoped
router.use(requireAuth, requireOrg);

router.get('/', controller.listDevices);
router.post('/', controller.createDevice);
router.get('/:id', controller.getDevice);
router.patch('/:id', controller.patchDevice);
router.delete('/:id', controller.removeDevice);

export default router;