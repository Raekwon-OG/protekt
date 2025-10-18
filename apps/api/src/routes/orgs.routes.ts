// filepath: apps/api/src/routes/orgs.routes.ts
/**
 * Org routes: protected endpoints for org info.
 */
import express from 'express';
import { orgScopeMiddleware } from '../middleware/orgScope';
import * as controller from '../controllers/orgs.controller';

const router = express.Router();

router.get('/me', orgScopeMiddleware, async (req, res, next) => {
  try {
    const orgId = (req as any).orgId as string;
    const user = (req as any).user;
    const result = await controller.me(orgId, user);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
