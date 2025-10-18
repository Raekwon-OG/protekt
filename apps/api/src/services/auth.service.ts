// filepath: apps/api/src/services/auth.service.ts
/**
 * Auth service: signup & login using Prisma and JWT.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { signToken } from '../utils/jwt';

const prisma = new PrismaClient();

export const authService = {
  signup: async (orgName: string, email: string, password: string) => {
    // Create org if not exists
    let org = await prisma.org.findFirst({ where: { name: orgName } });
    if (!org) {
      org = await prisma.org.create({ data: { name: orgName } });
    }

    // Create user if not exists
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const passwordHash = await bcrypt.hash(password, 10);
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          role: 'ADMIN',
          orgId: org.id,
        },
      });
    }

    const token = signToken({ userId: user.id, orgId: org.id, role: user.role });
    return { token, user: { id: user.id, email: user.email, role: user.role, orgId: org.id } };
  },

  login: async (email: string, password: string) => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw { status: 401, message: 'Invalid credentials' };
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw { status: 401, message: 'Invalid credentials' };
    }
    const token = signToken({ userId: user.id, orgId: user.orgId, role: user.role });
    return { token, user: { id: user.id, email: user.email, role: user.role, orgId: user.orgId } };
  },
};
