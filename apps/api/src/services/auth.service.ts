// filepath: apps/api/src/services/auth.service.ts
/**
 * Auth service: signup & login using Prisma and JWT.
 */
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { signToken } from '../utils/jwt';
import { prisma } from '../utils/db';

export const authService = {
  signup: async (orgName: string | undefined, email: string, password: string, fullName?: string) => {
    // If orgName is provided, always create a new organization and make the user OWNER.
    let orgId: string | undefined = undefined;
    if (orgName && orgName.trim().length > 0) {
      const slug = orgName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const org = await prisma.org.create({ data: { name: orgName.trim(), slug } });
      orgId = org.id;
    }

    // Create user if not exists
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const passwordHash = await bcrypt.hash(password, 10);
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          fullName: fullName ?? undefined,
          role: orgId ? 'OWNER' : 'USER',
          orgId: orgId ?? undefined,
        },
      });

      // If we created an org, create a membership for the user as OWNER
      if (orgId) {
        await prisma.membership.create({ data: { userId: user.id, orgId, role: 'OWNER' } });
      }
    }

    const token = signToken({ userId: user.id, orgId: user.orgId ?? undefined, role: user.role });
    return { token, user: { id: user.id, email: user.email, role: user.role, orgId: user.orgId } };
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
    const token = signToken({ userId: user.id, orgId: user.orgId ?? undefined, role: user.role });
    return { token, user: { id: user.id, email: user.email, role: user.role, orgId: user.orgId } };
  },

  oauthLogin: async (email: string, fullName?: string) => {
    if (!email) throw { status: 400, message: 'Missing email from provider' };
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const randomPassword = crypto.randomBytes(24).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, 10);
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          fullName: fullName ?? undefined,
          role: 'USER',
        },
      });
    } else if (fullName && !user.fullName) {
      user = await prisma.user.update({ where: { id: user.id }, data: { fullName } });
    }

    const token = signToken({ userId: user.id, orgId: user.orgId ?? undefined, role: user.role });
    return { token, user: { id: user.id, email: user.email, role: user.role, orgId: user.orgId } };
  },
};
