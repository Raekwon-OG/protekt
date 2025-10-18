// filepath: apps/api/src/controllers/orgs.controller.ts
/**
 * Org controller: returns org + user profile for authenticated request.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const me = async (orgId: string, user: any) => {
  const org = await prisma.org.findUnique({ where: { id: orgId } });
  // minimal user profile returned from token
  return {
    org: org || null,
    user: { id: user.userId, role: user.role, email: user.email || null },
  };
};
