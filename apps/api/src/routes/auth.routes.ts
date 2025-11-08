// filepath: apps/api/src/routes/auth.routes.ts
/**
 * Auth routes: signup and login.
 */
import express from 'express';
import { z } from 'zod';
import * as controller from '../controllers/auth.controller';
import { prisma } from '../utils/db';

const router = express.Router();

const signupSchema = z.object({
  orgName: z.string().min(2).max(100).regex(/^[^/\\]+$/).optional(),
  fullName: z.string().min(1).max(100).optional(),
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

// Return current user info (requires auth middleware to run before this route)
router.get('/me', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: { message: 'Unauthorized' } });
    const u = await prisma.user.findUnique({ where: { id: user.userId }, select: { id: true, email: true, fullName: true, role: true, orgId: true } });
    if (!u) return res.status(404).json({ error: { message: 'Not found' } });
    res.json(u);
  } catch (err) {
    res.status(500).json({ error: { message: 'Server error' } });
  }
});

export default router;
