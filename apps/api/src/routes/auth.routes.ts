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
