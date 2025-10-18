// filepath: apps/api/src/middleware/orgScope.ts
/**
 * Org-scope middleware: ensures request has org context (from auth) and attaches req.orgId.
 * Intended to be applied to protected routes that require org scoping.
 */
import { RequestHandler } from 'express';

export const orgScopeMiddleware: RequestHandler = (req, res, next) => {
  const user = (req as any).user;
  if (!user || !user.orgId) {
    return res.status(401).json({ error: { message: 'Unauthorized - missing org context' } });
  }
  (req as any).orgId = user.orgId;
  next();
};
