// filepath: apps/api/prisma/seed.ts
/**
 * Seed script for Protekt demo data.
 * Creates a demo org, demo users and sample devices (idempotent).
 * Run:
 *   pnpm --filter api run seed
 * or
 *   (from apps/api) pnpm run seed
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

  // --- devices seed (idempotent) ---
  const demoDevices = [
    {
      name: 'SERVER-DB-01',
      type: 'Server',
      orgId: org.id,
      status: 'Online',
      agentVersion: '2.4.1',
      risk: 'Low',
    },
    {
      name: 'LAPTOP-DEV-05',
      type: 'Laptop',
      orgId: org.id,
      status: 'Online',
      agentVersion: '2.4.0',
      risk: 'Medium',
    },
    {
      name: 'WORKSTATION-HR-12',
      type: 'Desktop',
      orgId: org.id,
      status: 'Offline',
      agentVersion: '2.4.1',
      risk: 'Low',
    },
  ];

  try {
    // remove any existing demo devices for this org (keeps seed idempotent)
    await prisma.device.deleteMany({ where: { orgId: org.id } });
    console.log('Cleared existing demo devices for org:', org.id);
  } catch (err) {
    console.warn('Could not delete existing devices (safe):', (err as any).message || err);
  }

  try {
    await prisma.device.createMany({ data: demoDevices });
    console.log('Seeded demo devices for org:', org.id);
  } catch (err) {
    // fallback to individual creates if createMany fails
    console.warn('createMany failed, falling back to individual creates:', (err as any).message || err);
    for (const d of demoDevices) {
      try {
        await prisma.device.create({ data: d });
      } catch (e) {
        console.warn('Skipping device create (safe):', (e as any).message || e);
      }
    }
    console.log('Device seeding attempted (fallback).');
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
