import { Router } from 'express';
import * as controller from '../controllers/devices.controller';
import { authMiddleware } from '../middleware/auth';
import { orgScopeMiddleware } from '../middleware/orgScope';
import { requireOrgRole } from '../middleware/membership';

// middleware exported from files:
const requireAuth = authMiddleware;
const requireOrg = orgScopeMiddleware;

const router = Router();

// Public endpoints (no auth required for agent registration)
router.post('/register', controller.registerDevice);
router.post('/heartbeat', controller.heartbeat);

// All other routes are authenticated + org-scoped
router.use(requireAuth, requireOrg);

// Devices admin endpoints: only OWNER and ADMIN can manage devices
const requireAdmin = requireOrgRole(['ADMIN', 'OWNER']);

router.get('/', requireAdmin, controller.listDevices);
router.post('/', requireAdmin, controller.createDevice);
router.get('/:id', requireAdmin, controller.getDevice);
router.patch('/:id', requireAdmin, controller.patchDevice);
router.delete('/:id', requireAdmin, controller.removeDevice);

// Revoke device (set revoked = true) - admin only
router.patch('/:id/revoke', requireAdmin, async (req, res, next) => {
	try {
		const orgId = (req as any).orgId as string;
		const { id } = req.params;
		const result = await controller.revokeDevice(orgId, id);
		res.json({ revoked: result });
	} catch (err) {
		next(err);
	}
});

export default router;