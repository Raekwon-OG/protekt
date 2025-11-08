import { prisma } from '../utils/db';
import type { Org, Membership } from '@prisma/client';

export const createOrganization = async (userId: string, body: { name: string; description?: string }): Promise<Org> => {
  const name = body.name.trim();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const org = await prisma.org.create({ data: { name, slug } });
  // create membership for user as OWNER
  await prisma.membership.create({ data: { userId, orgId: org.id, role: 'OWNER' } });
  // set user's current orgId to this org
  await prisma.user.update({ where: { id: userId }, data: { orgId: org.id, role: 'OWNER' } });
  return org;
};

export const listUserOrgs = async (userId: string) => {
  const memberships: (Membership & { org: Org })[] = await prisma.membership.findMany({ where: { userId }, include: { org: true } });
  return memberships.map((m) => ({ org: m.org, role: m.role }));
};

export const getOrgById = async (id: string) => {
  return prisma.org.findUnique({ where: { id } });
};

export const updateMembershipRole = async (orgId: string, userId: string, role: string) => {
  // Update membership role for the user in the org
  const result = await prisma.membership.updateMany({ where: { orgId, userId }, data: { role } });
  // If the user's current org is this org, also update the user's role field
  try {
    await prisma.user.updateMany({ where: { id: userId, orgId }, data: { role } });
  } catch (e) {
    // ignore
  }
  return result.count > 0;
};
