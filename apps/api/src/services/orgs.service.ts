// filepath: apps/api/src/services/orgs.service.ts
/**
 * Org service: placeholder for org-related business logic.
 * Currently not used heavily; controllers access Prisma directly for simple me() endpoint.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const orgsService = {
  // TODO: Add organization-level operations (update, invite, billing)
  getById: async (id: string) => {
    return prisma.org.findUnique({ where: { id } });
  },
};
