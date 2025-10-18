#!/usr/bin/env bash
# filepath: apps/api/scripts/generate_files.sh
# Creates the initial apps/api file tree for Protekt MVP.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_DIR="$ROOT_DIR"

mkdir -p "$API_DIR/src"
mkdir -p "$API_DIR/src/config"
mkdir -p "$API_DIR/src/middleware"
mkdir -p "$API_DIR/src/routes"
mkdir -p "$API_DIR/src/controllers"
mkdir -p "$API_DIR/src/services"
mkdir -p "$API_DIR/src/utils"
mkdir -p "$API_DIR/prisma"

# index.ts
cat > "$API_DIR/src/index.ts" <<'EOF'
// filepath: apps/api/src/index.ts
/**
 * Entrypoint: loads env and starts the HTTP server.
 */
import './config/env';
import app from './server';
import { configuration } from './config/env';
import { logger } from './utils/jwt';

const port = configuration.PORT || 4000;

const server = app.listen(port, () => {
  console.log(`Protekt API listening on port ${port}`);
});

const shutdown = (signal: string) => {
  console.log(`Received ${signal}, shutting down...`);
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('Forcing shutdown');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
EOF

# server.ts
cat > "$API_DIR/src/server.ts" <<'EOF'
// filepath: apps/api/src/server.ts
/**
 * Express app setup: middleware, routes and error handling.
 */
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { configuration } from './config/env';
import { authMiddleware } from './middleware/auth';
import authRoutes from './routes/auth.routes';
import orgsRoutes from './routes/orgs.routes';
import securityRoutes from './routes/security.routes';
import healthRoutes from './routes/health.routes';

const app = express();

app.use(cors({ origin: configuration.CORS_ORIGIN === '*' ? true : configuration.CORS_ORIGIN }));
app.use(express.json());
app.use(authMiddleware);

// Mount API routers
app.use('/api/auth', authRoutes);
app.use('/api/orgs', orgsRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/health', healthRoutes);

// Basic 404
app.use((_req, res) => {
  res.status(404).json({ error: { message: 'Not Found' } });
});

// Basic error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err?.status || 500;
  const message = err?.message || 'Internal Server Error';
  res.status(status).json({ error: { message } });
});

export default app;
EOF

# config/env.ts
cat > "$API_DIR/src/config/env.ts" <<'EOF'
// filepath: apps/api/src/config/env.ts
/**
 * Loads environment variables, validates via Zod and exports configuration.
 */
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().nonempty('DATABASE_URL is required'),
  JWT_SECRET: z.string().nonempty('JWT_SECRET is required'),
  PORT: z.preprocess((v) => (v ? Number(v) : 4000), z.number().int().positive()).optional(),
  CORS_ORIGIN: z.string().optional().default('*'),
  SAFE_BROWSING_KEY: z.string().optional(),
  NODE_ENV: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // Print helpful errors and exit early in dev
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables:', parsed.error.format());
  // Do not throw to keep behavior flexible; but missing DATABASE_URL/JWT_SECRET will be empty strings
}

export const configuration = {
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || '',
  PORT: Number(process.env.PORT || 4000),
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  SAFE_BROWSING_KEY: process.env.SAFE_BROWSING_KEY || '',
  NODE_ENV: process.env.NODE_ENV || 'development',
};
EOF

# middleware/auth.ts
cat > "$API_DIR/src/middleware/auth.ts" <<'EOF'
// filepath: apps/api/src/middleware/auth.ts
/**
 * Auth middleware: verifies Bearer token (HS256) and attaches req.user = { userId, orgId, role }.
 * If token is missing or invalid, request continues unauthenticated.
 */
import { RequestHandler } from 'express';
import { verifyToken } from '../utils/jwt';

export const authMiddleware: RequestHandler = (req, _res, next) => {
  const authHeader = (req.headers.authorization || '').trim();
  if (!authHeader) return next();

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return next();

  const token = parts[1];
  try {
    const payload = verifyToken(token);
    // attach user context
    (req as any).user = {
      userId: payload.userId,
      orgId: payload.orgId,
      role: payload.role,
    };
  } catch {
    // invalid token -> ignore and continue as unauthenticated
  }
  return next();
};
EOF

# middleware/orgScope.ts
cat > "$API_DIR/src/middleware/orgScope.ts" <<'EOF'
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
EOF

# routes/auth.routes.ts
cat > "$API_DIR/src/routes/auth.routes.ts" <<'EOF'
// filepath: apps/api/src/routes/auth.routes.ts
/**
 * Auth routes: signup and login.
 */
import express from 'express';
import { z } from 'zod';
import * as controller from '../controllers/auth.controller';

const router = express.Router();

const signupSchema = z.object({
  orgName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/signup', async (req, res, next) => {
  try {
    const body = signupSchema.parse(req.body);
    const result = await controller.signup(body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const result = await controller.login(body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
EOF

# routes/orgs.routes.ts
cat > "$API_DIR/src/routes/orgs.routes.ts" <<'EOF'
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
EOF

# routes/security.routes.ts
cat > "$API_DIR/src/routes/security.routes.ts" <<'EOF'
// filepath: apps/api/src/routes/security.routes.ts
/**
 * Security routes: URL scanning and inbound email ingestion (webhook).
 */
import express from 'express';
import { z } from 'zod';
import * as controller from '../controllers/security.controller';

const router = express.Router();

const scanUrlSchema = z.object({
  url: z.string().url(),
});

const ingestEmailSchema = z.object({
  from: z.string().optional(),
  subject: z.string().optional(),
  text: z.string().optional(),
  urls: z.array(z.string().url()).optional(),
  attachments: z.array(z.any()).optional(),
});

router.post('/scan-url', async (req, res, next) => {
  try {
    const body = scanUrlSchema.parse(req.body);
    const result = await controller.scanUrl(body.url);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/ingest-email', async (req, res, next) => {
  try {
    const body = ingestEmailSchema.parse(req.body);
    const result = await controller.ingestEmail(body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
EOF

# routes/health.routes.ts
cat > "$API_DIR/src/routes/health.routes.ts" <<'EOF'
// filepath: apps/api/src/routes/health.routes.ts
/**
 * Healthcheck endpoint.
 */
import express from 'express';

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({ ok: true });
});

export default router;
EOF

# controllers/auth.controller.ts
cat > "$API_DIR/src/controllers/auth.controller.ts" <<'EOF'
// filepath: apps/api/src/controllers/auth.controller.ts
/**
 * Auth controller: delegates to auth.service for signup/login and returns tokens.
 */
import { authService } from '../services/auth.service';

export const signup = async (body: { orgName: string; email: string; password: string }) => {
  const result = await authService.signup(body.orgName, body.email, body.password);
  return result;
};

export const login = async (body: { email: string; password: string }) => {
  const result = await authService.login(body.email, body.password);
  return result;
};
EOF

# controllers/orgs.controller.ts
cat > "$API_DIR/src/controllers/orgs.controller.ts" <<'EOF'
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
EOF

# controllers/security.controller.ts
cat > "$API_DIR/src/controllers/security.controller.ts" <<'EOF'
// filepath: apps/api/src/controllers/security.controller.ts
/**
 * Security controller: handles URL scan and inbound email ingestion.
 */
import { securityService } from '../services/security.service';

export const scanUrl = async (url: string) => {
  const verdict = await securityService.checkUrlReputation(url);
  return verdict;
};

export const ingestEmail = async (payload: {
  from?: string;
  subject?: string;
  text?: string;
  urls?: string[];
  attachments?: any[];
}) => {
  const summary = await securityService.ingestEmail(payload);
  return summary;
};
EOF

# services/auth.service.ts
cat > "$API_DIR/src/services/auth.service.ts" <<'EOF'
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
EOF

# services/orgs.service.ts
cat > "$API_DIR/src/services/orgs.service.ts" <<'EOF'
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
EOF

# services/security.service.ts
cat > "$API_DIR/src/services/security.service.ts" <<'EOF'
// filepath: apps/api/src/services/security.service.ts
/**
 * Security service: static denylist + optional Google Safe Browsing integration stub.
 * Provides checkUrlReputation(url) and ingestEmail(payload) which scans any URLs in the payload.
 */
import { configuration } from '../config/env';
import fetch from 'node-fetch';

const STATIC_DENYLIST = [
  'phishing.example.com',
  'malware.example.net',
  'bad-site.test',
  'login-bank.example',
];

export const securityService = {
  checkUrlReputation: async (url: string) => {
    // Basic static host check
    try {
      const u = new URL(url);
      const host = u.host.toLowerCase();
      const matched = STATIC_DENYLIST.find((d) => host.includes(d));
      if (matched) {
        return { url, verdict: 'phishing' as const, reason: 'static denylist match' };
      }
    } catch {
      return { url, verdict: 'phishing' as const, reason: 'invalid url' };
    }

    // Optional: Google Safe Browsing API (stubbed if key missing)
    if (!configuration.SAFE_BROWSING_KEY) {
      return { url, verdict: 'clean' as const, reason: 'no safe browsing key, static check passed' };
    }

    // TODO: Implement actual Google Safe Browsing lookup.
    // Example placeholder: we return clean but note that this is a stub.
    try {
      // If you implement Safe Browsing, call the API here.
      // const resp = await fetch('https://safebrowsing.googleapis.com/v4/...', { method: 'POST', body: ... });
      return { url, verdict: 'clean' as const, reason: 'safe browsing not implemented (stub)' };
    } catch (err) {
      return { url, verdict: 'clean' as const, reason: 'safe browsing failed, defaulting to clean' };
    }
  },

  ingestEmail: async (payload: {
    from?: string;
    subject?: string;
    text?: string;
    urls?: string[];
    attachments?: any[];
  }) => {
    const urls = payload.urls || [];
    let scanned = 0;
    let phishingDetected = 0;
    const details: any[] = [];

    for (const u of urls) {
      scanned++;
      # shellcheck disable=SC2034
      // eslint-disable-next-line no-await-in-loop
      const res = await securityService.checkUrlReputation(u);
      details.push(res);
      if (res.verdict === 'phishing') phishingDetected++;
    }

    // TODO: persist inbound email and scan results to the DB (Prisma) for audit/history

    return { received: true, scanned, phishingDetected, details };
  },
};
EOF

# utils/db.ts
cat > "$API_DIR/src/utils/db.ts" <<'EOF'
// filepath: apps/api/src/utils/db.ts
/**
 * Shared Prisma client singleton to avoid multiple instances.
 */
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['info', 'warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
EOF

# utils/jwt.ts
cat > "$API_DIR/src/utils/jwt.ts" <<'EOF'
// filepath: apps/api/src/utils/jwt.ts
/**
 * JWT helpers: sign and verify HS256 tokens with configured secret.
 */
import jwt from 'jsonwebtoken';
import { configuration } from '../config/env';

export type TokenPayload = {
  userId: string;
  orgId: string;
  role: 'ADMIN' | 'MEMBER' | string;
  iat?: number;
  exp?: number;
};

const SECRET = configuration.JWT_SECRET || '';

export const signToken = (payload: { userId: string; orgId: string; role: string }) => {
  if (!SECRET) return '';
  return jwt.sign(payload as any, SECRET, { algorithm: 'HS256', expiresIn: '7d' });
};

export const verifyToken = (token: string): TokenPayload => {
  if (!SECRET) throw new Error('JWT secret not configured');
  const decoded = jwt.verify(token, SECRET) as TokenPayload;
  return decoded;
};

// Simple logger export to be used in index if desired
export const logger = {
  info: (msg: string) => console.info(msg),
  error: (msg: string) => console.error(msg),
};
EOF

# prisma/schema.prisma
cat > "$API_DIR/prisma/schema.prisma" <<'EOF'
// filepath: apps/api/prisma/schema.prisma
// Prisma schema for Protekt MVP: Org and User models.
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Org {
  id        String  @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  users     User[]
}

model User {
  id           String  @id @default(cuid())
  email        String  @unique
  passwordHash String
  role         String  @default("MEMBER")
  orgId        String
  org          Org     @relation(fields: [orgId], references: [id])
  createdAt    DateTime @default(now())
}
EOF

# prisma/seed.ts
cat > "$API_DIR/prisma/seed.ts" <<'EOF'
// filepath: apps/api/prisma/seed.ts
/**
 * Seed script: creates a demo org and admin user.
 * Run with: npx ts-node prisma/seed.ts  (ensure DATABASE_URL is set)
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.org.upsert({
    where: { name: 'Demo Org' },
    update: {},
    create: { name: 'Demo Org' },
  });

  const email = 'admin@demo.local';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const passwordHash = await bcrypt.hash('admin123', 10);
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'ADMIN',
        orgId: org.id,
      },
    });
    console.log('Created demo user:', email, 'password: admin123');
  } else {
    console.log('Demo user already exists:', email);
  }
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
EOF

# .env.example
cat > "$API_DIR/.env.example" <<'EOF'
# filepath: apps/api/.env.example
# Postgres connection for Prisma
# DATABASE_URL=postgresql://user:password@localhost:5432/protekt

# JWT secret used to sign tokens (HS256)
# JWT_SECRET=your_jwt_secret_here

# App port
# PORT=4000

# CORS origin (use "*" for dev)
# CORS_ORIGIN=http://localhost:3000

# Google Safe Browsing API Key (optional)
# SAFE_BROWSING_KEY=your_safe_browsing_key

# NODE_ENV=development
EOF

echo "All files created under $API_DIR"
echo "Next steps:"
echo "  cd $API_DIR"
echo "  pnpm install"
echo "  npx prisma generate"
echo "  npx prisma db push   # or migrate as needed"
echo "  pnpm dev (configure a dev script like ts-node-dev or nodemon)"