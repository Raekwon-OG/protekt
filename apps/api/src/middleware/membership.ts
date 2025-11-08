import { RequestHandler } from 'express';
import { prisma } from '../utils/db';

// roles hierarchy
const roleRank = (r: string) => {
  switch (r) {
    case 'OWNER': return 4;
    case 'ADMIN': return 3;
    case 'MEMBER': return 2;
    case 'USER': return 1;
    default: return 0;
  }
};

// require that current user is member of req.orgId and has one of allowedRoles
export const requireOrgRole = (allowedRoles: string[]): RequestHandler => {
  return async (req, res, next) => {
    try {
      const user = (req as any).user;
      const orgId = (req as any).orgId || req.params.id;
      if (!user) return res.status(401).json({ error: { message: 'Unauthorized' } });
      if (!orgId) return res.status(400).json({ error: { message: 'Missing org context' } });

      const membership = await prisma.membership.findFirst({ where: { userId: user.userId, orgId } });
      if (!membership) return res.status(403).json({ error: { message: 'Forbidden - not a member of org' } });

      // check allowed roles
      const memberRank = roleRank(membership.role);
      const allowed = allowedRoles.some(r => memberRank >= roleRank(r));
      if (!allowed) return res.status(403).json({ error: { message: 'Forbidden - insufficient role' } });

      // attach membership to request
      (req as any).membership = membership;
      next();
    } catch (err) {
      next(err);
    }
  };
};
