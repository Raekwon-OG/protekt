// filepath: apps/api/prisma/seed.ts
/**
 * Seed script for Protekt demo data.
 * Creates a demo org and two demo users (ADMIN and MEMBER).
 * Run:
 *   pnpm run seed
 * or
 *   npx prisma db seed
 *
 * NOTE: printing plaintext passwords is for local/dev testing only.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ORG_NAME = 'Demo Org';
const USERS = [
  { email: 'admin@demo.local', password: 'admin123', role: 'ADMIN' as const },
  { email: 'member@demo.local', password: 'member123', role: 'MEMBER' as const },
];

async function main() {
  // Find or create the org
  let org = await prisma.org.findFirst({ where: { name: ORG_NAME } });
  if (!org) {
    org = await prisma.org.create({ data: { name: ORG_NAME } });
    console.log('Created org:', org.id, org.name);
  } else {
    console.log('Org exists:', org.id, org.name);
  }

  // Create demo users if they don't exist
  for (const u of USERS) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      console.log(`User exists: ${existing.email} (role=${existing.role})`);
      continue;
    }

    const passwordHash = await bcrypt.hash(u.password, 10);
    const user = await prisma.user.create({
      data: {
        email: u.email,
        passwordHash,
        role: u.role,
        orgId: org.id,
      },
    });

    // Log credentials for local testing only
    console.log('Created demo user:');
    console.log(`  email: ${user.email}`);
    console.log(`  password: ${u.password}`);
    console.log(`  role: ${user.role}`);
    console.log(`  orgId: ${user.orgId}`);
  }
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
