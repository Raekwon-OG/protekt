// filepath: apps/api/src/routes/orgs.routes.ts
/**
 * Org routes: protected endpoints for org info.
 */
import express from 'express';
import { authMiddleware } from '../middleware/auth';
import { orgScopeMiddleware } from '../middleware/orgScope';
import * as controller from '../controllers/organizations.controller';
import { requireOrgRole } from '../middleware/membership';

const router = express.Router();

// Create a new organization (current user becomes OWNER)
import { z } from 'zod';

const createOrgSchema = z.object({ name: z.string().min(2).max(100).regex(/^[^/\\]+$/), description: z.string().optional() });

router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const user = (req as any).user;
    const body = createOrgSchema.parse(req.body);
    const org = await controller.createOrganization(user.userId, body);
    res.status(201).json(org);
  } catch (err) {
    next(err);
  }
});

// Update membership role for the current user in an org (OWNER only)
router.patch('/:id/members/me', authMiddleware, requireOrgRole(['OWNER']), async (req, res, next) => {
  try {
    const user = (req as any).user;
    const orgId = req.params.id;
    const role = (req.body && req.body.role) || null;
    if (!role) return res.status(400).json({ error: { message: 'Missing role' } });
    const ok = await controller.updateMembershipRole(orgId, user.userId, role);
    res.json({ updated: ok });
  } catch (err) {
    next(err);
  }
});

// List organizations the current user belongs to
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const user = (req as any).user;
    const list = await controller.listUserOrgs(user.userId);
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// Org-scoped endpoints
router.get('/me', orgScopeMiddleware, async (req, res, next) => {
  try {
    const orgId = (req as any).orgId as string;
    const user = (req as any).user;
    const result = await controller.getOrgById(orgId);
    res.json({ org: result, user: { id: user.userId, role: user.role, email: user.email || null } });
  } catch (err) {
    next(err);
  }
});

// placeholders for invite routes
router.post('/:id/invite', authMiddleware, async (_req, res) => {
  res.status(501).json({ error: { message: 'Invite flow not implemented yet' } });
});

export default router;
